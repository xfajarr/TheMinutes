import type { Context, Next } from "hono";
import { db } from "../db/client";
import { redis } from "../cache/client";
import { createHash } from "crypto";

// Cache auth results for 60s to avoid hitting DB on every request
const CACHE_TTL = 60;

function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header", code: "UNAUTHORIZED" }, 401);
  }

  const rawKey = authHeader.slice(7);
  const keyHash = hashKey(rawKey);

  // Check cache first
  const cached = await redis.get(`auth:${keyHash}`);
  if (cached === "invalid") {
    return c.json({ error: "Invalid API key", code: "UNAUTHORIZED" }, 401);
  }

  if (cached) {
    const parsed = JSON.parse(cached) as { id: string; name: string };
    c.set("apiKeyId", parsed.id);
    c.set("apiKeyName", parsed.name);
    await next();
    return;
  }

  // Hit DB
  const [key] = await db`
    SELECT id, name, revoked_at
    FROM api_keys
    WHERE key_hash = ${keyHash}
    LIMIT 1
  `;

  if (!key || key["revoked_at"]) {
    await redis.setex(`auth:${keyHash}`, CACHE_TTL, "invalid");
    return c.json({ error: "Invalid API key", code: "UNAUTHORIZED" }, 401);
  }

  // Update last_used_at async (don't block the request)
  db`UPDATE api_keys SET last_used_at = NOW() WHERE id = ${key["id"]}`.catch(() => {});

  const payload = { id: key["id"] as string, name: key["name"] as string };
  await redis.setex(`auth:${keyHash}`, CACHE_TTL, JSON.stringify(payload));

  c.set("apiKeyId", payload.id);
  c.set("apiKeyName", payload.name);
  await next();
}
