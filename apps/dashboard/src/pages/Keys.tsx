export function Keys() {
  return (
    <div>
      <h1
        className="text-2xl font-semibold mb-2"
        style={{ color: "var(--color-text)" }}
      >
        API Keys
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--color-text-muted)" }}>
        Manage your TheMinutes API keys
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
            <path
              d="M30 22a9 9 0 1 0-12.73 0M26 31l4-4"
              stroke="var(--color-text-dim)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <rect
              x="4"
              y="20"
              width="22"
              height="16"
              rx="3"
              stroke="var(--color-text-dim)"
              strokeWidth="2"
            />
            <circle cx="12" cy="28" r="3" fill="var(--color-text-dim)" />
          </svg>
        </div>
        <p
          className="text-base font-medium"
          style={{ color: "var(--color-text-muted)" }}
        >
          API Key Management
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-dim)" }}>
          Coming soon
        </p>
        <p className="text-xs mt-2" style={{ color: "var(--color-text-dim)" }}>
          Generate, revoke, and manage API keys for your applications
        </p>
      </div>
    </div>
  );
}
