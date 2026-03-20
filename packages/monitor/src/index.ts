/**
 * @theminutes/monitor
 *
 * Responsibilities (Agent Monitor):
 *  1. HealthMonitor class:
 *     - recordPing(providerId, latencyMs | null, success) → void
 *       Inserts a row into health_pings table
 *     - recordLatency(providerId, latencyMs) → void
 *       Called by Agent Proxy after every successful routed request (passive tracking)
 *     - getHealth(providerId) → { p50, p90, p99, uptime, lastSeen }
 *       Reads from health_pings (last 24h)
 *     - getLeaderboard(category) → ProviderWithMetrics[] sorted by p50 ASC
 *
 *  2. Prober — background process:
 *     - startProber(intervalMs = 30_000) → () => void (stop fn)
 *     - Fetches all active providers from DB
 *     - For each provider, sends a HEAD request to provider.endpoint
 *     - Records result via recordPing()
 *     - Handles timeouts (5s), treats timeout as failure
 *
 * Storage: health_pings table — see packages/api/src/db/schema.sql
 * DB client: import { db } from "../../api/src/db/client"
 *   OR accept db as a constructor arg for testability (preferred)
 *
 * Tests must cover:
 *  - recordPing writes to DB correctly
 *  - getHealth returns correct p50/p90/p99/uptime from known ping data
 *  - Uptime calculation: (successes / total) * 100 over 24h
 *  - getLeaderboard returns providers sorted by p50 ASC
 */

export { HealthMonitor } from "./health-monitor";
export { startProber } from "./prober";
