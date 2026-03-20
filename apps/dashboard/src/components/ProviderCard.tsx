import type { ProviderWithMetrics } from "../lib/types";

interface Props {
  provider: ProviderWithMetrics;
  onSelect?: (provider: ProviderWithMetrics) => void;
  selected?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  "ai-model": "AI Model",
  "web-search": "Web Search",
  compute: "Compute",
  "data-extraction": "Data",
  storage: "Storage",
  other: "Other",
};

export function ProviderCard({ provider, onSelect, selected }: Props) {
  const uptimeColor =
    provider.uptime === null
      ? "var(--color-text-dim)"
      : provider.uptime >= 99
        ? "var(--color-green)"
        : provider.uptime >= 90
          ? "var(--color-yellow)"
          : "var(--color-red)";

  return (
    <div
      onClick={onSelect ? () => onSelect(provider) : undefined}
      className={`rounded-lg p-4 transition-colors ${
        onSelect ? "cursor-pointer hover:bg-[var(--color-surface-raised)]" : ""
      } ${selected ? "ring-1 ring-[var(--color-gold)] bg-[var(--color-surface-raised)]" : ""}`}
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-[var(--color-text)]">
              {provider.name}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: "var(--color-surface-raised)",
                color: "var(--color-text-muted)",
              }}
            >
              {CATEGORY_LABELS[provider.category] ?? provider.category}
            </span>
          </div>
          <div
            className="text-xs mt-1 truncate"
            style={{ color: "var(--color-text-muted)" }}
            title={provider.endpoint}
          >
            {provider.endpoint}
          </div>
        </div>

        <div className="text-right shrink-0">
          <div
            className="text-sm font-semibold"
            style={{ color: "var(--color-gold)" }}
          >
            ${provider.basePrice.toFixed(3)}
          </div>
          <div className="text-xs" style={{ color: "var(--color-text-dim)" }}>
            /req
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs">
        <div>
          <span style={{ color: "var(--color-text-dim)" }}>p50 </span>
          <span style={{ color: "var(--color-text-muted)" }}>
            {provider.latency.p50 != null
              ? `${Math.round(provider.latency.p50)}ms`
              : "—"}
          </span>
        </div>
        <div>
          <span style={{ color: "var(--color-text-dim)" }}>uptime </span>
          <span style={{ color: uptimeColor }}>
            {provider.uptime != null ? `${provider.uptime.toFixed(1)}%` : "—"}
          </span>
        </div>
        <div className="flex gap-1 ml-auto">
          {provider.rails.map((rail) => (
            <span
              key={rail}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: "var(--color-surface-raised)",
                color: "var(--color-text-dim)",
              }}
            >
              {rail}
            </span>
          ))}
        </div>
      </div>

      {provider.capabilities.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {provider.capabilities.slice(0, 4).map((cap) => (
            <span
              key={cap}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: "rgba(201,168,76,0.1)",
                color: "var(--color-gold-dim)",
              }}
            >
              {cap}
            </span>
          ))}
          {provider.capabilities.length > 4 && (
            <span
              className="text-xs"
              style={{ color: "var(--color-text-dim)" }}
            >
              +{provider.capabilities.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
