// ─── Provider ────────────────────────────────────────────────────────────────

export type ServiceCategory =
  | "web-search"
  | "data-extraction"
  | "ai-model"
  | "compute"
  | "storage"
  | "other";

export type PaymentRail = "tempo" | "stripe" | "lightning" | "visa";

export type ProviderStatus = "active" | "inactive" | "degraded";

export interface Provider {
  id: string;
  name: string;
  category: ServiceCategory;
  endpoint: string;
  rails: PaymentRail[];
  basePrice: number; // USD per request
  currency: "USD";
  capabilities: string[]; // e.g. ["search", "news", "images"]
  status: ProviderStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface ProviderWithMetrics extends Provider {
  latency: {
    p50: number | null; // ms
    p90: number | null;
    p99: number | null;
  };
  uptime: number | null; // 0-100 percentage over last 24h
  lastSeen: string | null; // ISO 8601
}

export interface ProviderRegistrationInput {
  name: string;
  category: ServiceCategory;
  endpoint: string;
  rails: PaymentRail[];
  basePrice: number;
  capabilities: string[];
}

// ─── Routing ─────────────────────────────────────────────────────────────────

export type RoutingStrategy = "cheapest" | "fastest" | "balanced";

export interface RoutingConstraints {
  maxPrice?: number;
  whitelist?: string[]; // provider IDs
  blacklist?: string[]; // provider IDs
  minUptime?: number; // 0-100
}

export interface RankedProvider {
  provider: ProviderWithMetrics;
  rank: number;
  score: number;
  reason: string;
}

export interface RoutingDecision {
  selected: RankedProvider;
  candidates: RankedProvider[];
  strategy: RoutingStrategy;
  constraints: RoutingConstraints;
}

// ─── Route Result ─────────────────────────────────────────────────────────────

export interface RouteResult<T = unknown> {
  data: T;
  _routing: {
    providerId: string;
    providerName: string;
    strategy: RoutingStrategy;
    reason: string;
    providerCost: number;
    takeRate: number;
    totalCost: number;
    latencyMs: number;
  };
}

// ─── Spend ───────────────────────────────────────────────────────────────────

export interface SpendRecord {
  id: string;
  apiKeyId: string;
  providerId: string;
  providerName: string;
  serviceCategory: ServiceCategory;
  providerCost: number;
  takeRate: number;
  totalCost: number;
  latencyMs: number;
  createdAt: string;
}

// ─── Wallet / Take Rate ───────────────────────────────────────────────────────

export interface TakeRateEvent {
  id: string;
  requestId: string;
  amount: number;
  createdAt: string;
}

export interface WalletInfo {
  balance: number; // accumulated unsettled take rate (USD)
  totalEarned: number;
  lastSettledAt: string | null;
  tempoWalletAddress: string;
}

// ─── API Key ─────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  name: string;
  prefix: string; // first 8 chars shown after creation
  createdAt: string;
  lastUsedAt: string | null;
}

// ─── API Responses ───────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
