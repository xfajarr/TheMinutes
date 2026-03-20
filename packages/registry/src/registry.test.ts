import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sql } from "postgres";
import type { ServiceCategory } from "@theminutes/types";

const sharedResults = {
  queue: [] as unknown[][],
  reset(results: unknown[][]) {
    this.queue = results;
    this.callCount = 0;
  },
  callCount: 0,
};

function unsafeFn(_query: string, _params?: unknown[]) {
  const result = sharedResults.queue[sharedResults.callCount] ?? [];
  sharedResults.callCount++;
  return Promise.resolve(result as unknown[]) as ReturnType<Sql["unsafe"]>;
}

function makeMockDb(): Sql & { reset: (r: unknown[][]) => void } {
  const db = function (
    _strings: TemplateStringsArray,
    ..._values: unknown[]
  ): unknown {
    const result = sharedResults.queue[sharedResults.callCount] ?? [];
    sharedResults.callCount++;
    return Promise.resolve(result) as unknown;
  } as unknown as Sql & { reset: (r: unknown[][]) => void };

  db.reset = sharedResults.reset.bind(sharedResults);
  db.unsafe = unsafeFn as Sql["unsafe"];
  return db;
}

const mockDb = makeMockDb();

vi.mock("../api/src/db/client", () => ({
  get db() {
    return mockDb;
  },
}));

vi.mock("../api/src/cache/client", () => ({
  get redis() {
    return {
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue("OK"),
    };
  },
}));

const sampleProvider = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Parallel Web Systems",
  category: "web-search",
  endpoint: "https://parallelmpp.dev",
  rails: ["tempo"],
  base_price: "0.010000",
  currency: "USD",
  capabilities: ["search", "extract"],
  status: "active",
  source: "tempo-directory",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const anthropicProvider = {
  ...sampleProvider,
  id: "22222222-2222-2222-2222-222222222222",
  name: "Anthropic",
  category: "ai-model",
  endpoint: "https://anthropic.mpp.tempo.xyz",
  base_price: "0.015000",
};

describe("ServiceRegistry", () => {
  beforeEach(() => {
    sharedResults.callCount = 0;
  });

  describe("register", () => {
    it("creates a new provider", async () => {
      mockDb.reset([[sampleProvider]]);
      const { ServiceRegistry } = await import("./registry");
      const registry = new ServiceRegistry(mockDb);

      const result = await registry.register({
        name: "Parallel Web Systems",
        category: "web-search",
        endpoint: "https://parallelmpp.dev",
        rails: ["tempo"],
        basePrice: 0.01,
        capabilities: ["search", "extract"],
      });

      expect(result.id).toBe(sampleProvider.id);
      expect(result.name).toBe("Parallel Web Systems");
      expect(result.category).toBe("web-search");
      expect(result.basePrice).toBe(0.01);
      expect(result.currency).toBe("USD");
      expect(result.status).toBe("active");
    });
  });

  describe("list", () => {
    it("returns all active providers when no filter", async () => {
      mockDb.reset([[sampleProvider, anthropicProvider]]);
      const { ServiceRegistry } = await import("./registry");
      const registry = new ServiceRegistry(mockDb);

      const result = await registry.list();

      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe("Parallel Web Systems");
      expect(result[1]!.name).toBe("Anthropic");
    });

    it("filters by category correctly", async () => {
      mockDb.reset([[anthropicProvider]]);
      const { ServiceRegistry } = await import("./registry");
      const registry = new ServiceRegistry(mockDb);

      const result = await registry.list({
        category: "ai-model" as ServiceCategory,
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("Anthropic");
      expect(result[0]!.category).toBe("ai-model");
    });
  });

  describe("get", () => {
    it("returns provider by id", async () => {
      mockDb.reset([[sampleProvider]]);
      const { ServiceRegistry } = await import("./registry");
      const registry = new ServiceRegistry(mockDb);

      const result = await registry.get(sampleProvider.id);

      expect(result).not.toBeNull();
      expect(result!.name).toBe("Parallel Web Systems");
    });

    it("returns null for unknown id", async () => {
      mockDb.reset([[]]);
      const { ServiceRegistry } = await import("./registry");
      const registry = new ServiceRegistry(mockDb);

      const result = await registry.get("00000000-0000-0000-0000-000000000000");

      expect(result).toBeNull();
    });
  });
});
