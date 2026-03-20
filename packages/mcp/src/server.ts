import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createRouter } from "@theminutes/sdk";
import type { RouteOptions } from "@theminutes/sdk";

const apiKey = process.env["THEMINUTES_API_KEY"];
if (!apiKey) throw new Error("THEMINUTES_API_KEY is required");

const router = createRouter({
  apiKey,
  strategy: (process.env["THEMINUTES_STRATEGY"] ?? "balanced") as
    | "balanced"
    | "cheapest"
    | "fastest",
  baseUrl: process.env["THEMINUTES_BASE_URL"],
});

const server = new McpServer({
  name: "theminutes",
  version: "0.1.0",
});

server.tool(
  "list_services",
  { category: z.string().optional() },
  async ({ category }) => {
    const result = await router.list(category ?? "");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "get_price",
  { serviceType: z.string() },
  async ({ serviceType }) => {
    const providers = await router.list(serviceType);
    const prices = providers.map((p) => ({
      id: p.id,
      name: p.name,
      basePrice: p.basePrice,
      latency: p.latency,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(prices, null, 2) }],
    };
  },
);

server.tool(
  "preview_route",
  { serviceType: z.string(), strategy: z.string().optional() },
  async ({ serviceType, strategy }) => {
    const overrides: RouteOptions = {};
    if (strategy) overrides.strategy = strategy as RouteOptions["strategy"];
    const result = await router.preview(serviceType, overrides);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "route_request",
  {
    serviceType: z.string(),
    params: z.record(z.unknown()),
    strategy: z.string().optional(),
  },
  async ({ serviceType, params, strategy }) => {
    const overrides: RouteOptions = {};
    if (strategy) overrides.strategy = strategy as RouteOptions["strategy"];
    const result = await router.fetch(serviceType, params, overrides);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "get_spend",
  { period: z.enum(["1h", "24h", "7d", "30d"]).optional() },
  async ({ period }) => {
    const baseUrl =
      process.env["THEMINUTES_BASE_URL"] ?? "https://api.theminutes.xyz";
    const url = period
      ? `${baseUrl}/v1/spend?period=${period}`
      : `${baseUrl}/v1/spend`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool("get_wallet", {}, async () => {
  const baseUrl =
    process.env["THEMINUTES_BASE_URL"] ?? "https://api.theminutes.xyz";
  const res = await fetch(`${baseUrl}/v1/wallet`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
