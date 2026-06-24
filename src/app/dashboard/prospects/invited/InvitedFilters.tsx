"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

type Campaign = { id: string; name: string | null };

export default function InvitedFilters({
  campaigns,
  defaultCampaign,
  defaultSearch,
  defaultDateFrom,
  defaultDateTo,
}: {
  campaigns: Campaign[];
  defaultCampaign: string | null;
  defaultSearch: string | null;
  defaultDateFrom: string | null;
  defaultDateTo: string | null;
}) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  function submit(overrides: Record<string, string> = {}) {
    const search = searchRef.current?.value.trim() ?? "";
    const campaign = (document.getElementById("filter-campaign") as HTMLSelectElement)?.value ?? "";
    const dateFrom = (document.getElementById("filter-date-from") as HTMLInputElement)?.value ?? "";
    const dateTo = (document.getElementById("filter-date-to") as HTMLInputElement)?.value ?? "";

    const params = new URLSearchParams();
    const values = { search, campaign, date_from: dateFrom, date_to: dateTo, page: "1", ...overrides };
    for (const [k, v] of Object.entries(values)) {
      if (v) params.set(k, v);
    }
    router.push(`/dashboard/prospects/invited?${params.toString()}`);
  }

  function reset() {
    if (searchRef.current) searchRef.current.value = "";
    router.push("/dashboard/prospects/invited");
  }

  const hasFilters = defaultCampaign || defaultSearch || defaultDateFrom || defaultDateTo;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-campaign" className="text-xs text-text-dim">
          Campagne
        </label>
        <select
          id="filter-campaign"
          defaultValue={defaultCampaign ?? ""}
          onChange={() => submit()}
          className="rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent/50"
        >
          <option value="">Toutes les campagnes</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name ?? "Sans nom"}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-search" className="text-xs text-text-dim">
          Recherche
        </label>
        <div className="flex gap-1">
          <input
            id="filter-search"
            ref={searchRef}
            type="text"
            defaultValue={defaultSearch ?? ""}
            placeholder="Nom du prospect..."
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            className="rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-foreground placeholder:text-text-dim outline-none focus:border-accent/50"
          />
          <button
            type="button"
            onClick={() => submit()}
            className="rounded-md border border-border bg-panel-raised px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-panel hover:text-foreground"
          >
            OK
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-date-from" className="text-xs text-text-dim">
          Du
        </label>
        <input
          id="filter-date-from"
          type="date"
          defaultValue={defaultDateFrom ?? ""}
          onChange={() => submit()}
          className="rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent/50"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-date-to" className="text-xs text-text-dim">
          Au
        </label>
        <input
          id="filter-date-to"
          type="date"
          defaultValue={defaultDateTo ?? ""}
          onChange={() => submit()}
          className="rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent/50"
        />
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text-dim transition-colors hover:text-danger"
        >
          Effacer les filtres
        </button>
      )}
    </div>
  );
}
