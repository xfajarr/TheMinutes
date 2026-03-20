import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useNavigate } from "react-router";

const CATEGORIES = [
  { value: "ai-model", label: "AI Model" },
  { value: "web-search", label: "Web Search" },
  { value: "compute", label: "Compute" },
  { value: "data-extraction", label: "Data Extraction" },
  { value: "storage", label: "Storage" },
  { value: "other", label: "Other" },
];

const RAILS = [
  { value: "tempo", label: "Tempo" },
  { value: "stripe", label: "Stripe" },
  { value: "lightning", label: "Lightning" },
];

interface FormState {
  name: string;
  category: string;
  endpoint: string;
  rails: string[];
  basePrice: string;
  capabilities: string;
}

export function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    name: "",
    category: "ai-model",
    endpoint: "",
    rails: ["tempo"],
    basePrice: "0.01",
    capabilities: "",
  });
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.registerProvider({
        name: form.name,
        category: form.category,
        endpoint: form.endpoint,
        rails: form.rails,
        basePrice: parseFloat(form.basePrice),
        capabilities: form.capabilities
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        navigate("/");
      }, 2000);
    },
  });

  const toggleRail = (rail: string) => {
    setForm((f) => ({
      ...f,
      rails: f.rails.includes(rail)
        ? f.rails.filter((r) => r !== rail)
        : [...f.rails, rail],
    }));
  };

  return (
    <div>
      <h1
        className="text-2xl font-semibold mb-1"
        style={{ color: "var(--color-text)" }}
      >
        Register Provider
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--color-text-muted)" }}>
        Add a new MPP-enabled service to the registry
      </p>

      <div
        className="max-w-xl rounded-lg p-6 space-y-5"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        {success && (
          <div
            className="flex items-center gap-3 p-3 rounded-md"
            style={{
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.3)",
            }}
          >
            <CheckIcon />
            <span className="text-sm" style={{ color: "var(--color-green)" }}>
              Provider registered successfully. Redirecting…
            </span>
          </div>
        )}

        {mutation.isError && (
          <div
            className="flex items-center gap-3 p-3 rounded-md"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            <XIcon />
            <span className="text-sm" style={{ color: "var(--color-red)" }}>
              {(mutation.error as Error)?.message ?? "Registration failed"}
            </span>
          </div>
        )}

        <Field label="Provider Name">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Anthropic Claude"
            className="w-full px-3 py-2 rounded-md text-sm"
            style={{
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </Field>

        <Field label="Category">
          <select
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value }))
            }
            className="w-full px-3 py-2 rounded-md text-sm"
            style={{
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Endpoint URL">
          <input
            type="url"
            value={form.endpoint}
            onChange={(e) =>
              setForm((f) => ({ ...f, endpoint: e.target.value }))
            }
            placeholder="https://api.example.com"
            className="w-full px-3 py-2 rounded-md text-sm"
            style={{
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </Field>

        <Field label="Base Price (USD/req)">
          <input
            type="number"
            step="0.001"
            min="0"
            value={form.basePrice}
            onChange={(e) =>
              setForm((f) => ({ ...f, basePrice: e.target.value }))
            }
            className="w-full px-3 py-2 rounded-md text-sm"
            style={{
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </Field>

        <Field label="Payment Rails">
          <div className="flex gap-2">
            {RAILS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleRail(value)}
                className="px-3 py-1.5 rounded-md text-sm transition-colors"
                style={
                  form.rails.includes(value)
                    ? {
                        background: "rgba(201,168,76,0.15)",
                        color: "var(--color-gold)",
                        border: "1px solid var(--color-gold)",
                      }
                    : {
                        background: "var(--color-surface-raised)",
                        color: "var(--color-text-muted)",
                        border: "1px solid var(--color-border)",
                      }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Capabilities">
          <input
            type="text"
            value={form.capabilities}
            onChange={(e) =>
              setForm((f) => ({ ...f, capabilities: e.target.value }))
            }
            placeholder="chat, embeddings, vision (comma-separated)"
            className="w-full px-3 py-2 rounded-md text-sm"
            style={{
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </Field>

        <button
          onClick={() => mutation.mutate()}
          disabled={!form.name || !form.endpoint || mutation.isPending}
          className="w-full py-2.5 rounded-md text-sm font-medium transition-opacity disabled:opacity-40"
          style={{ background: "var(--color-gold)", color: "#000" }}
        >
          {mutation.isPending ? "Registering…" : "Register Provider"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-xs font-medium mb-1.5"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle
        cx="8"
        cy="8"
        r="7"
        stroke="var(--color-green)"
        strokeWidth="1.5"
      />
      <path
        d="M5 8.5l2 2 4-4"
        stroke="var(--color-green)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="var(--color-red)" strokeWidth="1.5" />
      <path
        d="M5.5 5.5l5 5M10.5 5.5l-5 5"
        stroke="var(--color-red)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
