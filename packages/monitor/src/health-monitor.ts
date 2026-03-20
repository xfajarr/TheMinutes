import type { Sql } from "postgres";
import type { ProviderWithMetrics, ServiceCategory } from "@theminutes/types";

let _db: Sql;
function setDb(db: Sql) {
  _db = db;
}
function getDb(): Sql {
  if (!_db) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("../api/src/db/client") as { db: Sql };
    _db = mod.db;
  }
  return _db;
}

export interface HealthMetrics {
  p50: number | null;
  p90: number | null;
  p99: number | null;
  uptime: number | null;
  lastSeen: string | null;
}

export class HealthMonitor {
  constructor(private readonly db: Sql = getDb()) {}

  async recordPing(
    providerId: string,
    latencyMs: number | null,
    success: boolean,
  ): Promise<void> {
    await this.db`
      INSERT INTO health_pings (provider_id, latency_ms, success)
      VALUES (${providerId}, ${latencyMs}, ${success})
    `;
  }

  async recordLatency(providerId: string, latencyMs: number): Promise<void> {
    await this.recordPing(providerId, latencyMs, true);
  }

  async getHealth(providerId: string): Promise<HealthMetrics> {
    const rows = await this.db<HealthPingRow[]>`
      SELECT latency_ms, success, pinged_at
      FROM health_pings
      WHERE provider_id = ${providerId}
        AND pinged_at > NOW() - INTERVAL '24 hours'
      ORDER BY pinged_at DESC
    `;

    if (rows.length === 0) {
      return { p50: null, p90: null, p99: null, uptime: null, lastSeen: null };
    }

    const latencies = rows
      .map((r) => r.latency_ms)
      .filter((v): v is number => v !== null);

    const successes = rows.filter((r) => r.success).length;
    const total = rows.length;
    const uptime = Math.round((successes / total) * 10000) / 100;

    const lastSeen = rows[0]?.pinged_at?.toISOString() ?? null;

    return {
      p50: percentile(latencies, 0.5),
      p90: percentile(latencies, 0.9),
      p99: percentile(latencies, 0.99),
      uptime,
      lastSeen,
    };
  }

  async getLeaderboard(category: string): Promise<ProviderWithMetrics[]> {
    const rows = await this.db<LeaderboardRow[]>`
      SELECT
        p.id, p.name, p.category, p.endpoint, p.rails,
        p.base_price, p.currency, p.capabilities, p.status,
        p.created_at, p.updated_at,
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
      ORDER BY p50 ASC NULLS LAST
    `;

    return rows.map(toProviderWithMetrics);
  }
}

interface HealthPingRow {
  latency_ms: number | null;
  success: boolean;
  pinged_at: Date;
}

interface LeaderboardRow {
  id: string;
  name: string;
  category: ServiceCategory;
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

function percentile(sortedValues: number[], p: number): number | null {
  if (sortedValues.length === 0) return null;
  const sorted = [...sortedValues].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  const fraction = index - lower;
  return sorted[lower]! + fraction * (sorted[upper]! - sorted[lower]!);
}

function toProviderWithMetrics(row: LeaderboardRow): ProviderWithMetrics {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    endpoint: row.endpoint,
    rails: row.rails as ProviderWithMetrics["rails"],
    basePrice: parseFloat(row.base_price),
    currency: "USD",
    capabilities: row.capabilities,
    status: row.status as ProviderWithMetrics["status"],
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

export { setDb };
