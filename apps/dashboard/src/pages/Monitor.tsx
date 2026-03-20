export function Monitor() {
  return (
    <div>
      <h1
        className="text-2xl font-semibold mb-2"
        style={{ color: "var(--color-text)" }}
      >
        Monitor
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--color-text-muted)" }}>
        Spending history and usage analytics
      </p>

      <div
        className="flex flex-col items-center justify-center py-24 rounded-lg"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="mb-4 opacity-40">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect
              x="4"
              y="28"
              width="8"
              height="14"
              rx="2"
              stroke="var(--color-text-dim)"
              strokeWidth="1.5"
            />
            <rect
              x="16"
              y="20"
              width="8"
              height="22"
              rx="2"
              stroke="var(--color-text-dim)"
              strokeWidth="1.5"
            />
            <rect
              x="28"
              y="12"
              width="8"
              height="30"
              rx="2"
              stroke="var(--color-text-dim)"
              strokeWidth="1.5"
            />
            <rect
              x="40"
              y="4"
              width="4"
              height="38"
              rx="2"
              stroke="var(--color-text-dim)"
              strokeWidth="1.5"
            />
          </svg>
        </div>
        <p
          className="text-base font-medium"
          style={{ color: "var(--color-text-muted)" }}
        >
          Spending Charts
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-dim)" }}>
          Coming soon
        </p>
        <p className="text-xs mt-2" style={{ color: "var(--color-text-dim)" }}>
          Aggregate spend, latency distributions, and provider breakdowns
        </p>
      </div>
    </div>
  );
}
