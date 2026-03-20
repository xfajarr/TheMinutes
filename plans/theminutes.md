# Plan: TheMinutes — MPP Service Router

> Source PRD: `/TheMinutes/PRD.md`
> Stack: TypeScript monorepo (Turborepo)
> Target: 1-day multi-agent build

---

## Architectural Decisions

Durable decisions that apply across all phases:

- **Monorepo**: Turborepo with `packages/` workspace
- **API versioning**: All REST endpoints under `/v1/`
- **Auth**: Bearer API key (`Authorization: Bearer <key>`) on all REST endpoints
- **API framework**: Hono (edge-compatible, works on Cloudflare Workers + Node.js)
- **Dashboard**: Next.js (App Router)
- **Storage**:
  - PostgreSQL — providers, API keys, spend history, take-rate audit log
  - Redis — price cache (60s TTL), session state
- **MPP payments**: `mppx` handles 402 challenge-response; TheMinutes wraps it with take-rate injection
- **Operator wallet**: Privy server-side wallet for take-rate accumulation + auto-settlement to Tempo
- **Key models**: `Provider`, `ApiKey`, `RoutingDecision`, `RouteResult`, `SpendRecord`, `TakeRateEvent`
- **Provider schema**: `{ id, name, category, endpoint, rails, basePrice, currency, capabilities, status }`
- **Routes**:
  - `GET /v1/services`
  - `GET /v1/services/:category`
  - `GET /v1/services/:id`
  - `POST /v1/providers/register`
  - `GET /v1/route/preview`
  - `POST /v1/route`
  - `GET /v1/spend`
  - `GET /v1/wallet`
  - `POST /v1/keys`
  - `DELETE /v1/keys/:id`

---

## Agent Assignment Map

TheMinutes is built by **6 parallel agents** across 2 waves.

### Wave 1 — Parallel (all start simultaneously after monorepo init)

| Agent | Package(s) | Depends on |
|---|---|---|
| **Agent Infra** | `packages/api` skeleton + DB schema + auth middleware | Nothing — goes first |
| **Agent Registry** | `packages/registry` (Service Registry + Tempo crawler) | Infra schema |
| **Agent Router** | `packages/router` (Routing Engine — pure logic) | Nothing — pure TS, no external deps |
| **Agent Monitor** | `packages/monitor` (Health Monitor) | Nothing — can stub external calls |
| **Agent Dashboard** | `packages/dashboard` (Next.js skeleton + service browser) | Infra API contract |

### Wave 2 — After Wave 1 merges

| Agent | Package(s) | Depends on |
|---|---|---|
| **Agent Proxy** | `packages/proxy` (MPP Payment Proxy + Take Rate) | Router + Registry + mppx |
| **Agent SDK+MCP** | `packages/sdk` + `packages/mcp` | Final API contract |

### What YOU need to do
- Bootstrap the monorepo (Turborepo init, workspace config, shared tsconfig) — ~15 min
- Provide your Tempo wallet address + Privy API key to Agent Proxy
- Final integration pass: wire all packages into `packages/api`
- Deploy (Cloudflare Workers for API, Vercel for dashboard)

---

## Phase 1 — Monorepo Foundation + Service Registry

**User stories**: 1, 2, 7, 8, 9, 34, 35, 38, 39, 40, 41, 46

**Owner**: Agent Infra + Agent Registry (parallel, merge at end of phase)

### What to build

Stand up the Turborepo monorepo with shared TypeScript config. Agent Infra creates the PostgreSQL schema for `providers` and `api_keys`, the Hono API server skeleton with API key auth middleware, and wires up the three working endpoints for service discovery. Agent Registry builds the Service Registry module with full CRUD and the Tempo directory crawler that seeds providers on startup (re-crawls every 15 min). The dashboard service browser page queries `GET /v1/services` and renders provider cards with name, category, endpoint, and payment rails.

At the end of this phase, a developer can visit the dashboard, see all MPP services auto-populated from Tempo's directory, filter by category, and register a new provider via form or API.

### Acceptance criteria

- [ ] Turborepo monorepo boots with `turbo dev` starting all packages
- [ ] PostgreSQL migrations run cleanly from scratch
- [ ] `GET /v1/services` returns all providers with correct schema
- [ ] `GET /v1/services/:category` returns filtered results (e.g. `web-search`, `compute`, `data`, `ai-models`)
- [ ] `GET /v1/services/:id` returns single provider detail including payment rails
- [ ] `POST /v1/providers/register` creates a new provider and returns it
- [ ] All endpoints reject requests with missing/invalid API key with `401`
- [ ] Tempo directory crawler seeds at least the known launch-day providers on startup
- [ ] Crawler deduplicates — re-seeding does not create duplicate records
- [ ] Dashboard `/` page renders provider cards fetched from the API
- [ ] Dashboard `/register` page submits new provider via `POST /v1/providers/register`
- [ ] Service Registry unit tests pass: register, list, filter, dedup on re-seed

---

## Phase 2 — Routing Engine + Preview API

**User stories**: 11, 12, 13, 15, 16, 17, 18, 37

**Owner**: Agent Router (can start in parallel with Phase 1 — pure logic, no DB deps)

### What to build

The Routing Engine is a pure TypeScript module — no database, no network calls. It receives a list of candidates (providers with price + latency data) and a strategy, and returns a ranked `RoutingDecision` with a selected provider, the full ranked list, per-candidate scores, and a human-readable reason string.

Three built-in strategies: `cheapest` (sort by price), `fastest` (sort by p50 latency), `balanced` (weighted 0.5/0.5 score, configurable weights). Four constraints: `maxPrice` (filter out over-budget providers), `whitelist` (only these provider IDs), `blacklist` (exclude these provider IDs), `minUptime` (filter by uptime %).

`GET /v1/route/preview` wires the Routing Engine to the Registry — fetches live provider data, runs routing, returns the ranked list without executing any payment or request. This is the "show your work" endpoint agents use for transparency and manual selection.

At the end of this phase, an agent or developer can call `GET /v1/route/preview?service=web-search&strategy=cheapest` and get back a ranked list of providers with scores and reasoning — the core value proposition is visible.

### Acceptance criteria

- [ ] Routing Engine is a pure function: `route(candidates, strategy, constraints)` → `RoutingDecision`
- [ ] `cheapest` strategy returns providers sorted by base price ascending
- [ ] `fastest` strategy returns providers sorted by p50 latency ascending
- [ ] `balanced` strategy returns providers sorted by weighted score (default 0.5/0.5)
- [ ] `maxPrice` constraint excludes providers above the limit before scoring
- [ ] `whitelist` constraint excludes all providers not in the list
- [ ] `blacklist` constraint excludes all listed providers
- [ ] `minUptime` constraint excludes providers below the threshold
- [ ] Each candidate in the response includes: `providerId`, `score`, `rank`, `reason` string
- [ ] `GET /v1/route/preview` returns ranked list with all candidates and selected provider
- [ ] Strategy can be overridden per-request via query param or body
- [ ] Routing Engine unit tests cover all 3 strategies, all 4 constraints, and combined constraints
- [ ] Routing adds ≤ 50ms overhead on top of data fetch (measured in tests with mock data)

---

## Phase 3 — Price Oracle + Health Monitor

**User stories**: 3, 4, 5, 6

**Owner**: Agent Monitor (can start in parallel with Phase 1 — stubs provider list initially)

### What to build

The Price Oracle fetches and caches real-time pricing from each registered provider. It probes each provider's MPP payment spec header on a schedule, caches the result in Redis with a 60-second TTL, and falls back to the last-known price if a provider is unreachable. Prices are merged into all `GET /v1/services` responses.

The Health Monitor tracks uptime and latency two ways: active probing (pings each provider endpoint every 30 seconds, records success/failure and response time) and passive tracking (every routed request feeds actual latency back into the monitor). It computes and stores p50/p90/p99 latency, uptime percentage over rolling 24h, last-seen timestamp, and consecutive failure count. Health data is merged into `/v1/services` responses and used by the Routing Engine in Phase 2.

At the end of this phase, the service browser shows live prices and latency benchmarks, and the Routing Engine's `fastest` and `balanced` strategies have real data to work with.

### Acceptance criteria

- [ ] `GET /v1/services` response includes `price` and `latency` fields per provider
- [ ] Price data is cached in Redis with 60s TTL — second request within TTL does not re-fetch
- [ ] Price Oracle falls back to last-known price if provider probe fails
- [ ] Health Monitor pings each provider every 30s and records result
- [ ] Health Monitor computes p50/p90/p99 latency over last 24h
- [ ] Health Monitor computes uptime % over last 24h
- [ ] Passive latency from `POST /v1/route` (Phase 4) feeds back into Health Monitor
- [ ] Dashboard service browser shows live price and p50 latency per provider card
- [ ] Price Oracle unit tests: cache hit, cache miss, stale fallback
- [ ] Health Monitor unit tests: latency recording, uptime calculation, failure threshold

---

## Phase 4 — MPP Payment Proxy + Take Rate + Full Routing

**User stories**: 10, 14, 19, 20, 21, 22, 23, 36, 42, 43, 45

**Owner**: Agent Proxy (starts after Phase 1 + Phase 2 are complete)

### What to build

The MPP Payment Proxy is the execution layer. It takes a `RoutingDecision` from the Routing Engine and a caller's wallet config, then executes the full MPP 402 challenge-response cycle: forward request → receive 402 + payment spec → add $0.001 take rate to payment amount → sign credential → retry with credential → stream response. It manages MPP sessions for high-frequency callers (batches settlements) and deduplicates requests within a 30-second window for idempotency.

The Take Rate Accumulator records every $0.001 take-rate event to an append-only PostgreSQL log, tracks running balance, and auto-settles to the operator's Tempo wallet when balance exceeds $1.00 or every hour.

`POST /v1/route` is the full routing endpoint: runs the Routing Engine, executes the Proxy, records spend, returns the provider response plus routing metadata (which provider, why, total cost including take rate). On provider failure, automatically retries the next-ranked provider.

Dashboard gains the spending monitor page (charts by provider/time) and wallet page (take-rate earnings, Tempo balance, settlement history) plus spending alerts.

### Acceptance criteria

- [ ] `POST /v1/route` accepts `{ service, params, strategy?, constraints? }` and returns provider response
- [ ] Response includes `_routing` metadata: selected provider, reason, provider cost, take rate, total cost
- [ ] Take rate of exactly $0.001 is added to every routed payment
- [ ] Duplicate request within 30s window returns cached result (idempotency)
- [ ] On provider timeout or 5xx, automatically retries next-ranked provider
- [ ] `GET /v1/spend` returns caller's spend history with provider breakdown
- [ ] `GET /v1/wallet` returns operator take-rate balance and settlement history
- [ ] Take rate auto-settles to operator Tempo wallet when balance ≥ $1.00
- [ ] Every take-rate event has an entry in the append-only audit log
- [ ] Dashboard `/monitor` shows spend over time chart broken down by provider
- [ ] Dashboard `/wallet` shows earnings, balance, and settlement history
- [ ] Spending alert triggers when daily spend exceeds configured threshold
- [ ] Proxy unit tests: take-rate injection amount, idempotency dedup, fallback retry
- [ ] Take Rate Accumulator unit tests: accumulation, settlement trigger, audit log completeness

---

## Phase 5 — SDK + MCP Server + API Key Management

**User stories**: 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 44

**Owner**: Agent SDK+MCP (starts after Phase 4 API contract is stable)

### What to build

`@theminutes/sdk` is a thin TypeScript client published to npm. `createRouter({ apiKey, strategy, constraints? })` returns a router instance with three methods: `fetch(serviceType, params, overrides?)` calls `POST /v1/route`, `list(serviceType)` calls `GET /v1/services/:category`, and `preview(serviceType, overrides?)` calls `GET /v1/route/preview`. Zero dependencies beyond `mppx`. Compatible with Node.js 18+, Cloudflare Workers, and edge runtimes.

The MCP server uses `@modelcontextprotocol/sdk` and exposes 6 tools: `list_services`, `get_price`, `route_request`, `preview_route`, `get_spend`, `get_wallet`. API key and default strategy are set in MCP server config, not per-tool. Supports stdio transport (local) and SSE transport (hosted).

`POST /v1/keys` and `DELETE /v1/keys/:id` complete the key management API. Dashboard gains the `/keys` page for generating/revoking keys and the `/docs` page with embedded SDK and API reference.

### Acceptance criteria

- [ ] `npm install @theminutes/sdk` installs without errors
- [ ] `createRouter({ apiKey, strategy: 'cheapest' })` returns typed router instance
- [ ] `router.fetch('web-search', { query: 'hello' })` calls `POST /v1/route` and returns result
- [ ] `router.list('web-search')` calls `GET /v1/services/web-search` and returns typed `Provider[]`
- [ ] `router.preview('web-search')` calls `GET /v1/route/preview` and returns `RankedProvider[]`
- [ ] Strategy and constraints override work per-call via third argument
- [ ] SDK compiles with zero TypeScript errors, full type coverage on all public methods
- [ ] SDK works in a Cloudflare Workers test environment (no Node built-ins used)
- [ ] MCP server registers all 6 tools with correct input schemas
- [ ] `route_request` tool executes a routed call and returns provider + routing metadata
- [ ] MCP server config accepts `apiKey` and `defaultStrategy` fields
- [ ] `POST /v1/keys` creates a new API key and returns it (shown once only)
- [ ] `DELETE /v1/keys/:id` revokes the key; subsequent requests with it return `401`
- [ ] Dashboard `/keys` page lists active keys and provides revoke button
- [ ] SDK contract tests: all three methods match REST API response shapes
- [ ] MCP server can be added to Claude Desktop config and tools appear

---

## Build Order Summary

```
Hour 0-1:   You bootstrap monorepo (Turborepo init, shared tsconfig, Docker compose for PG+Redis)
Hour 1-4:   WAVE 1 — 4 agents in parallel:
              Agent Infra    → API skeleton + DB schema + auth middleware
              Agent Registry → Service Registry + Tempo crawler
              Agent Router   → Routing Engine (pure logic)
              Agent Monitor  → Health Monitor + Price Oracle
Hour 4-6:   Merge Wave 1 → wire Registry + Router + Monitor into API endpoints
Hour 6-8:   WAVE 2:
              Agent Proxy    → MPP Payment Proxy + Take Rate
              Agent SDK+MCP  → SDK + MCP server (against stable API contract)
Hour 8-9:   Final integration, dashboard wiring, smoke test end-to-end
Hour 9-10:  Deploy (Cloudflare Workers + Vercel) + DNS
```

---

## What You Need to Provide to Agents

| Agent | What you provide |
|---|---|
| Agent Infra | Nothing — bootstraps from scratch |
| Agent Registry | Tempo directory URL to crawl (`tempo.xyz/ecosystem`) |
| Agent Router | Nothing — pure logic |
| Agent Monitor | Nothing — stubs provider list until Registry is ready |
| Agent Proxy | Your Tempo wallet address + Privy API key + mppx config |
| Agent SDK+MCP | Final `POST /v1/route` and `GET /v1/services` response shapes |
| Agent Dashboard | API base URL once deployed |
