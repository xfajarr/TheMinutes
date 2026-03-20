import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { db } from "../db/client";
import { redis } from "../cache/client";
import { errorResponse } from "../middleware/error";
import type { ApiKey } from "@theminutes/types";

export const keysRouter = new Hono();

// POST /v1/keys — create a new API key
keysRouter.post(
  "/",
  zValidator("json", z.object({ name: z.string().min(1).max(100) })),
  async (c) => {
    const { name } = c.req.valid("json");

    // Generate a secure key: tm_ prefix + 32 random bytes as hex
    const rawKey = `tm_${randomBytes(32).toString("hex")}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const prefix = rawKey.slice(0, 10); // "tm_" + 7 chars

    try {
      const [key] = await db`
        INSERT INTO api_keys (name, key_hash, prefix)
        VALUES (${name}, ${keyHash}, ${prefix})
        RETURNING id, name, prefix, created_at
      `;

      // Return the raw key ONCE — never stored, never retrievable again
      return c.json({ ...key, key: rawKey }, 201);
    } catch (err) {
      return errorResponse(c, err);
    }
  }
);

// GET /v1/keys — list all active keys (no raw keys)
keysRouter.get("/", async (c) => {
  try {
    const keys = await db<ApiKey[]>`
      SELECT id, name, prefix, created_at, last_used_at
      FROM api_keys
      WHERE revoked_at IS NULL
      ORDER BY created_at DESC
    `;
    return c.json(keys);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /v1/keys/:id — revoke a key
keysRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const [key] = await db`
      UPDATE api_keys
      SET revoked_at = NOW()
      WHERE id = ${id} AND revoked_at IS NULL
      RETURNING id, key_hash
    `;

    if (!key) {
      return c.json({ error: "API key not found", code: "NOT_FOUND" }, 404);
    }

    // Bust the auth cache for this key immediately
    await redis.del(`auth:${key["key_hash"]}`);

    return c.json({ id, revoked: true });
  } catch (err) {
    return errorResponse(c, err);
  }
});
