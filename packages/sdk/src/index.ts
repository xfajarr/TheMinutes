/**
 * @theminutes/sdk
 *
 * The public npm package. Zero Node.js built-ins — must run in:
 *   - Node.js 18+
 *   - Bun
 *   - Cloudflare Workers
 *   - Edge runtimes
 *
 * Responsibilities (Agent SDK+MCP):
 *
 *  createRouter(config: RouterConfig) → Router
 *
 *  RouterConfig:
 *    - apiKey: string          — TheMinutes API key (tm_...)
 *    - baseUrl?: string        — defaults to "https://api.theminutes.xyz"
 *    - strategy?: RoutingStrategy — defaults to "balanced"
 *    - constraints?: RoutingConstraints
 *
 *  Router methods:
 *    - fetch(serviceType: string, params: Record<string, unknown>, overrides?: RouteOptions)
 *        → Promise<RouteResult>
 *        Calls POST /v1/route
 *
 *    - list(serviceType: string)
 *        → Promise<ProviderWithMetrics[]>
 *        Calls GET /v1/services/:category
 *
 *    - preview(serviceType: string, overrides?: RouteOptions)
 *        → Promise<RankedProvider[]>
 *        Calls GET /v1/route/preview
 *
 *  RouteOptions (per-call overrides):
 *    - strategy?: RoutingStrategy
 *    - constraints?: RoutingConstraints
 *
 * Error handling:
 *   - All methods throw TheMinutesError on non-2xx responses
 *   - TheMinutesError has: message, code (from API), statusCode
 *
 * Tests must cover:
 *   - createRouter validates required apiKey
 *   - router.fetch() sends correct body to POST /v1/route
 *   - router.list() calls correct category endpoint
 *   - router.preview() calls GET /v1/route/preview with correct params
 *   - Per-call strategy override is sent in request body
 *   - TheMinutesError thrown on 4xx/5xx
 *   - No Node.js built-ins used (importable in CF Workers)
 */

export { createRouter } from "./router";
export { TheMinutesError } from "./errors";
export type { RouterConfig, Router, RouteOptions } from "./types";
export type {
  RouteResult,
  ProviderWithMetrics,
  RankedProvider,
  RoutingStrategy,
  RoutingConstraints,
} from "@theminutes/types";
