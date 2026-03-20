import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ProviderCard } from "../components/ProviderCard";
import type { ServiceCategory } from "../lib/types";

const CATEGORIES: { value: ServiceCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ai-model", label: "AI Models" },
  { value: "web-search", label: "Web Search" },
  { value: "compute", label: "Compute" },
  { value: "data-extraction", label: "Data" },
  { value: "storage", label: "Storage" },
];

export function Home() {
  const [activeCategory, setActiveCategory] = useState<ServiceCategory | "all">(
    "all",
  );
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const {
    data: providers,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["providers", activeCategory],
    queryFn: () =>
      api.listProviders(activeCategory === "all" ? undefined : activeCategory),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    setLastRefresh(new Date());
  }, [providers]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-semibold"
            style={{ color: "var(--color-text)" }}
          >
            Services
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            {providers?.length ?? 0} provider
            {providers?.length !== 1 ? "s" : ""} · refreshed{" "}
            {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          <RefreshIcon spinning={isFetching} />
          Refresh
        </button>
      </div>

      <div className="flex gap-1 mb-6">
        {CATEGORIES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveCategory(value)}
            className="px-3 py-1.5 rounded-md text-sm transition-colors"
            style={
              activeCategory === value
                ? {
                    background: "var(--color-surface-raised)",
                    color: "var(--color-gold)",
                    border: "1px solid var(--color-gold)",
                  }
                : {
                    background: "var(--color-surface)",
                    color: "var(--color-text-muted)",
                    border: "1px solid var(--color-border)",
                  }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-36 rounded-lg animate-pulse"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            />
          ))}
        </div>
      ) : providers?.length === 0 ? (
        <EmptyState category={activeCategory} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {providers?.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              selected={selectedProvider === provider.id}
              onSelect={(p) => setSelectedProvider(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ category }: { category: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 rounded-lg"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="text-4xl mb-4">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle
            cx="24"
            cy="24"
            r="20"
            stroke="var(--color-border)"
            strokeWidth="2"
          />
          <path
            d="M24 16v10M24 32h.01"
            stroke="var(--color-text-dim)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p
        className="text-sm font-medium"
        style={{ color: "var(--color-text-muted)" }}
      >
        No services found
      </p>
      <p className="text-xs mt-1" style={{ color: "var(--color-text-dim)" }}>
        {category === "all"
          ? "Add providers via /register"
          : `No providers in ${category}`}
      </p>
    </div>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={spinning ? { animation: "spin 1s linear infinite" } : undefined}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <path
        d="M12.5 7a5.5 5.5 0 1 1-1.03-3.37"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M11 1v3.5h3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
