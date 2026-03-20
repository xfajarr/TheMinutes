import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "../db/client";
import { errorResponse } from "../middleware/error";
import { route, RoutingError } from "@theminutes/router";
import type {
  RoutingStrategy,
  RoutingConstraints,
  RoutingDecision,
  ServiceCategory,
  PaymentRail,
  ProviderStatus,
} from "@theminutes/types";
import { ProxyError } from "@theminutes/proxy";

export const routeRouter = new Hono();

const routeSchema = z.object({
  service: z.string().min(1),
  params: z.record(z.unknown()),
  strategy: z.enum(["cheapest", "fastest", "balanced"]).default("balanced"),
  constraints: z
    .object({
      maxPrice: z.number().optional(),
      whitelist: z.array(z.string()).optional(),
      blacklist: z.array(z.string()).optional(),
      minUptime: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

interface ProviderRow {
  id: string;
  name: string;
  category: string;
  endpoint: string;
  rails: string[];
  base_price: string;
  currency: string;
  capabilities: string[];
  status: string;
  created_at: string;
  updated_at: string;
  p50: string | null;
  p90: string | null;
  p99: string | null;
  uptime: string | null;
  last_seen: string | null;
}

function rowToProviderWithMetrics(row: ProviderRow) {
  return {
    id: row.id,
    name: row.name,
    category: row.category as ServiceCategory,
    endpoint: row.endpoint,
    rails: row.rails as PaymentRail[],
    basePrice: parseFloat(row.base_price),
    currency: "USD" as const,
    capabilities: row.capabilities,
    status: row.status as ProviderStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    latency: {
      p50: row.p50 ? parseFloat(row.p50) : null,
      p90: row.p90 ? parseFloat(row.p90) : null,
      p99: row.p99 ? parseFloat(row.p99) : null,
    },
    uptime: row.uptime ? parseFloat(row.uptime) : null,
    lastSeen: row.last_seen,
  };
}

// GET /v1/route/preview — ranked providers without executing
routeRouter.get("/preview", async (c) => {
  const { service, strategy = "balanced", constraints } = c.req.query();

  try {
    const category = service || "other";
    const rows = await db<ProviderRow[]>`
      SELECT
        p.*,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY h.latency_ms) AS p50,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY h.latency_ms) AS p90,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY h.latency_ms) AS p99,
        ROUND(
          100.0 * SUM(CASE WHEN h.success THEN 1 ELSE 0 END) / NULLIF(COUNT(h.id), 0),
          2
        ) AS uptime,
        MAX(h.pinged_at)::text AS last_seen
      FROM providers p
      LEFT JOIN health_pings h
        ON h.provider_id = p.id
        AND h.pinged_at > NOW() - INTERVAL '24 hours'
      WHERE p.status != 'inactive'
        AND p.category = ${category}
      GROUP BY p.id
      ORDER BY p.name
    `;

    const providers = rows.map(rowToProviderWithMetrics);
    const routingStrategy = strategy as RoutingStrategy;
    const routingConstraints = constraints as RoutingConstraints | undefined;

    let decision: RoutingDecision;
    try {
      decision = route(providers, routingStrategy, routingConstraints);
    } catch (err) {
      if (err instanceof RoutingError) {
        return c.json({ error: err.message, code: err.code }, 400);
      }
      throw err;
    }

    return c.json({
      candidates: decision.candidates,
      strategy: decision.strategy,
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /v1/route — execute routed request
routeRouter.post("/", zValidator("json", routeSchema), async (c) => {
  const {
    service,
    params,
    strategy = "balanced",
    constraints,
  } = c.req.valid("json");

  try {
    const category = service || "other";
    const rows = await db<ProviderRow[]>`
      SELECT
        p.*,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY h.latency_ms) AS p50,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY h.latency_ms) AS p90,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY h.latency_ms) AS p99,
        ROUND(
          100.0 * SUM(CASE WHEN h.success THEN 1 ELSE 0 END) / NULLIF(COUNT(h.id), 0),
          2
        ) AS uptime,
        MAX(h.pinged_at)::text AS last_seen
      FROM providers p
      LEFT JOIN health_pings h
        ON h.provider_id = p.id
        AND h.pinged_at > NOW() - INTERVAL '24 hours'
      WHERE p.status != 'inactive'
        AND p.category = ${category}
      GROUP BY p.id
      ORDER BY p.name
    `;

    const providers = rows.map(rowToProviderWithMetrics);
    const routingStrategy = strategy as RoutingStrategy;
    const routingConstraints = constraints as RoutingConstraints | undefined;

    const decision = route(providers, routingStrategy, routingConstraints);

    const { MppProxy } = await import("@theminutes/proxy");
    const { TakeRateAccumulator } = await import("@theminutes/proxy");
    const takeRate = new TakeRateAccumulator(db);
    const proxy = new MppProxy(db, takeRate);

    const requestId = nanoid();
    const result = await proxy.execute(decision, params, requestId);

    return c.json(result);
  } catch (err) {
    if (err instanceof RoutingError) {
      return c.json({ error: err.message, code: err.code }, 400);
    }
    if (err instanceof ProxyError) {
      return c.json({ error: err.message, code: err.code }, 502);
    }
    return errorResponse(c, err);
  }
});
