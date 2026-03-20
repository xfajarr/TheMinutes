import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sql } from "postgres";
import type { RoutingDecision, ServiceCategory } from "@theminutes/types";
import { MppProxy } from "./proxy";
import { TakeRateAccumulator, setDb as setTakeRateDb } from "./take-rate";
import { ProxyError } from "./errors";

const sharedDb = {
  queue: [] as unknown[][],
  reset(results: unknown[][]) {
    this.queue = results;
    this.callCount = 0;
  },
  callCount: 0,
};

function makeMockDb(): Sql & { reset: (r: unknown[][]) => void } {
  const db = function (
    _strings: TemplateStringsArray,
    ..._values: unknown[]
  ): unknown {
    const result = sharedDb.queue[sharedDb.callCount] ?? [];
    sharedDb.callCount++;
    return Promise.resolve(result) as unknown;
  } as unknown as Sql & { reset: (r: unknown[][]) => void };

  db.reset = sharedDb.reset.bind(sharedDb);
  db.unsafe = (async (_query: string, _params?: unknown[]) => {
    const result = sharedDb.queue[sharedDb.callCount] ?? [];
    sharedDb.callCount++;
    return result as unknown;
  }) as Sql["unsafe"];
  return db;
}

const mockDb = makeMockDb();
setTakeRateDb(mockDb);

const TAKE_RATE_AMOUNT = 0.001;

type Candidate = {
  provider: {
    id: string;
    name: string;
    category: ServiceCategory;
    endpoint: string;
    rails: ("tempo" | "stripe" | "lightning" | "visa")[];
    basePrice: number;
    currency: "USD";
    capabilities: string[];
    status: "active" | "inactive" | "degraded";
    createdAt: string;
    updatedAt: string;
    latency: { p50: number | null; p90: number | null; p99: number | null };
    uptime: number | null;
    lastSeen: string | null;
  };
  rank: number;
  score: number;
  reason: string;
};

function makeCandidate(id: string, name: string, basePrice: number): Candidate {
  return {
    provider: {
      id,
      name,
      category: "ai-model",
      endpoint: `https://${id}.example.com`,
      rails: ["tempo"],
      basePrice,
      currency: "USD",
      capabilities: [],
      status: "active",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      latency: { p50: 100, p90: 200, p99: 500 },
      uptime: 99,
      lastSeen: "2026-01-01T00:00:00Z",
    },
    rank: 1,
    score: 1,
    reason: `Cheapest at $${basePrice}/req`,
  };
}

function makeDecision(candidates: Candidate[]): RoutingDecision {
  return {
    selected: candidates[0]!,
    candidates,
    strategy: "cheapest",
    constraints: {},
  };
}

function mockFetch(response: Partial<Response>, status = 200) {
  const mockResponse = {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ result: "ok" }),
    text: async () => '{"result":"ok"}',
    headers: new Headers(),
  };
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ...mockResponse,
    ...response,
    status,
  } as Response);
}

describe("MppProxy", () => {
  beforeEach(() => {
    sharedDb.callCount = 0;
    vi.restoreAllMocks();
  });

  describe("execute", () => {
    it("adds exactly TAKE_RATE_AMOUNT as take rate", async () => {
      mockDb.reset([[]]);
      mockFetch({ ok: true, status: 200 });

      const proxy = new MppProxy(mockDb, new TakeRateAccumulator(mockDb));
      const decision = makeDecision([makeCandidate("p1", "Provider 1", 0.01)]);

      const result = await proxy.execute(decision, { query: "test" }, "req-1");

      expect(result._routing.takeRate).toBe(TAKE_RATE_AMOUNT);
      expect(result._routing.providerCost).toBe(0.01);
      expect(result._routing.totalCost).toBe(0.01 + TAKE_RATE_AMOUNT);
    });

    it("records spend in spend_records table", async () => {
      mockDb.reset([[]]);
      mockFetch({ ok: true, status: 200 });

      const proxy = new MppProxy(mockDb, new TakeRateAccumulator(mockDb));
      const decision = makeDecision([makeCandidate("p1", "Provider 1", 0.005)]);

      await proxy.execute(decision, { query: "test" }, "req-2");

      expect(sharedDb.callCount).toBeGreaterThan(0);
    });

    it("records take rate event", async () => {
      mockDb.reset([[], [], [], []]);
      mockFetch({ ok: true, status: 200 });
      const takeRate = new TakeRateAccumulator(mockDb);
      const proxy = new MppProxy(mockDb, takeRate);
      const decision = makeDecision([makeCandidate("p1", "Provider 1", 0.01)]);

      await proxy.execute(decision, { query: "test" }, "req-3");

      expect(sharedDb.callCount).toBe(4);
    });

    it("returns idempotent result for same requestId", async () => {
      mockDb.reset([
        [
          {
            provider_id: "p1",
            provider_name: "Cached Provider",
            strategy: "cheapest",
            reason: "Cheapest",
            provider_cost: "0.01",
            take_rate: String(TAKE_RATE_AMOUNT),
            total_cost: String(0.01 + TAKE_RATE_AMOUNT),
            latency_ms: "45",
          },
        ],
      ]);
      const fetchSpy = mockFetch({ ok: true, status: 200 });

      const proxy = new MppProxy(mockDb, new TakeRateAccumulator(mockDb));
      const decision = makeDecision([makeCandidate("p1", "Provider 1", 0.01)]);

      const result = await proxy.execute(
        decision,
        { query: "test" },
        "req-idempotent",
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result._routing.providerName).toBe("Cached Provider");
    });

    it("falls back to next candidate when primary returns 500", async () => {
      let callCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 502,
            json: async () => ({}),
            headers: new Headers(),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ result: "fallback" }),
          headers: new Headers(),
        } as unknown as Response;
      });

      mockDb.reset([[], []]);
      const proxy = new MppProxy(mockDb, new TakeRateAccumulator(mockDb));
      const decision = makeDecision([
        makeCandidate("p1", "Primary", 0.01),
        makeCandidate("p2", "Fallback", 0.02),
      ]);

      const result = await proxy.execute(
        decision,
        { query: "test" },
        "req-fallback",
      );

      expect(result._routing.providerName).toBe("Fallback");
    });

    it("throws ProxyError when all candidates fail", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({}),
        headers: new Headers(),
      } as unknown as Response);

      mockDb.reset([]);
      const proxy = new MppProxy(mockDb, new TakeRateAccumulator(mockDb));
      const decision = makeDecision([
        makeCandidate("p1", "Fail 1", 0.01),
        makeCandidate("p2", "Fail 2", 0.02),
      ]);

      await expect(
        proxy.execute(decision, { query: "test" }, "req-all-fail"),
      ).rejects.toThrow(ProxyError);
    });

    it("ProxyError has code ALL_PROVIDERS_FAILED", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
        headers: new Headers(),
      } as unknown as Response);

      mockDb.reset([]);
      const proxy = new MppProxy(mockDb, new TakeRateAccumulator(mockDb));
      const decision = makeDecision([makeCandidate("p1", "Fail", 0.01)]);

      try {
        await proxy.execute(decision, { query: "test" }, "req-err");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ProxyError);
        expect((err as ProxyError).code).toBe("ALL_PROVIDERS_FAILED");
      }
    });
  });
});

describe("TakeRateAccumulator", () => {
  beforeEach(() => {
    sharedDb.callCount = 0;
    vi.restoreAllMocks();
  });

  describe("record", () => {
    it("inserts take rate event", async () => {
      mockDb.reset([[]]);
      const accumulator = new TakeRateAccumulator(mockDb);

      await accumulator.record("req-1", 0.001);

      expect(sharedDb.callCount).toBe(1);
    });
  });

  describe("getBalance", () => {
    it("returns sum of unsettled events", async () => {
      mockDb.reset([[{ balance: "0.005" }]]);
      const accumulator = new TakeRateAccumulator(mockDb);

      const balance = await accumulator.getBalance();

      expect(balance).toBe(0.005);
    });

    it("returns 0 when no events", async () => {
      mockDb.reset([[{ balance: "0" }]]);
      const accumulator = new TakeRateAccumulator(mockDb);

      const balance = await accumulator.getBalance();

      expect(balance).toBe(0);
    });
  });

  describe("settle", () => {
    it("marks all events as settled", async () => {
      mockDb.reset([[]]);
      const accumulator = new TakeRateAccumulator(mockDb);

      await accumulator.settle();

      expect(sharedDb.callCount).toBe(1);
    });
  });
});
