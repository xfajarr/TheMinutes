import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db/client";
import { errorResponse } from "../middleware/error";
import type { ProviderWithMetrics, ServiceCategory } from "@theminutes/types";

export const servicesRouter = new Hono();

// GET /v1/services — list all providers with metrics
servicesRouter.get("/", async (c) => {
  try {
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
      GROUP BY p.id
      ORDER BY p.name
    `;

    return c.json(rows.map(toProviderWithMetrics));
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /v1/services/:category — filter by category
servicesRouter.get("/:category", async (c) => {
  const category = c.req.param("category") as ServiceCategory;

  try {
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

    return c.json(rows.map(toProviderWithMetrics));
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /v1/providers/register
const registerSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(["web-search", "data-extraction", "ai-model", "compute", "storage", "other"]),
  endpoint: z.string().url(),
  rails: z.array(z.enum(["tempo", "stripe", "lightning", "visa"])).min(1),
  basePrice: z.number().positive(),
  capabilities: z.array(z.string()).default([]),
});

servicesRouter.post("/register", zValidator("json", registerSchema), async (c) => {
  const body = c.req.valid("json");

  try {
    const [provider] = await db`
      INSERT INTO providers (name, category, endpoint, rails, base_price, currency, capabilities, source)
      VALUES (
        ${body.name},
        ${body.category},
        ${body.endpoint},
        ${body.rails},
        ${body.basePrice},
        'USD',
        ${body.capabilities},
        'manual'
      )
      ON CONFLICT (endpoint) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        rails = EXCLUDED.rails,
        base_price = EXCLUDED.base_price,
        capabilities = EXCLUDED.capabilities,
        updated_at = NOW()
      RETURNING *
    `;

    return c.json(provider, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ProviderRow {
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

function toProviderWithMetrics(row: ProviderRow): ProviderWithMetrics {
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
