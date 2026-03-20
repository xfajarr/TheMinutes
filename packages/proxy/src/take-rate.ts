import type { Sql } from "postgres";

let _db: Sql;
function getDb(): Sql {
  if (!_db) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("../api/src/db/client") as { db: Sql };
    _db = mod.db;
  }
  return _db;
}

const TAKE_RATE_SETTLE_THRESHOLD = Number(
  process.env["TAKE_RATE_SETTLE_THRESHOLD"] ?? "1.00",
);

export function setDb(db: Sql) {
  _db = db;
}

export class TakeRateAccumulator {
  constructor(private readonly db: Sql = getDb()) {}

  async record(requestId: string, amount: number): Promise<void> {
    await this.db`
      INSERT INTO take_rate_events (request_id, amount, settled, created_at)
      VALUES (${requestId}, ${amount}, FALSE, NOW())
    `;
  }

  async getBalance(): Promise<number> {
    const rows = await this.db<{ balance: string }[]>`
      SELECT COALESCE(SUM(amount), 0) AS balance
      FROM take_rate_events
      WHERE settled = FALSE
    `;
    return parseFloat(rows[0]?.balance ?? "0");
  }

  async settle(): Promise<void> {
    await this.db`
      UPDATE take_rate_events
      SET settled = TRUE, settled_at = NOW()
      WHERE settled = FALSE
    `;
  }

  startAutoSettle(
    thresholdUsd = TAKE_RATE_SETTLE_THRESHOLD,
    intervalMs = 3_600_000,
  ): () => void {
    let stopped = false;

    const check = async () => {
      if (stopped) return;
      try {
        const balance = await this.getBalance();
        if (balance >= thresholdUsd) {
          await this.settle();
        }
      } catch (err) {
        console.error("[take-rate] auto-settle check failed:", err);
      }
    };

    check();

    const interval = setInterval(() => {
      if (stopped) {
        clearInterval(interval);
        return;
      }
      check();
    }, intervalMs);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }
}
