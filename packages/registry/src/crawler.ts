import { ServiceRegistry } from "./registry";
import type {
  ProviderRegistrationInput,
  ServiceCategory,
} from "@theminutes/types";

const MPP_SERVICES_URL = "https://mpp.dev/api/services";
const CRAWL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

interface MppService {
  id: string;
  name: string;
  serviceUrl: string;
  description: string;
  categories: string[];
}

const SEED_PROVIDERS: ProviderRegistrationInput[] = [
  {
    name: "Parallel Web Systems",
    category: "web-search",
    endpoint: "https://parallelmpp.dev",
    rails: ["tempo"],
    basePrice: 0.01,
    capabilities: ["search", "extract", "research"],
  },
  {
    name: "Browserbase",
    category: "compute",
    endpoint: "https://mpp.browserbase.com",
    rails: ["tempo"],
    basePrice: 0.005,
    capabilities: ["browse", "fetch", "screenshot"],
  },
  {
    name: "Alchemy",
    category: "compute",
    endpoint: "https://mpp.alchemy.com",
    rails: ["tempo"],
    basePrice: 0.001,
    capabilities: ["rpc", "nft", "tokens", "transfers"],
  },
  {
    name: "Dune Analytics",
    category: "data-extraction",
    endpoint: "https://api.dune.com",
    rails: ["tempo"],
    basePrice: 0.01,
    capabilities: ["sql", "analytics", "dashboards"],
  },
  {
    name: "Anthropic",
    category: "ai-model",
    endpoint: "https://anthropic.mpp.tempo.xyz",
    rails: ["tempo"],
    basePrice: 0.015,
    capabilities: ["chat", "vision"],
  },
  {
    name: "OpenAI",
    category: "ai-model",
    endpoint: "https://openai.mpp.tempo.xyz",
    rails: ["tempo"],
    basePrice: 0.01,
    capabilities: ["chat", "embeddings", "images", "audio"],
  },
];

function mapCategory(mppCategories: string[]): ServiceCategory {
  if (mppCategories.includes("search") || mppCategories.includes("web"))
    return "web-search";
  if (mppCategories.includes("data") || mppCategories.includes("blockchain"))
    return "data-extraction";
  if (mppCategories.includes("ai") || mppCategories.includes("media"))
    return "ai-model";
  if (mppCategories.includes("compute")) return "compute";
  if (mppCategories.includes("storage")) return "storage";
  return "other";
}

export function startCrawler(
  registry: ServiceRegistry = new ServiceRegistry(),
): () => void {
  let stopped = false;

  async function crawl() {
    if (stopped) return;
    try {
      await Promise.all([crawlMppApi(registry), crawlSeedProviders(registry)]);
    } catch (err) {
      console.error("[crawler] crawl failed:", err);
    }
  }

  crawl();

  const interval = setInterval(() => {
    if (stopped) {
      clearInterval(interval);
      return;
    }
    crawl();
  }, CRAWL_INTERVAL_MS);

  return () => {
    stopped = true;
    clearInterval(interval);
  };
}

async function crawlMppApi(registry: ServiceRegistry): Promise<void> {
  try {
    const res = await fetch(MPP_SERVICES_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return;

    const services = (await res.json()) as MppService[];
    await Promise.all(
      services.map((svc) =>
        registry.register({
          name: svc.name,
          category: mapCategory(svc.categories),
          endpoint: svc.serviceUrl,
          rails: ["tempo"],
          basePrice: 0.01,
          capabilities: svc.categories,
        }),
      ),
    );
  } catch (err) {
    console.warn("[crawler] failed to fetch mpp.dev services:", err);
  }
}

async function crawlSeedProviders(registry: ServiceRegistry): Promise<void> {
  await Promise.all(SEED_PROVIDERS.map((p) => registry.register(p)));
}
