import { Outlet, NavLink } from "react-router";

const NAV_ITEMS = [
  { path: "/", label: "Services", icon: GridIcon },
  { path: "/register", label: "Register", icon: PlusIcon },
  { path: "/monitor", label: "Monitor", icon: ChartIcon },
  { path: "/wallet", label: "Wallet", icon: WalletIcon },
  { path: "/keys", label: "API Keys", icon: KeyIcon },
];

export function Layout() {
  return (
    <div className="flex h-full">
      <aside
        style={{
          background: "var(--color-surface)",
          borderRight: "1px solid var(--color-border)",
        }}
        className="w-56 shrink-0 flex flex-col"
      >
        <div
          className="px-5 py-5"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div
            className="text-sm font-semibold tracking-widest uppercase"
            style={{ color: "var(--color-gold)" }}
          >
            TheMinutes
          </div>
          <div
            className="text-xs mt-0.5"
            style={{ color: "var(--color-text-muted)" }}
          >
            Agent Router
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-[var(--color-surface-raised)] text-[var(--color-gold)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
                }`
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>

        <div
          className="px-4 py-3"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <div className="text-xs" style={{ color: "var(--color-text-dim)" }}>
            v0.1.0 · Powered by MPP
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function GridIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="1"
        y="1"
        width="6"
        height="6"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="9"
        y="1"
        width="6"
        height="6"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="1"
        y="9"
        width="6"
        height="6"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="9"
        y="9"
        width="6"
        height="6"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 3v10M3 8h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2 12l3-4 3 2 4-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="1"
        y="4"
        width="14"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M1 7h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="8.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.5 6.5a3.5 3.5 0 1 0-4.95 3.5h2.45"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 9.5l2-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
