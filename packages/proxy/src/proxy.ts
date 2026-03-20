import type { Sql } from "postgres";
import type { RoutingDecision, RouteResult } from "@theminutes/types";
import { ProxyError } from "./errors";
import { TakeRateAccumulator } from "./take-rate";

const TAKE_RATE_AMOUNT = Number(process.env["TAKE_RATE_AMOUNT"] ?? "0.001");
const REQUEST_TIMEOUT_MS = 10_000;

export class MppProxy {
  constructor(
    private readonly db: Sql,
    private readonly takeRate: TakeRateAccumulator,
  ) {}

  async execute(
    decision: RoutingDecision,
    params: Record<string, unknown>,
    requestId: string,
  ): Promise<RouteResult> {
    const cached = await this.checkIdempotency(requestId);
    if (cached) return cached;

    for (const candidate of decision.candidates) {
      const { provider } = candidate;
      const result = await this.tryProvider(
        provider,
        candidate.reason,
        decision.strategy,
        params,
        requestId,
      );
      if (result) return result;
    }

    throw new ProxyError(
      "ALL_PROVIDERS_FAILED",
      `All ${decision.candidates.length} provider(s) failed for request ${requestId}`,
    );
  }

  private async tryProvider(
    provider: RoutingDecision["candidates"][0]["provider"],
    reason: string,
    strategy: string,
    params: Record<string, unknown>,
    requestId: string,
  ): Promise<RouteResult | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const start = Date.now();
    try {
      const response = await fetch(provider.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeout);

      if (response.status >= 500) {
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const latencyMs = Date.now() - start;
      const data = await response.json();
      const providerCost = provider.basePrice;
      const takeRate = TAKE_RATE_AMOUNT;
      const totalCost = providerCost + takeRate;

      await this.recordSpend(
        requestId,
        provider.id,
        provider.name,
        strategy,
        reason,
        providerCost,
        takeRate,
        totalCost,
        latencyMs,
      );
      await this.takeRate.record(requestId, takeRate);

      return {
        data,
        _routing: {
          providerId: provider.id,
          providerName: provider.name,
          strategy: strategy as RouteResult["_routing"]["strategy"],
          reason,
          providerCost,
          takeRate,
          totalCost,
          latencyMs,
        },
      };
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }

  private async checkIdempotency(
    requestId: string,
  ): Promise<RouteResult | null> {
    const rows = await this.db<SpendRow[]>`
      SELECT provider_id, provider_name, strategy, reason,
             provider_cost, take_rate, total_cost, latency_ms
      FROM spend_records
      WHERE request_id = ${requestId}
    `;

    if (rows.length === 0) return null;
    const row = rows[0]!;

    return {
      data: null,
      _routing: {
        providerId: row.provider_id,
        providerName: row.provider_name,
        strategy: row.strategy as RouteResult["_routing"]["strategy"],
        reason: row.reason ?? "",
        providerCost: Number(row.provider_cost),
        takeRate: Number(row.take_rate),
        totalCost: Number(row.total_cost),
        latencyMs: Number(row.latency_ms),
      },
    };
  }

  private async recordSpend(
    requestId: string,
    providerId: string,
    providerName: string,
    strategy: string,
    reason: string,
    providerCost: number,
    takeRate: number,
    totalCost: number,
    latencyMs: number,
  ): Promise<void> {
    const keyRows = await this.db<{ id: string }[]>`
      SELECT id FROM api_keys WHERE revoked_at IS NULL LIMIT 1
    `;
    const apiKeyId = keyRows[0]?.id ?? "system";

    await this.db`
      INSERT INTO spend_records (
        api_key_id, provider_id, provider_name, service_category,
        provider_cost, take_rate, total_cost, latency_ms, request_id
      ) VALUES (
        ${apiKeyId}, ${providerId}, ${providerName}, ${providerName},
        ${providerCost}, ${takeRate}, ${totalCost}, ${latencyMs}, ${requestId}
      )
    `;
  }
}

interface SpendRow {
  provider_id: string;
  provider_name: string;
  strategy: string;
  reason: string | null;
  provider_cost: string | number;
  take_rate: string | number;
  total_cost: string | number;
  latency_ms: string | number;
}
