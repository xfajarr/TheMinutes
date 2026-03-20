/**
 * @theminutes/registry
 *
 * Responsibilities (Agent Registry):
 *  1. ServiceRegistry — CRUD for providers stored in PostgreSQL
 *  2. PriceOracle     — Fetch + Redis-cache real-time prices per provider (60s TTL)
 *  3. TempoDirectoryCrawler — Crawl tempo.xyz/ecosystem on startup + every 15min,
 *                             upsert providers (dedup by endpoint)
 *
 * Exports:
 *  - registry: ServiceRegistry instance (singleton)
 *  - priceOracle: PriceOracle instance (singleton)
 *  - startCrawler(): void — kicks off the background Tempo directory crawler
 *
 * See packages/types/src/index.ts for Provider, ProviderRegistrationInput types.
 * See packages/api/src/db/schema.sql for the providers table schema.
 * Use packages/api/src/db/client.ts for the db instance.
 * Use packages/api/src/cache/client.ts for the redis instance.
 *
 * Pattern to follow: see packages/api/src/routes/services.ts for how the
 * registry is consumed by the API.
 */

export { ServiceRegistry, registry } from "./registry";
export { PriceOracle, priceOracle } from "./price-oracle";
export { startCrawler } from "./crawler";
