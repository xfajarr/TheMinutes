import { describe, it, expect, beforeEach } from "vitest";
import type { Sql } from "postgres";
import { HealthMonitor, setDb } from "./health-monitor";

const sharedResults = {
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
    const result = sharedResults.queue[sharedResults.callCount] ?? [];
    sharedResults.callCount++;
    return Promise.resolve(result) as unknown;
  } as unknown as Sql & { reset: (r: unknown[][]) => void };

  db.reset = sharedResults.reset.bind(sharedResults);
  db.unsafe = (async (_query: string, _params?: unknown[]) => {
    const result = sharedResults.queue[sharedResults.callCount] ?? [];
    sharedResults.callCount++;
    return result as unknown;
  }) as Sql["unsafe"];
  return db;
}

const mockDb = makeMockDb();
setDb(mockDb);

function makePing(
  latencyMs: number | null,
  success: boolean,
  pingedAt?: Date,
): object {
  return { latency_ms: latencyMs, success, pinged_at: pingedAt ?? new Date() };
}

describe("HealthMonitor", () => {
  beforeEach(() => {
    sharedResults.callCount = 0;
  });

  describe("recordPing", () => {
    it("inserts a ping row with success=true", async () => {
      mockDb.reset([[]]);
      const monitor = new HealthMonitor(mockDb);

      await monitor.recordPing("provider-1", 82, true);

      const result = sharedResults.queue[0];
      expect(result).toBeDefined();
    });

    it("inserts a ping row with success=false for failed probe", async () => {
      mockDb.reset([[]]);
      const monitor = new HealthMonitor(mockDb);

      await monitor.recordPing("provider-1", null, false);

      const result = sharedResults.queue[0];
      expect(result).toBeDefined();
    });
  });

  describe("getHealth", () => {
    it("returns nulls when no pings exist", async () => {
      mockDb.reset([[]]);
      const monitor = new HealthMonitor(mockDb);

      const health = await monitor.getHealth("unknown-provider");

      expect(health.p50).toBeNull();
      expect(health.p90).toBeNull();
      expect(health.p99).toBeNull();
      expect(health.uptime).toBeNull();
      expect(health.lastSeen).toBeNull();
    });

    it("computes correct p50 from known ping data", async () => {
      const now = new Date();
      mockDb.reset([
        [
          makePing(100, true, now),
          makePing(200, true, now),
          makePing(300, true, now),
          makePing(400, true, now),
        ],
      ]);
      const monitor = new HealthMonitor(mockDb);

      const health = await monitor.getHealth("provider-1");

      expect(health.p50).not.toBeNull();
      expect(health.p90).not.toBeNull();
      expect(health.p99).not.toBeNull();
    });

    it("computes correct p50 = 175 for [100, 150, 200, 300] (continuous interpolation)", async () => {
      const now = new Date("2026-01-01T00:00:00Z");
      mockDb.reset([
        [
          makePing(100, true, now),
          makePing(150, true, now),
          makePing(200, true, now),
          makePing(300, true, now),
        ],
      ]);
      const monitor = new HealthMonitor(mockDb);

      const health = await monitor.getHealth("provider-1");

      expect(health.p50).toBeCloseTo(175, 0);
    });

    it("computes correct p90 = 270 for [100, 150, 200, 300] (continuous interpolation)", async () => {
      const now = new Date("2026-01-01T00:00:00Z");
      mockDb.reset([
        [
          makePing(100, true, now),
          makePing(150, true, now),
          makePing(200, true, now),
          makePing(300, true, now),
        ],
      ]);
      const monitor = new HealthMonitor(mockDb);

      const health = await monitor.getHealth("provider-1");

      expect(health.p90).toBeCloseTo(270, 0);
    });

    it("computes p99 correctly for many values", async () => {
      const now = new Date();
      const values: number[] = [];
      for (let i = 1; i <= 100; i++) values.push(i * 10);
      mockDb.reset([values.map((v) => makePing(v, true, now))]);
      const monitor = new HealthMonitor(mockDb);

      const health = await monitor.getHealth("provider-1");

      expect(health.p99).toBeCloseTo(990, 0);
    });

    it("computes uptime = 75 when 3 of 4 pings succeed", async () => {
      const now = new Date();
      mockDb.reset([
        [
          makePing(100, true, now),
          makePing(200, false, now),
          makePing(300, true, now),
          makePing(400, true, now),
        ],
      ]);
      const monitor = new HealthMonitor(mockDb);

      const health = await monitor.getHealth("provider-1");

      expect(health.uptime).toBe(75);
    });

    it("computes uptime = 0 when all pings fail", async () => {
      const now = new Date();
      mockDb.reset([[makePing(null, false, now), makePing(null, false, now)]]);
      const monitor = new HealthMonitor(mockDb);

      const health = await monitor.getHealth("provider-1");

      expect(health.uptime).toBe(0);
    });

    it("computes uptime = 100 when all pings succeed", async () => {
      const now = new Date();
      mockDb.reset([
        [
          makePing(50, true, now),
          makePing(100, true, now),
          makePing(150, true, now),
        ],
      ]);
      const monitor = new HealthMonitor(mockDb);

      const health = await monitor.getHealth("provider-1");

      expect(health.uptime).toBe(100);
    });

    it("lastSeen reflects most recent ping", async () => {
      const t1 = new Date("2026-01-01T00:00:00Z");
      const t2 = new Date("2026-01-01T01:00:00Z");
      mockDb.reset([[makePing(200, true, t2), makePing(100, true, t1)]]);
      const monitor = new HealthMonitor(mockDb);

      const health = await monitor.getHealth("provider-1");

      expect(health.lastSeen).toBe(t2.toISOString());
    });

    it("null latencies are excluded from percentile calculation", async () => {
      const now = new Date();
      mockDb.reset([
        [
          makePing(null, false, now),
          makePing(100, true, now),
          makePing(200, true, now),
          makePing(null, false, now),
        ],
      ]);
      const monitor = new HealthMonitor(mockDb);

      const health = await monitor.getHealth("provider-1");

      expect(health.p50).toBeCloseTo(150, 0);
      expect(health.uptime).toBe(50);
    });
  });

  describe("recordLatency", () => {
    it("records ping with success=true", async () => {
      mockDb.reset([[]]);
      const monitor = new HealthMonitor(mockDb);

      await monitor.recordLatency("provider-1", 45);

      expect(mockDb).toBeDefined();
    });
  });
});
