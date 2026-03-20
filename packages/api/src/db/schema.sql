-- TheMinutes Database Schema
-- Run with: bun run db:migrate

-- ─── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Providers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS providers (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('web-search','data-extraction','ai-model','compute','storage','other')),
  endpoint      TEXT NOT NULL,
  rails         TEXT[] NOT NULL DEFAULT '{}',
  base_price    NUMERIC(12,6) NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'USD',
  capabilities  TEXT[] NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','degraded')),
  source        TEXT NOT NULL DEFAULT 'manual', -- 'tempo-directory' | 'manual'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS providers_endpoint_idx ON providers (endpoint);
CREATE INDEX IF NOT EXISTS providers_category_idx ON providers (category);
CREATE INDEX IF NOT EXISTS providers_status_idx ON providers (status);

-- ─── Health Metrics ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS health_pings (
  id            BIGSERIAL PRIMARY KEY,
  provider_id   TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  latency_ms    INTEGER, -- NULL = failed
  success       BOOLEAN NOT NULL,
  pinged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS health_pings_provider_pinged_idx ON health_pings (provider_id, pinged_at DESC);

-- ─── API Keys ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL UNIQUE, -- bcrypt hash of the full key
  prefix        TEXT NOT NULL,        -- first 8 chars for display
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ           -- NULL = active
);

CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys (key_hash);

-- ─── Spend Records ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spend_records (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  api_key_id       TEXT NOT NULL REFERENCES api_keys(id),
  provider_id      TEXT NOT NULL REFERENCES providers(id),
  provider_name    TEXT NOT NULL,
  service_category TEXT NOT NULL,
  provider_cost    NUMERIC(12,6) NOT NULL,
  take_rate        NUMERIC(12,6) NOT NULL DEFAULT 0.001,
  total_cost       NUMERIC(12,6) NOT NULL,
  latency_ms       INTEGER NOT NULL,
  request_id       TEXT NOT NULL UNIQUE, -- idempotency key
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS spend_records_api_key_idx ON spend_records (api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS spend_records_provider_idx ON spend_records (provider_id, created_at DESC);

-- ─── Take Rate Audit Log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS take_rate_events (
  id            BIGSERIAL PRIMARY KEY,
  request_id    TEXT NOT NULL UNIQUE REFERENCES spend_records(request_id),
  amount        NUMERIC(12,6) NOT NULL,
  settled       BOOLEAN NOT NULL DEFAULT FALSE,
  settled_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS take_rate_events_settled_idx ON take_rate_events (settled, created_at DESC);
