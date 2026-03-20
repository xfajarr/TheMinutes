import type {
  ProviderWithMetrics,
  RoutingStrategy,
  RoutingConstraints,
  RankedProvider,
  RoutingDecision,
} from "@theminutes/types";
import { RoutingError } from "./errors";

export function route(
  candidates: ProviderWithMetrics[],
  strategy: RoutingStrategy,
  constraints?: RoutingConstraints,
): RoutingDecision {
  let filtered = [...candidates];

  if (constraints) {
    filtered = applyConstraints(filtered, constraints);
  }

  if (filtered.length === 0) {
    throw new RoutingError(
      "NO_PROVIDERS",
      "All providers were filtered out by constraints",
    );
  }

  const ranked = rankCandidates(filtered, strategy);
  const selected = ranked[0]!;

  return {
    selected,
    candidates: ranked,
    strategy,
    constraints: constraints ?? {},
  };
}

function applyConstraints(
  candidates: ProviderWithMetrics[],
  c: RoutingConstraints,
): ProviderWithMetrics[] {
  if (c.whitelist && c.whitelist.length > 0) {
    const set = new Set(c.whitelist);
    candidates = candidates.filter((p) => set.has(p.id));
  }

  if (c.blacklist && c.blacklist.length > 0) {
    const set = new Set(c.blacklist);
    candidates = candidates.filter((p) => !set.has(p.id));
  }

  if (c.maxPrice !== undefined) {
    candidates = candidates.filter((p) => p.basePrice <= c.maxPrice!);
  }

  if (c.minUptime !== undefined) {
    candidates = candidates.filter(
      (p) => p.uptime !== null && p.uptime >= c.minUptime!,
    );
  }

  return candidates;
}

function rankCandidates(
  candidates: ProviderWithMetrics[],
  strategy: RoutingStrategy,
): RankedProvider[] {
  const scored = candidates.map((p) => {
    const { score, reason } = scoreCandidate(p, candidates, strategy);
    return { provider: p, score, reason };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.map((item, index) => ({
    provider: item.provider,
    rank: index + 1,
    score: Math.round(item.score * 10000) / 10000,
    reason: item.reason,
  }));
}

function scoreCandidate(
  candidate: ProviderWithMetrics,
  all: ProviderWithMetrics[],
  strategy: RoutingStrategy,
): { score: number; reason: string } {
  if (strategy === "cheapest") {
    const prices = all.map((p) => p.basePrice);
    const maxPrice = Math.max(...prices);
    const cheapestScore =
      maxPrice === 0 ? 1 : 1 - candidate.basePrice / maxPrice;
    return {
      score: cheapestScore,
      reason: `Cheapest at $${candidate.basePrice.toFixed(3)}/req`,
    };
  }

  if (strategy === "fastest") {
    const p50Values = all
      .map((p) => p.latency.p50)
      .filter((v): v is number => v !== null);

    if (p50Values.length === 0) {
      return { score: 0.5, reason: "Best p50 latency (no comparison data)" };
    }

    const maxP50 = Math.max(...p50Values);
    const p50 = candidate.latency.p50;
    const latencyScore =
      p50 === null ? 0.5 : maxP50 === 0 ? 1 : 1 - p50 / maxP50;
    const latencyMs = p50 !== null ? `${p50}ms` : "unknown";
    return {
      score: latencyScore,
      reason: `Best p50 latency at ${latencyMs}`,
    };
  }

  if (strategy === "balanced") {
    const prices = all.map((p) => p.basePrice);
    const maxPrice = Math.max(...prices);
    const cheapestScore =
      maxPrice === 0 ? 1 : 1 - candidate.basePrice / maxPrice;

    const p50Values = all
      .map((p) => p.latency.p50)
      .filter((v): v is number => v !== null);
    const maxP50 = p50Values.length > 0 ? Math.max(...p50Values) : 0;
    const fastestScore =
      candidate.latency.p50 === null
        ? 0.5
        : maxP50 === 0
          ? 1
          : 1 - candidate.latency.p50 / maxP50;

    const balancedScore = 0.5 * cheapestScore + 0.5 * fastestScore;
    return {
      score: balancedScore,
      reason: `Balanced score ${balancedScore.toFixed(2)} (price: ${cheapestScore.toFixed(2)}, latency: ${fastestScore.toFixed(2)})`,
    };
  }

  throw new RoutingError("INVALID_STRATEGY", `Unknown strategy: ${strategy}`);
}
