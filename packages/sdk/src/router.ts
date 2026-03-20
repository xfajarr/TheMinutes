/**
 * TODO (Agent SDK+MCP): implement createRouter()
 * See packages/sdk/src/index.ts for full spec.
 */
import type { RouterConfig, Router } from "./types";
import { TheMinutesError } from "./errors";

const DEFAULT_BASE_URL = "https://api.theminutes.xyz";

export function createRouter(config: RouterConfig): Router {
  if (!config.apiKey) throw new TheMinutesError("apiKey is required", "CONFIG_ERROR", 0);

  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const defaultStrategy = config.strategy ?? "balanced";
  const defaultConstraints = config.constraints;

  async function apiFetch(path: string, init?: RequestInit): Promise<unknown> {
    const res = await fetch(`${baseUrl}/v1${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        ...(init?.headers ?? {}),
      },
    });

    const body = await res.json();
    if (!res.ok) {
      const err = body as { error: string; code: string };
      throw new TheMinutesError(err.error ?? "Request failed", err.code ?? "UNKNOWN", res.status);
    }
    return body;
  }

  return {
    async fetch(serviceType, params, overrides) {
      return apiFetch("/route", {
        method: "POST",
        body: JSON.stringify({
          service: serviceType,
          params,
          strategy: overrides?.strategy ?? defaultStrategy,
          constraints: overrides?.constraints ?? defaultConstraints,
        }),
      }) as ReturnType<Router["fetch"]>;
    },

    async list(serviceType) {
      return apiFetch(`/services/${encodeURIComponent(serviceType)}`) as ReturnType<Router["list"]>;
    },

    async preview(serviceType, overrides) {
      const strategy = overrides?.strategy ?? defaultStrategy;
      return apiFetch(
        `/route/preview?service=${encodeURIComponent(serviceType)}&strategy=${strategy}`
      ) as ReturnType<Router["preview"]>;
    },
  };
}
