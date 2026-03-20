/**
 * @theminutes/proxy
 *
 * Responsibilities (Agent Proxy):
 *  1. MppProxy class:
 *     - execute(decision: RoutingDecision, params: Record<string, unknown>, requestId: string)
 *       → RouteResult
 *
 *     Flow:
 *       a. Take decision.selected.provider as the first attempt
 *       b. Use mppx to send the request to provider.endpoint
 *       c. mppx handles the 402 challenge-response automatically
 *       d. Inject take rate: add TAKE_RATE_AMOUNT (default $0.001) on top of provider payment
 *       e. On success: record spend + take rate event, return RouteResult
 *       f. On failure (timeout / 5xx): retry with decision.candidates[1], [2], etc.
 *       g. If all candidates fail: throw ProxyError with code ALL_PROVIDERS_FAILED
 *
 *     Idempotency: if requestId already exists in spend_records, return the cached result
 *
 *  2. TakeRateAccumulator:
 *     - record(requestId, amount) → void
 *       Inserts into take_rate_events (append-only)
 *     - getBalance() → number (sum of unsettled take_rate_events)
 *     - settle() → void
 *       Marks all unsettled events as settled, sends accumulated amount to
 *       OPERATOR_WALLET_ADDRESS via Tempo/mppx
 *     - startAutoSettle(thresholdUsd, intervalMs) → () => void (stop fn)
 *       Calls settle() when balance >= thresholdUsd OR on interval
 *
 * Environment variables needed:
 *   TEMPO_PRIVATE_KEY     — operator signing key for take-rate settlement
 *   OPERATOR_WALLET_ADDRESS — destination for settlements
 *   TAKE_RATE_AMOUNT      — default 0.001
 *   TAKE_RATE_SETTLE_THRESHOLD — default 1.00
 *
 * DB client: accept db as constructor arg for testability
 * Types: RoutingDecision, RouteResult — from @theminutes/types
 *
 * Tests must cover:
 *  - execute() injects exactly TAKE_RATE_AMOUNT on every request
 *  - Idempotent: second call with same requestId returns same result without re-executing
 *  - Fallback: retries next candidate when primary fails
 *  - TakeRateAccumulator.settle() marks events as settled
 *  - Auto-settle triggers at threshold
 */

export { MppProxy } from "./proxy";
export { TakeRateAccumulator } from "./take-rate";
export { ProxyError } from "./errors";
export type { ProxyErrorCode } from "./errors";
