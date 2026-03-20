import type { Sql } from "postgres";
import { HealthMonitor } from "./health-monitor";

let _db: Sql;
function getDb(): Sql {
  if (!_db) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { db: importedDb } = require("../api/src/db/client");
    _db = importedDb;
  }
  return _db;
}

interface ProviderRow {
  id: string;
  endpoint: string;
}

export function startProber(
  db: Sql = getDb(),
  intervalMs = 30_000,
): () => void {
  const monitor = new HealthMonitor(db);
  let stopped = false;

  async function probe() {
    if (stopped) return;

    const rows = await db<ProviderRow[]>`
      SELECT id, endpoint FROM providers WHERE status != 'inactive'
    `;

    await Promise.all(
      rows.map(async (row) => {
        const { id, endpoint } = row;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5_000);

          const start = Date.now();
          const res = await fetch(endpoint, {
            method: "HEAD",
            signal: controller.signal,
            redirect: "follow",
          });
          clearTimeout(timeout);

          const latencyMs = Date.now() - start;
          await monitor.recordPing(id, latencyMs, res.ok);
        } catch {
          await monitor.recordPing(id, null, false);
        }
      }),
    );
  }

  probe();

  const interval = setInterval(() => {
    if (stopped) {
      clearInterval(interval);
      return;
    }
    probe();
  }, intervalMs);

  return () => {
    stopped = true;
    clearInterval(interval);
  };
}
