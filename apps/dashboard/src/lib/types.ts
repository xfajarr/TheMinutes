export type ServiceCategory =
  | "ai-model"
  | "web-search"
  | "compute"
  | "data-extraction"
  | "storage"
  | "other";

export type PaymentRail = "tempo" | "stripe" | "lightning" | "visa";

export interface LatencyMetrics {
  p50: number | null;
  p90: number | null;
  p99: number | null;
}

export interface Provider {
  id: string;
  name: string;
  category: ServiceCategory;
  endpoint: string;
  rails: PaymentRail[];
  basePrice: number;
  currency: string;
  capabilities: string[];
  status: "active" | "inactive" | "degraded";
  createdAt: string;
  updatedAt: string;
}

export interface ProviderWithMetrics extends Provider {
  latency: LatencyMetrics;
  uptime: number | null;
  lastSeen: string | null;
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
  strategy: "cheapest" | "fastest" | "balanced";
  constraints: Record<string, unknown>;
}

export interface RouteResult {
  data: unknown;
  _routing: {
    providerId: string;
    providerName: string;
    strategy: string;
    reason: string;
    providerCost: number;
    takeRate: number;
    totalCost: number;
    latencyMs: number;
  };
}

export interface SpendRecord {
  id: string;
  providerId: string;
  providerName: string;
  serviceCategory: string;
  providerCost: number;
  takeRate: number;
  totalCost: number;
  latencyMs: number;
  createdAt: string;
}

export interface WalletInfo {
  balance: number;
  unsettled: number;
  lastSettledAt: string | null;
}
