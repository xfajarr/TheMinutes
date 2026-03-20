# TheMinutes

> The MPP Service Router for AI Agents

TheMinutes is a hosted service router that lets AI agents and developers discover, compare, and route to MPP-compatible services automatically—without hardcoding endpoints.

## Overview

AI agents built on the Machine Payment Protocol (MPP) need to call external services (web search, data extraction, compute, APIs) and pay for them autonomously. TheMinutes provides:

- **Service Discovery** — Query all MPP-compatible services via a single API
- **Smart Routing** — Automatically select the best provider based on price, latency, or reliability
- **Payment Handling** — Handle MPP 402 challenge-response with automatic take-rate injection
- **SDK & MCP** — Drop-in TypeScript SDK and MCP server for Claude/Cursor integration

## Packages

| Package             | Description                      |
| ------------------- | -------------------------------- |
| `packages/api`      | REST API server (Hono)           |
| `packages/mcp`      | MCP server for AI agents         |
| `packages/monitor`  | Provider health monitoring       |
| `packages/proxy`    | MPP payment proxy with take-rate |
| `packages/registry` | Service registry & price oracle  |
| `packages/router`   | Routing engine                   |
| `packages/sdk`      | `@theminutes/sdk` npm package    |
| `packages/types`    | Shared TypeScript types          |
| `apps/dashboard`    | Next.js web dashboard            |

## Quick Start

```bash
# Install dependencies
bun install

# Run all services in development
bun run dev

# Build all packages
bun run build

# Run tests
bun run test
```

## Development

### Prerequisites

- [Bun](https://bun.sh) >= 1.3.0

### Available Scripts

```bash
bun run dev          # Start all services in development mode
bun run build        # Build all packages
bun run test         # Run tests
bun run lint         # Lint all packages
bun run typecheck    # Type-check all packages
bun run format       # Format code with Prettier
```

### Database

```bash
# Run migrations
bun run db:migrate

# Seed database
bun run db:seed
```

## Architecture

TheMinutes follows a modular architecture:

```
theminutes/
├── apps/
│   └── dashboard/       # Next.js web UI
├── packages/
│   ├── api/             # REST API (Hono)
│   ├── mcp/             # MCP Server
│   ├── monitor/         # Health monitoring
│   ├── proxy/           # MPP Payment Proxy
│   ├── registry/        # Service Registry
│   ├── router/          # Routing Engine
│   ├── sdk/             # TypeScript SDK
│   └── types/           # Shared types
```

## License

MIT
