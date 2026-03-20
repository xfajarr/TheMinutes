import { describe, it, expect } from "vitest";
import { route } from "./engine";
import { RoutingError } from "./errors";
import type { ProviderWithMetrics, RoutingStrategy } from "@theminutes/types";

function makeProvider(
  overrides: Partial<ProviderWithMetrics> = {},
): ProviderWithMetrics {
  return {
    id: overrides.id ?? "p1",
    name: overrides.name ?? "Provider 1",
    category: "ai-model",
    endpoint: "https://example.com",
    rails: ["tempo"],
    basePrice: overrides.basePrice ?? 0.01,
    currency: "USD",
    capabilities: [],
    status: "active",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    latency: overrides.latency ?? { p50: 100, p90: 200, p99: 500 },
    uptime: "uptime" in overrides ? (overrides.uptime as number | null) : 99.5,
    lastSeen: "2026-01-01T00:00:00Z",
  };
}

function makeSet(
  providers: Array<{
    id: string;
    basePrice: number;
    p50?: number | null;
    uptime?: number | null;
  }>,
): ProviderWithMetrics[] {
  return providers.map((p) =>
    makeProvider({
      id: p.id,
      basePrice: p.basePrice,
      latency: { p50: p.p50 !== undefined ? p.p50 : 100, p90: 200, p99: 500 },
      uptime: p.uptime !== undefined ? p.uptime : 99,
    }),
  );
}

describe("route", () => {
  describe("strategies", () => {
    it("cheapest: lowest price ranks first", () => {
      const providers = makeSet([
        { id: "p1", basePrice: 0.05 },
        { id: "p2", basePrice: 0.01 },
        { id: "p3", basePrice: 0.03 },
      ]);

      const result = route(providers, "cheapest");

      expect(result.candidates[0]!.provider.id).toBe("p2");
      expect(result.candidates[1]!.provider.id).toBe("p3");
      expect(result.candidates[2]!.provider.id).toBe("p1");
    });

    it("fastest: lowest p50 latency ranks first", () => {
      const providers = makeSet([
        { id: "p1", basePrice: 0.01, p50: 500 },
        { id: "p2", basePrice: 0.01, p50: 50 },
        { id: "p3", basePrice: 0.01, p50: 200 },
      ]);

      const result = route(providers, "fastest");

      expect(result.candidates[0]!.provider.id).toBe("p2");
      expect(result.candidates[1]!.provider.id).toBe("p3");
      expect(result.candidates[2]!.provider.id).toBe("p1");
    });

    it("fastest: null p50 gets score 0.5 and ranks above slow providers", () => {
      const providers = makeSet([
        { id: "p1", basePrice: 0.01, p50: 100 },
        { id: "p2", basePrice: 0.01, p50: null },
      ]);

      const result = route(providers, "fastest");

      const nullP50 = result.candidates.find((c) => c.provider.id === "p2")!;
      const hasP50 = result.candidates.find((c) => c.provider.id === "p1")!;
      expect(nullP50.score).toBe(0.5);
      expect(hasP50.score).toBe(0);
    });

    it("balanced: weights price and latency equally", () => {
      const providers = makeSet([
        { id: "cheapest-slow", basePrice: 0.001, p50: 1000 },
        { id: "expensive-fast", basePrice: 0.05, p50: 10 },
        { id: "mid-both", basePrice: 0.025, p50: 100 },
      ]);

      const result = route(providers, "balanced");

      expect(result.candidates.length).toBe(3);
      expect(result.candidates[0]!.score).toBeGreaterThan(0);
      expect(result.candidates[0]!.score).toBeLessThanOrEqual(1);
    });

    it("all strategies assign scores between 0 and 1", () => {
      const providers = makeSet([
        { id: "p1", basePrice: 0.01, p50: 100 },
        { id: "p2", basePrice: 0.02, p50: 200 },
      ]);

      for (const strategy of [
        "cheapest",
        "fastest",
        "balanced",
      ] as RoutingStrategy[]) {
        const result = route(providers, strategy);
        for (const c of result.candidates) {
          expect(c.score).toBeGreaterThanOrEqual(0);
          expect(c.score).toBeLessThanOrEqual(1);
        }
      }
    });

    it("all candidates have rank, score, and non-empty reason", () => {
      const providers = makeSet([
        { id: "p1", basePrice: 0.01, p50: 100 },
        { id: "p2", basePrice: 0.02, p50: 200 },
      ]);

      const result = route(providers, "balanced");

      for (const c of result.candidates) {
        expect(typeof c.rank).toBe("number");
        expect(c.rank).toBeGreaterThan(0);
        expect(typeof c.score).toBe("number");
        expect(c.score).toBeGreaterThanOrEqual(0);
        expect(c.score).toBeLessThanOrEqual(1);
        expect(c.reason.length).toBeGreaterThan(0);
      }
    });
  });

  describe("constraints", () => {
    it("maxPrice: excludes providers above threshold", () => {
      const providers = makeSet([
        { id: "cheap", basePrice: 0.005 },
        { id: "medium", basePrice: 0.02 },
        { id: "expensive", basePrice: 0.1 },
      ]);

      const result = route(providers, "cheapest", { maxPrice: 0.03 });

      expect(result.candidates.map((c) => c.provider.id)).toEqual([
        "cheap",
        "medium",
      ]);
      expect(
        result.candidates.find((c) => c.provider.id === "expensive"),
      ).toBeUndefined();
    });

    it("whitelist: keeps only specified provider ids", () => {
      const providers = makeSet([
        { id: "p1", basePrice: 0.01 },
        { id: "p2", basePrice: 0.02 },
        { id: "p3", basePrice: 0.03 },
      ]);

      const result = route(providers, "cheapest", {
        whitelist: ["p1", "p3"],
      });

      expect(result.candidates.map((c) => c.provider.id)).toEqual(["p1", "p3"]);
    });

    it("blacklist: removes specified provider ids", () => {
      const providers = makeSet([
        { id: "p1", basePrice: 0.01 },
        { id: "p2", basePrice: 0.02 },
        { id: "p3", basePrice: 0.03 },
      ]);

      const result = route(providers, "cheapest", {
        blacklist: ["p2"],
      });

      expect(result.candidates.map((c) => c.provider.id)).toEqual(["p1", "p3"]);
    });

    it("minUptime: excludes providers below threshold", () => {
      const providers = makeSet([
        { id: "reliable", basePrice: 0.01, uptime: 99.9 },
        { id: "degraded", basePrice: 0.005, uptime: 80 },
        { id: "ok", basePrice: 0.02, uptime: 95 },
      ]);

      const result = route(providers, "cheapest", { minUptime: 90 });

      expect(result.candidates.map((c) => c.provider.id)).toEqual([
        "reliable",
        "ok",
      ]);
      expect(
        result.candidates.find((c) => c.provider.id === "degraded"),
      ).toBeUndefined();
    });

    it("minUptime: null uptime is excluded", () => {
      const unknownProvider = makeProvider({
        id: "unknown",
        basePrice: 0.005,
        uptime: null,
      });
      const knownProvider = makeProvider({
        id: "known",
        basePrice: 0.01,
        uptime: 99,
      });
      expect(unknownProvider.uptime).toBeNull();
      expect(knownProvider.uptime).toBe(99);

      const providers = [unknownProvider, knownProvider];
      const result = route(providers, "cheapest", { minUptime: 90 });

      expect(result.candidates.map((c) => c.provider.id)).toEqual(["known"]);
    });
  });

  describe("combined constraints", () => {
    it("maxPrice + blacklist + minUptime work together", () => {
      const providers = makeSet([
        { id: "p1", basePrice: 0.005, uptime: 99 },
        { id: "p2", basePrice: 0.002, uptime: 85 },
        { id: "p3", basePrice: 0.03, uptime: 99 },
        { id: "p4", basePrice: 0.008, uptime: 99 },
      ]);

      const result = route(providers, "cheapest", {
        maxPrice: 0.01,
        blacklist: ["p2"],
        minUptime: 90,
      });

      expect(result.candidates.map((c) => c.provider.id)).toEqual(["p1", "p4"]);
    });

    it("whitelist + cheapest strategy selects cheapest from whitelist", () => {
      const providers = makeSet([
        { id: "p1", basePrice: 0.01 },
        { id: "p2", basePrice: 0.005 },
        { id: "p3", basePrice: 0.002 },
      ]);

      const result = route(providers, "cheapest", {
        whitelist: ["p1", "p3"],
      });

      expect(result.selected.provider.id).toBe("p3");
    });
  });

  describe("errors", () => {
    it("throws NO_PROVIDERS when all filtered out by maxPrice", () => {
      const providers = makeSet([
        { id: "p1", basePrice: 0.05 },
        { id: "p2", basePrice: 0.1 },
      ]);

      expect(() => route(providers, "cheapest", { maxPrice: 0.001 })).toThrow(
        RoutingError,
      );
    });

    it("throws NO_PROVIDERS when whitelist is empty after blacklist", () => {
      const providers = makeSet([{ id: "p1", basePrice: 0.01 }]);

      expect(() =>
        route(providers, "cheapest", { whitelist: ["p1"], blacklist: ["p1"] }),
      ).toThrow(RoutingError);
    });

    it("throws NO_PROVIDERS when all providers have uptime below minUptime", () => {
      const providers = makeSet([
        { id: "p1", basePrice: 0.01, uptime: 50 },
        { id: "p2", basePrice: 0.02, uptime: 60 },
      ]);

      expect(() => route(providers, "cheapest", { minUptime: 99 })).toThrow(
        RoutingError,
      );
    });

    it("RoutingError has correct code and message", () => {
      const providers = makeSet([{ id: "p1", basePrice: 1.0 }]);

      try {
        route(providers, "cheapest", { maxPrice: 0.001 });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(RoutingError);
        expect((err as RoutingError).code).toBe("NO_PROVIDERS");
        expect((err as RoutingError).message).toContain("filtered out");
      }
    });
  });

  describe("reason strings", () => {
    it("cheapest reason includes price", () => {
      const providers = makeSet([{ id: "p1", basePrice: 0.005 }]);

      const result = route(providers, "cheapest");
      expect(result.selected.reason).toContain("$0.005");
    });

    it("fastest reason includes latency", () => {
      const providers = makeSet([{ id: "p1", basePrice: 0.01, p50: 75 }]);

      const result = route(providers, "fastest");
      expect(result.selected.reason).toContain("75ms");
    });

    it("balanced reason includes both scores", () => {
      const providers = makeSet([{ id: "p1", basePrice: 0.01, p50: 50 }]);

      const result = route(providers, "balanced");
      expect(result.selected.reason).toContain("Balanced score");
      expect(result.selected.reason).toContain("price:");
      expect(result.selected.reason).toContain("latency:");
    });
  });
});
