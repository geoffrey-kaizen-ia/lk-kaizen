"use client";

import { useState, useTransition } from "react";
import { adminSetAllowedRoles, adminSetCanEditPrompt } from "./actions";

const ALL_ROLES = ["icebreaker", "conversation", "relance"] as const;
const ROLE_LABELS: Record<string, string> = {
  icebreaker: "Prise de contact",
  conversation: "Conversation",
  relance: "Relance",
};

type Client = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  is_active: boolean | null;
  allowed_roles: string[];
  can_edit_prompt: boolean;
};

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-accent" : "bg-border-strong"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function ClientRow({ client }: { client: Client }) {
  const [isPending, startTransition] = useTransition();
  const [localRoles, setLocalRoles] = useState(client.allowed_roles);
  const [localPrompt, setLocalPrompt] = useState(client.can_edit_prompt);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(role: string) {
    const next = localRoles.includes(role)
      ? localRoles.filter((r) => r !== role)
      : [...localRoles, role];
    setLocalRoles(next);
    startTransition(async () => {
      const result = await adminSetAllowedRoles(client.user_id, next);
      if (result.error) {
        setError(result.error);
        setLocalRoles(localRoles);
      }
    });
  }

  function togglePrompt(value: boolean) {
    setLocalPrompt(value);
    startTransition(async () => {
      const result = await adminSetCanEditPrompt(client.user_id, value);
      if (result.error) {
        setError(result.error);
        setLocalPrompt(!value);
      }
    });
  }

  return (
    <div className={`rounded-lg border border-border bg-panel p-4 ${isPending ? "opacity-70" : ""}`}>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {client.full_name ?? "Sans nom"}
          </p>
          <p className="text-xs text-text-muted">{client.email ?? "—"}</p>
        </div>
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 font-display text-[9px] font-medium uppercase tracking-wider ${
            client.is_active
              ? "border-positive/30 text-positive"
              : "border-danger/30 text-danger"
          }`}
        >
          {client.is_active ? "Actif" : "Inactif"}
        </span>
      </div>

      <div className="space-y-2.5">
        <div>
          <p className="mb-1.5 font-display text-[10px] font-semibold text-text-dim">
            Rôles activés
          </p>
          <div className="flex flex-wrap gap-3">
            {ALL_ROLES.map((role) => (
              <label
                key={role}
                className="flex cursor-pointer items-center gap-2"
              >
                <Toggle
                  checked={localRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                  disabled={isPending}
                  label={ROLE_LABELS[role]}
                />
                <span className="text-xs text-text-muted">{ROLE_LABELS[role]}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-panel-raised px-3 py-2">
          <div>
            <p className="text-xs font-medium text-foreground">Écriture de prompt libre</p>
            <p className="text-[11px] text-text-dim">
              Le client peut modifier le prompt brut de ses agents
            </p>
          </div>
          <Toggle
            checked={localPrompt}
            onChange={togglePrompt}
            disabled={isPending}
            label="Écriture de prompt libre"
          />
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs text-danger">{error}</p>
      )}
    </div>
  );
}

export default function AdminClient({ clients }: { clients: Client[] }) {
  if (clients.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Aucun client trouvé. Vérifie que la RLS policy admin est bien appliquée.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {clients.map((client) => (
        <ClientRow key={client.user_id} client={client} />
      ))}
    </div>
  );
}
