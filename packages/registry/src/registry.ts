import type { Sql } from "postgres";
import type {
  Provider,
  ProviderRegistrationInput,
  ServiceCategory,
} from "@theminutes/types";

let _db: Sql;
function getDb(): Sql {
  if (!_db) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("../api/src/db/client") as { db: Sql };
    _db = mod.db;
  }
  return _db;
}

export class ServiceRegistry {
  constructor(private readonly client: Sql = getDb()) {}

  async register(input: ProviderRegistrationInput): Promise<Provider> {
    const rows = await this.client<ProviderRow[]>`
      INSERT INTO providers (name, category, endpoint, rails, base_price, capabilities, source)
      VALUES (
        ${input.name},
        ${input.category},
        ${input.endpoint},
        ${input.rails},
        ${input.basePrice},
        ${input.capabilities},
        'manual'
      )
      ON CONFLICT (endpoint) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        rails = EXCLUDED.rails,
        base_price = EXCLUDED.base_price,
        capabilities = EXCLUDED.capabilities,
        status = 'active',
        updated_at = NOW()
      RETURNING *
    `;
    const row = rows[0];
    if (!row) throw new Error("Failed to register provider");
    return rowToProvider(row);
  }

  async list(filter?: { category?: ServiceCategory }): Promise<Provider[]> {
    if (filter?.category) {
      const rows = await this.client<ProviderRow[]>`
        SELECT * FROM providers
        WHERE category = ${filter.category}
          AND status != 'inactive'
        ORDER BY name
      `;
      return rows.map(rowToProvider);
    }
    const rows = await this.client<ProviderRow[]>`
      SELECT * FROM providers
      WHERE status != 'inactive'
      ORDER BY name
    `;
    return rows.map(rowToProvider);
  }

  async get(id: string): Promise<Provider | null> {
    const rows = await this.client<ProviderRow[]>`
      SELECT * FROM providers WHERE id = ${id}
    `;
    const row = rows[0];
    if (!row) return null;
    return rowToProvider(row);
  }

  async update(id: string, patch: Partial<Provider>): Promise<Provider> {
    const cols: string[] = [];
    if (patch.name !== undefined) cols.push(`name = '${escape(patch.name)}'`);
    if (patch.category !== undefined)
      cols.push(`category = '${patch.category}'`);
    if (patch.endpoint !== undefined)
      cols.push(`endpoint = '${escape(patch.endpoint)}'`);
    if (patch.rails !== undefined)
      cols.push(`rails = '{${patch.rails.join(",")}}'`);
    if (patch.basePrice !== undefined)
      cols.push(`base_price = ${patch.basePrice}`);
    if (patch.capabilities !== undefined)
      cols.push(`capabilities = '{${patch.capabilities.join(",")}}'`);
    if (patch.status !== undefined) cols.push(`status = '${patch.status}'`);

    if (cols.length === 0) {
      const p = await this.get(id);
      if (!p) throw new Error(`Provider ${id} not found`);
      return p;
    }

    const [row] = (await this.client.unsafe(
      `UPDATE providers SET ${cols.join(", ")}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    )) as ProviderRow[];
    if (!row) throw new Error(`Provider ${id} not found`);
    return rowToProvider(row);
  }

  async remove(id: string): Promise<void> {
    await this.client`DELETE FROM providers WHERE id = ${id}`;
  }
}

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
  source: string;
  created_at: string;
  updated_at: string;
}

function rowToProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    endpoint: row.endpoint,
    rails: row.rails as Provider["rails"],
    basePrice: parseFloat(row.base_price),
    currency: "USD",
    capabilities: row.capabilities,
    status: row.status as Provider["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function escape(s: string): string {
  return s.replace(/'/g, "''");
}

export const registry = new ServiceRegistry();
