import { Hono } from "hono";
import { db } from "../db/client";
import { errorResponse } from "../middleware/error";

export const spendRouter = new Hono();

// GET /v1/spend — caller's spend history
spendRouter.get("/", async (c) => {
  const apiKeyId = c.get("apiKeyId") as string;
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const offset = Number(c.req.query("offset") ?? 0);

  try {
    const records = await db`
      SELECT
        id, provider_id, provider_name, service_category,
        provider_cost, take_rate, total_cost, latency_ms, created_at
      FROM spend_records
      WHERE api_key_id = ${apiKeyId}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const [{ count }] = await db`
      SELECT COUNT(*)::int AS count
      FROM spend_records
      WHERE api_key_id = ${apiKeyId}
    `;

    return c.json({ data: records, total: count, limit, offset });
  } catch (err) {
    return errorResponse(c, err);
  }
});
