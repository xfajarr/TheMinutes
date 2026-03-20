import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function Wallet() {
  const { data: wallet, isLoading } = useQuery({
    queryKey: ["wallet"],
    queryFn: api.getWallet,
  });

  return (
    <div>
      <h1
        className="text-2xl font-semibold mb-2"
        style={{ color: "var(--color-text)" }}
      >
        Wallet
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--color-text-muted)" }}>
        Take-rate earnings and balance overview
      </p>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-lg animate-pulse"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <StatCard
              label="Available Balance"
              value={
                wallet?.balance != null ? `$${wallet.balance.toFixed(4)}` : "—"
              }
              color="var(--color-text)"
            />
            <StatCard
              label="Unsettled Earnings"
              value={
                wallet?.unsettled != null
                  ? `$${wallet.unsettled.toFixed(4)}`
                  : "—"
              }
              color="var(--color-gold)"
            />
            <StatCard
              label="Last Settled"
              value={
                wallet?.lastSettledAt
                  ? new Date(wallet.lastSettledAt).toLocaleDateString()
                  : "Never"
              }
              color="var(--color-text-muted)"
            />
            <StatCard
              label="Settlement Status"
              value={
                wallet?.unsettled != null && wallet.unsettled >= 1
                  ? "Ready"
                  : "Accumulating"
              }
              color={
                wallet?.unsettled != null && wallet.unsettled >= 1
                  ? "var(--color-green)"
                  : "var(--color-text-dim)"
              }
            />
          </div>

          <div
            className="rounded-lg p-6"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h3
              className="text-sm font-medium mb-4"
              style={{ color: "var(--color-text-muted)" }}
            >
              About Take Rates
            </h3>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--color-text-dim)" }}
            >
              TheMinutes adds a $0.001 take rate to every routed request.
              Unsettled earnings accumulate in this wallet and are automatically
              transferred to the operator wallet when the balance exceeds $1.00.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="rounded-lg p-5"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="text-xs mb-2" style={{ color: "var(--color-text-dim)" }}>
        {label}
      </div>
      <div className="text-2xl font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
