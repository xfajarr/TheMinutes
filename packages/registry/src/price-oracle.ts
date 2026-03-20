import type { Redis } from "ioredis";
import type { Sql } from "postgres";
import type { ServiceCategory } from "@theminutes/types";

let _redis: Redis;
function getRedis(): Redis {
  if (!_redis) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { redis: importedRedis } = require("../api/src/cache/client");
    _redis = importedRedis;
  }
  return _redis;
}

let _db: Sql;
function getDb(): Sql {
  if (!_db) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { db: importedDb } = require("../api/src/db/client");
    _db = importedDb;
  }
  return _db;
}

const PRICE_KEY_PREFIX = "price:";
const PRICE_TTL_SECONDS = 60;

export class PriceOracle {
  constructor(
    private readonly redis: Redis = getRedis(),
    private readonly db: Sql = getDb(),
  ) {}

  async getPrice(providerId: string): Promise<number | null> {
    const cached = await this.redis.get(`${PRICE_KEY_PREFIX}${providerId}`);
    if (cached !== null) return parseFloat(cached);

    const provider = await this.probeProvider(providerId);
    return provider;
  }

  async getPrices(category: ServiceCategory): Promise<Record<string, number>> {
    const rows = await this.db<ProviderRow[]>`
      SELECT id, endpoint FROM providers
      WHERE category = ${category}
        AND status != 'inactive'
    `;

    const results: Record<string, number> = {};
    await Promise.all(
      rows.map(async (row) => {
        const price = await this.getPrice(row.id);
        if (price !== null) {
          results[row.id] = price;
        }
      }),
    );
    return results;
  }

  async refreshAll(): Promise<void> {
    const rows = await this.db<ProviderRow[]>`
      SELECT id FROM providers WHERE status != 'inactive'
    `;
    await Promise.all(rows.map((row) => this.getPrice(row.id)));
  }

  private async probeProvider(providerId: string): Promise<number | null> {
    const rows = await this.db<ProviderRow[]>`
      SELECT endpoint FROM providers WHERE id = ${providerId}
    `;
    if (rows.length === 0) return null;
    const endpoint = rows[0]!.endpoint;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);

      const res = await fetch(endpoint, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeout);

      const priceHeader = res.headers.get("x-mpp-price");
      if (priceHeader !== null) {
        const price = parseFloat(priceHeader);
        if (!isNaN(price)) {
          await this.redis.setex(
            `${PRICE_KEY_PREFIX}${providerId}`,
            PRICE_TTL_SECONDS,
            price.toString(),
          );
          return price;
        }
      }

      if (res.status === 402) {
        const bodyText = await res.text();
        const price = parsePriceFromBody(bodyText);
        if (price !== null) {
          await this.redis.setex(
            `${PRICE_KEY_PREFIX}${providerId}`,
            PRICE_TTL_SECONDS,
            price.toString(),
          );
          return price;
        }
      }
    } catch {
      // probe failed — return null
    }

    return null;
  }
}

interface ProviderRow {
  id: string;
  endpoint: string;
}

function parsePriceFromBody(body: string): number | null {
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed.price === "number") return parsed.price;
    if (typeof parsed.amount === "number") return parsed.amount;
    if (typeof parsed.cost === "number") return parsed.cost;
  } catch {
    // not JSON
  }

  const match = body.match(/(\d+\.?\d*)\s*(?:USD|\$)/);
  if (match) {
    const price = parseFloat(match[1]!);
    if (!isNaN(price)) return price;
  }

  return null;
}

export const priceOracle = new PriceOracle();
