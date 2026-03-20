# TheMinutes — Agent Task List

> Monorepo is bootstrapped. All package skeletons, types, DB schema, auth middleware,
> and API routes are in place. Each agent picks one task and implements it.
>
> Working dir: `/Users/xfajarr/TheMinutes`
> Stack: Bun + TypeScript + Turborepo + Hono + PostgreSQL + Redis
> Start infra: `docker compose up -d`
> Install: `bun install`
> Dev API: `cd packages/api && bun dev`

---

## Task 1 — Agent Registry
**Package**: `packages/registry/`
**Status**: `pending`

Implement the three files in `packages/registry/src/`:

### registry.ts — `ServiceRegistry` class
```ts
register(input: ProviderRegistrationInput): Promise<Provider>
list(filter?: { category?: ServiceCategory }): Promise<Provider[]>
get(id: string): Promise<Provider | null>
update(id: string, patch: Partial<Provider>): Promise<Provider>
remove(id: string): Promise<void>
```
- Uses `db` from `packages/api/src/db/client.ts`
- Deduplicates by `endpoint` (`ON CONFLICT (endpoint) DO UPDATE`)

### price-oracle.ts — `PriceOracle` class
```ts
getPrice(providerId: string): Promise<number | null>
getPrices(category: ServiceCategory): Promise<Record<string, number>>
refreshAll(): Promise<void>
```
- Cache in Redis: key `price:{providerId}`, TTL 60s
- Probe: HEAD request to `provider.endpoint`, read `X-MPP-Price` header or parse 402 body

### crawler.ts — `startCrawler()` function
- Crawls `https://tempo.xyz/ecosystem` + `https://mpp.dev` on startup
- Upserts providers via `registry.register()`
- Re-runs every 15 minutes
- Seeds at minimum: Parallel Web Systems, Browserbase, Alchemy, Dune Analytics, Anthropic, OpenAI

### Tests
File: `packages/registry/src/registry.test.ts`
- `register()` creates provider
- `list({ category })` filters correctly
- Same endpoint → update, not duplicate
- `get()` returns null for unknown id

```bash
cd packages/registry && bun test
```

---

## Task 2 — Agent Router
**Package**: `packages/router/`
**Status**: `pending`
**Note**: Pure TypeScript — NO DB, NO network, NO side effects. Can start immediately.

Implement `packages/router/src/engine.ts`:

```ts
export function route(
  candidates: ProviderWithMetrics[],
  strategy: RoutingStrategy,
  constraints?: RoutingConstraints
): RoutingDecision
```

### Constraints (filter BEFORE scoring)
| Constraint | Behavior |
|---|---|
| `maxPrice` | Exclude providers where `basePrice > maxPrice` |
| `whitelist` | Keep only providers whose `id` is in the list |
| `blacklist` | Remove providers whose `id` is in the list |
| `minUptime` | Exclude providers where `uptime < minUptime` (null uptime = exclude) |

If zero candidates remain → throw `new RoutingError("NO_PROVIDERS", "...")`

### Scoring
- `cheapest`: `score = 1 - (price / maxPriceInSet)`. Lower price = higher score.
- `fastest`: `score = 1 - (p50 / maxP50InSet)`. Null p50 = score 0.5.
- `balanced`: `0.5 * cheapestScore + 0.5 * fastestScore`

### Output per candidate
```ts
{ provider, rank, score, reason }
// reason examples:
// "Cheapest at $0.010/req"
// "Best p50 latency at 82ms"
// "Balanced score 0.87 (price: 0.91, latency: 0.83)"
```

### Tests
File: `packages/router/src/engine.test.ts`
- All 3 strategies return correct order
- Each constraint filters correctly
- Combined constraints work together
- `RoutingError("NO_PROVIDERS")` thrown when all filtered out
- Every candidate has `rank`, `score` (0–1), non-empty `reason`

```bash
cd packages/router && bun test
```

---

## Task 3 — Agent Monitor
**Package**: `packages/monitor/`
**Status**: `pending`
**Note**: Can start immediately. Accept `db` as constructor arg for testability.

### health-monitor.ts — `HealthMonitor` class
```ts
constructor(db: postgres.Sql)

recordPing(providerId: string, latencyMs: number | null, success: boolean): Promise<void>
recordLatency(providerId: string, latencyMs: number): Promise<void>  // called by proxy
getHealth(providerId: string): Promise<{
  p50: number | null, p90: number | null, p99: number | null,
  uptime: number | null, lastSeen: string | null
}>
getLeaderboard(category: string): Promise<ProviderWithMetrics[]>
```
- `recordPing` → INSERT into `health_pings`
- `getHealth` → query last 24h pings, compute percentiles + uptime %
- `uptime` = `(successes / total) * 100`

### prober.ts — `startProber(db, intervalMs = 30_000)`
- Fetch all active providers from DB every `intervalMs`
- HEAD request to each `provider.endpoint` with 5s timeout
- Call `healthMonitor.recordPing(id, latencyMs, success)`
- Use `Promise.allSettled` (one provider failing doesn't block others)
- Returns a `() => void` stop function

### Tests
File: `packages/monitor/src/health-monitor.test.ts`
- `recordPing` writes correct row
- `getHealth` returns correct p50/p90/p99 from known data
- `uptime = 75` when 3 of 4 pings succeed
- Nulls returned when no pings exist

```bash
cd packages/monitor && bun test
```

---

## Task 4 — Agent Proxy
**Package**: `packages/proxy/`
**Status**: `pending — depends on Task 2 (Router) being done`

### proxy.ts — `MppProxy` class
```ts
constructor(db: postgres.Sql)

execute(
  decision: RoutingDecision,
  params: Record<string, unknown>,
  requestId: string
): Promise<RouteResult>
```

**Flow:**
1. Check idempotency: if `requestId` exists in `spend_records` → return cached result
2. Iterate `decision.candidates` in rank order:
   - Use `mppx` to call `provider.endpoint` with params (handles 402 automatically)
   - Add `TAKE_RATE_AMOUNT` ($0.001) on top of provider payment
   - On success: record spend + take rate, return `RouteResult`
   - On failure (timeout 10s / 5xx): try next candidate
3. All fail → throw `ProxyError("ALL_PROVIDERS_FAILED", "...")`

**`RouteResult._routing`** must include:
`providerId, providerName, strategy, reason, providerCost, takeRate, totalCost, latencyMs`

### take-rate.ts — `TakeRateAccumulator` class
```ts
record(requestId: string, amount: number): Promise<void>
getBalance(): Promise<number>
settle(): Promise<void>  // marks events settled + sends to OPERATOR_WALLET_ADDRESS
startAutoSettle(thresholdUsd = 1.0, intervalMs = 3_600_000): () => void
```

### Also wire `packages/api/src/routes/route.ts`
Replace the 501 stubs:
- `GET /v1/route/preview` → fetch providers from registry → `route()` → return `decision.candidates`
- `POST /v1/route` → fetch providers → `route()` → `proxy.execute()` → return `RouteResult`

### Environment variables
```
TEMPO_PRIVATE_KEY=
OPERATOR_WALLET_ADDRESS=
TAKE_RATE_AMOUNT=0.001
TAKE_RATE_SETTLE_THRESHOLD=1.00
```

### Tests
File: `packages/proxy/src/proxy.test.ts`
- `execute()` adds exactly `0.001` take rate
- Idempotent: same `requestId` → same result, no re-execution
- Falls back to next candidate when primary returns 500
- `ProxyError` thrown when all candidates fail
- `TakeRateAccumulator.settle()` marks all events settled

```bash
cd packages/proxy && bun test
```

---

## Task 5 — Agent SDK+MCP
**Package**: `packages/sdk/`, `packages/mcp/`
**Status**: `pending — depends on Task 4 (Proxy/API) being wired`

### SDK — `packages/sdk/src/router.ts`
Already scaffolded. Verify it works end-to-end:
- `createRouter({ apiKey, strategy, constraints })` → `Router`
- `router.fetch(serviceType, params, overrides?)` → `POST /v1/route`
- `router.list(serviceType)` → `GET /v1/services/:category`
- `router.preview(serviceType, overrides?)` → `GET /v1/route/preview`
- All errors throw `TheMinutesError(message, code, statusCode)`
- **Zero Node.js built-ins** — must work in Cloudflare Workers

### MCP Server — `packages/mcp/src/server.ts`
Register all 6 tools using `@modelcontextprotocol/sdk`:

| Tool | Method |
|---|---|
| `list_services({ category? })` | `router.list(category)` |
| `get_price({ serviceType })` | `router.list(serviceType)` → price fields only |
| `preview_route({ serviceType, strategy? })` | `router.preview(serviceType, { strategy })` |
| `route_request({ serviceType, params, strategy? })` | `router.fetch(...)` |
| `get_spend({ period? })` | `GET /v1/spend?period=...` |
| `get_wallet()` | `GET /v1/wallet` |

Config from env: `THEMINUTES_API_KEY`, `THEMINUTES_STRATEGY`, `THEMINUTES_BASE_URL`

### Tests
File: `packages/sdk/src/sdk.test.ts`
- `createRouter()` throws if `apiKey` missing
- `router.fetch()` sends correct POST body
- `router.list()` calls correct endpoint
- `router.preview()` sends strategy param
- `TheMinutesError` thrown on 4xx/5xx

```bash
cd packages/sdk && bun test
```

---

## Task 6 — Agent Dashboard
**Package**: `apps/dashboard/`
**Status**: `pending — can start immediately with API contract`

```bash
cd apps/dashboard
bunx create-next-app@latest . --typescript --tailwind --app --no-src-dir
bun add @theminutes/types
```

### Pages (App Router)
| Route | Content |
|---|---|
| `/` | Service Browser — provider cards with name, category, price, latency, uptime, rails. Filter tabs by category. Auto-refresh 60s. |
| `/register` | Provider Registration form → POST /v1/providers/register |
| `/monitor` | Spending charts (stub: "coming soon") |
| `/wallet` | Wallet balance + earnings (stub) |
| `/keys` | API Key management (stub) |

### Design
- Dark theme (TVA/Miss Minutes aesthetic — dark backgrounds, gold accents)
- Sidebar navigation
- `NEXT_PUBLIC_API_URL` env var for API base URL (default: `http://localhost:3000`)

```bash
# dev
cd apps/dashboard && bun dev  # runs on port 3001
```

No tests needed (UI tested manually per PRD).

---

## Dependency Order

```
[Task 2 Router]  ──┐
[Task 1 Registry] ─┤
[Task 3 Monitor] ──┴──► [Task 4 Proxy] ──► [Task 5 SDK+MCP]
[Task 6 Dashboard] ─────────────────────────────────────────► (wire to live API last)
```

Tasks 1, 2, 3, 6 can all start in parallel immediately.
Task 4 needs Task 2 done.
Task 5 needs Task 4 done.
