import type { RoutingStrategy, RoutingConstraints } from "@theminutes/types";

export interface RouterConfig {
  apiKey: string;
  baseUrl?: string;
  strategy?: RoutingStrategy;
  constraints?: RoutingConstraints;
}

export interface RouteOptions {
  strategy?: RoutingStrategy;
  constraints?: RoutingConstraints;
}

export interface Router {
  fetch(
    serviceType: string,
    params: Record<string, unknown>,
    overrides?: RouteOptions
  ): Promise<import("@theminutes/types").RouteResult>;

  list(
    serviceType: string
  ): Promise<import("@theminutes/types").ProviderWithMetrics[]>;

  preview(
    serviceType: string,
    overrides?: RouteOptions
  ): Promise<import("@theminutes/types").RankedProvider[]>;
}
