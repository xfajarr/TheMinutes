/**
 * @theminutes/router
 *
 * Pure TypeScript — NO database, NO network calls, NO side effects.
 * Takes candidates + strategy + constraints, returns a RoutingDecision.
 *
 * Responsibilities (Agent Router):
 *  1. Implement `route(candidates, strategy, constraints?)` → RoutingDecision
 *  2. Strategies:
 *     - "cheapest"  → sort by provider.basePrice ASC
 *     - "fastest"   → sort by provider.latency.p50 ASC (nulls last)
 *     - "balanced"  → weighted score: 0.5 * normalizedPrice + 0.5 * normalizedLatency
 *  3. Constraints (applied BEFORE scoring):
 *     - maxPrice   → filter out providers where basePrice > maxPrice
 *     - whitelist  → keep only providers whose id is in the list
 *     - blacklist  → remove providers whose id is in the list
 *     - minUptime  → filter out providers where uptime < minUptime
 *  4. Each candidate in the output must include: rank, score (0-1), reason string
 *  5. If all candidates are filtered out, throw a RoutingError with code NO_PROVIDERS
 *  6. Fallback: the RoutingDecision.candidates list (ranked) is used by Agent Proxy
 *     to retry the next provider on failure
 *
 * Types: ProviderWithMetrics, RoutingStrategy, RoutingConstraints,
 *        RankedProvider, RoutingDecision — all from @theminutes/types
 *
 * Tests must cover:
 *  - All 3 strategies return correct order
 *  - Each constraint correctly filters candidates
 *  - Combined constraints work together
 *  - RoutingError thrown when no candidates remain
 *  - Score + reason present on every candidate
 */

export { route } from "./engine";
export { RoutingError } from "./errors";
export type { RoutingErrorCode } from "./errors";
