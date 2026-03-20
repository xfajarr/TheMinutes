# TheMinutes

> Miss Minutes routes people through the TVA's Sacred Timeline. TheMinutes routes your AI agents through the best service — and handles the payment automatically.

**The service router for AI agents on [Tempo](https://tempo.xyz).** Discover, compare, and route to 100+ services that accept MPP payment with a single `router.fetch()` call. No hardcoded endpoints. No manual price checking. Just the right service, at the right price, every time.

```ts
import { createRouter } from "@theminutes/sdk";

const router = createRouter({ apiKey: "tm_...", strategy: "cheapest" });
const result = await router.fetch("web-search", { query: "latest MPP news" });
```

---

## Why TheMinutes

AI agents need to call external services — web search, compute, data, AI models — and pay for them autonomously via MPP. Today that means:

- Manually browsing Tempo's directory to find providers
- Hardcoding endpoints that go stale when better options launch
- No visibility into whether you're paying too much or routing to a slow provider

TheMinutes solves all three. It's a **DEX aggregator for AI service calls** — it finds the best route so your agent doesn't have to.

---

## How It Works

```
Agent calls router.fetch("web-search", { query })
         ↓
TheMinutes queries 100+ registered MPP providers
         ↓
Ranks by strategy: cheapest / fastest / balanced
         ↓
Handles the full MPP 402 payment flow
         ↓
Returns result + routing metadata (_routing.providerId, cost, latency)
```

Every routed request adds a **$0.001 take rate** on top of the provider price — invisible to agents, meaningful at scale.

---

## Features

- **Service Registry** — Auto-seeded from Tempo's directory, updated every 15 min. Manual registration via API or dashboard.
- **Smart Routing** — Three strategies: `cheapest`, `fastest`, `balanced`. Per-request overrides supported.
- **Constraints** — `maxPrice`, `whitelist`, `blacklist`, `minUptime` filters applied before scoring.
- **Preview Mode** — `GET /v1/route/preview` returns ranked providers without executing.
- **Fallback** — Automatically retries the next-ranked provider on failure.
- **MCP Server** — Native Claude/Cursor integration. Six tools: `list_services`, `get_price`, `preview_route`, `route_request`, `get_spend`, `get_wallet`.
- **Health Monitor** — Active probing every 30s + passive latency from real requests. p50/p90/p99 per provider.
- **Take Rate Wallet** — Operator earnings accumulate and auto-settle to your Tempo wallet.

---

## Packages

| Package | Description |
|---|---|
| `packages/api` | REST API server (Hono) — all `/v1/` endpoints |
| `packages/registry` | Service Registry + Price Oracle + Tempo directory crawler |
| `packages/router` | Pure routing engine — strategies + constraints |
| `packages/monitor` | Provider health monitoring — active + passive |
| `packages/proxy` | MPP Payment Proxy + Take Rate Accumulator |
| `packages/sdk` | `@theminutes/sdk` — npm package |
| `packages/mcp` | MCP server for Claude/Cursor |
| `packages/types` | Shared TypeScript types |
| `apps/dashboard` | Next.js web dashboard |

---

## Quick Start

### 1. Start infrastructure

```bash
docker compose up -d   # PostgreSQL + Redis
bun install
bun run db:migrate
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in: DATABASE_URL, REDIS_URL, OPERATOR_WALLET_ADDRESS, TEMPO_PRIVATE_KEY
```

### 3. Run

```bash
bun run dev   # API on :3000, Dashboard on :3001
```

### 4. Create an API key

```bash
curl -X POST http://localhost:3000/v1/keys \
  -H "Authorization: Bearer tm_..." \
  -d '{ "name": "my-agent" }'
```

---

## SDK

```bash
bun add @theminutes/sdk
```

```ts
import { createRouter } from "@theminutes/sdk";

const router = createRouter({
  apiKey: "tm_...",
  strategy: "balanced",           // cheapest | fastest | balanced
  constraints: { maxPrice: 0.05 } // never pay more than $0.05/req
});

// Route and pay automatically
const result = await router.fetch("web-search", { query: "Tempo MPP" });
console.log(result.data);       // provider response
console.log(result._routing);   // { providerId, cost, takeRate, latencyMs, reason }

// Preview without executing
const ranked = await router.preview("web-search");
// [{ rank: 1, score: 0.94, reason: "Cheapest at $0.010/req", provider: {...} }, ...]

// List all providers in a category
const providers = await router.list("web-search");
```

---

## MCP Server (Claude / Cursor)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "theminutes": {
      "command": "bunx",
      "args": ["@theminutes/mcp"],
      "env": {
        "THEMINUTES_API_KEY": "tm_...",
        "THEMINUTES_STRATEGY": "cheapest"
      }
    }
  }
}
```

Tools: `list_services` · `get_price` · `preview_route` · `route_request` · `get_spend` · `get_wallet`

---

## REST API

All endpoints require `Authorization: Bearer <api-key>`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/v1/services` | List all providers with live price + latency |
| `GET` | `/v1/services/:category` | Filter by category |
| `POST` | `/v1/providers/register` | Register a new MPP provider |
| `GET` | `/v1/route/preview` | Ranked providers without executing |
| `POST` | `/v1/route` | Route + pay + return result |
| `GET` | `/v1/spend` | Caller's spend history |
| `GET` | `/v1/wallet` | Operator take-rate balance + settlements |
| `POST` | `/v1/keys` | Create API key |
| `DELETE` | `/v1/keys/:id` | Revoke API key |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              REST API (Hono)                │
│          /v1/* — auth via Bearer key        │
└──────┬──────────┬──────────────┬────────────┘
       │          │              │
  ┌────▼────┐ ┌───▼────┐  ┌─────▼──────┐
  │Registry │ │Router  │  │  Monitor   │
  │+ Price  │ │Engine  │  │ (Prober +  │
  │Oracle   │ │(pure)  │  │  Passive)  │
  └────┬────┘ └───┬────┘  └─────┬──────┘
       └──────────▼──────────────┘
              ┌────────┐
              │  MPP   │
              │ Proxy  │ ← mppx (402 flow)
              │+ Take  │
              │  Rate  │
              └────────┘
```

**Storage**: PostgreSQL (providers, keys, spend, take-rate log) + Redis (price cache 60s, auth cache 60s)

**Settlement**: Take-rate auto-settles to operator Tempo wallet when balance ≥ $1.00 or every hour.

---

## Development

```bash
bun run dev          # Start all services
bun run build        # Build all packages
bun run test         # Run all tests (Vitest)
bun run typecheck    # TypeScript check
bun run lint         # Lint
bun run format       # Prettier
bun run db:migrate   # Apply DB schema
```

---

## Name

Named after **Miss Minutes** from *Loki* — she routes entities through the TVA's Sacred Timeline. TheMinutes routes your agents through the right MPP service. The name also ties to **Tempo** (Latin: time).

---

## License

MIT
