const BASE_URL = import.meta.env["VITE_API_URL"] ?? "http://localhost:3000";
const API_KEY = import.meta.env["VITE_API_KEY"] ?? "";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(
      (body as { error?: string }).error ?? "Request failed",
      res.status,
      (body as { code?: string }).code,
    );
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ApiError";
  }
}

export const api = {
  listProviders(category?: string) {
    return apiFetch<import("./types").ProviderWithMetrics[]>(
      category ? `/services/${encodeURIComponent(category)}` : "/services",
    );
  },

  previewRoute(service: string, strategy?: string) {
    const params = new URLSearchParams({ service });
    if (strategy) params.set("strategy", strategy);
    return apiFetch<import("./types").RoutingDecision>(
      `/route/preview?${params}`,
    );
  },

  async routeRequest(
    service: string,
    params: Record<string, unknown>,
    strategy?: string,
  ) {
    return apiFetch<import("./types").RouteResult>("/route", {
      method: "POST",
      body: JSON.stringify({
        service,
        params,
        strategy: strategy ?? "balanced",
      }),
    });
  },

  registerProvider(input: {
    name: string;
    category: string;
    endpoint: string;
    rails: string[];
    basePrice: number;
    capabilities: string[];
  }) {
    return apiFetch<import("./types").Provider>("/services/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  getSpend(period?: "1h" | "24h" | "7d" | "30d") {
    const params = period ? `?period=${period}` : "";
    return apiFetch<{
      records: import("./types").SpendRecord[];
      total: number;
    }>(`/spend${params}`);
  },

  getWallet() {
    return apiFetch<import("./types").WalletInfo>("/wallet");
  },
};
