"use client";

import { useState, useTransition } from "react";
import {
  launchSearch,
  toggleResultSelection,
  sendSelectedInvitations,
  ignoreResult,
  ignoreSelectedIds,
  setSelectionForIds,
} from "./actions";

type SearchResult = {
  id: string;
  search_id: string;
  provider_id: string;
  full_name: string | null;
  headline: string | null;
  location: string | null;
  industry: string | null;
  current_company: string | null;
  status: string;
  created_at: string;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "A valider", className: "text-text-muted" },
  selected: { label: "Selectionne", className: "text-accent" },
  invited: { label: "Invitation envoyee", className: "text-positive" },
  ignored: { label: "Ignore", className: "text-text-dim" },
};

export default function ProspectsClient({ results }: { results: SearchResult[] }) {
  const [isPending, startTransition] = useTransition();
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLaunched, setSearchLaunched] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [maxResults, setMaxResults] = useState("");
  const maxResultsError =
    maxResults !== "" && (Number(maxResults) < 1 || Number(maxResults) > 50);

  // Statuts geres en etat local pour que les lignes ne se reordonnent jamais.
  // Initialise depuis les props (rechargees seulement au prochain chargement de page).
  const [statuses, setStatuses] = useState<Record<string, string>>(() =>
    Object.fromEntries(results.map((r) => [r.id, r.status]))
  );

  function handleSearch(formData: FormData) {
    setSearchError(null);
    setSearchLaunched(false);
    if (maxResultsError) {
      setSearchError("Choisis un nombre de profils entre 1 et 50.");
      return;
    }
    startTransition(async () => {
      const result = await launchSearch(formData);
      if (result.error) {
        setSearchError(result.error);
      } else {
        setSearchLaunched(true);
      }
    });
  }

  function handleToggle(id: string, selected: boolean) {
    setActionError(null);
    // Mise a jour optimiste locale : la ligne reste en place.
    setStatuses((prev) => ({ ...prev, [id]: selected ? "selected" : "pending" }));
    startTransition(async () => {
      const result = await toggleResultSelection(id, selected);
      if (result.error) setActionError(result.error);
    });
  }

  function handleToggleAll(ids: string[], selected: boolean) {
    setActionError(null);
    setStatuses((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = selected ? "selected" : "pending";
      return next;
    });
    startTransition(async () => {
      const result = await setSelectionForIds(ids, selected);
      if (result.error) setActionError(result.error);
    });
  }

  function handleSendInvitations(searchId: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await sendSelectedInvitations(searchId);
      if (result.error) setActionError(result.error);
    });
  }

  function handleIgnore(id: string) {
    setActionError(null);
    setStatuses((prev) => ({ ...prev, [id]: "ignored" }));
    startTransition(async () => {
      const result = await ignoreResult(id);
      if (result.error) setActionError(result.error);
    });
  }

  function handleIgnoreSelected(ids: string[]) {
    setActionError(null);
    setStatuses((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = "ignored";
      return next;
    });
    startTransition(async () => {
      const result = await ignoreSelectedIds(ids);
      if (result.error) setActionError(result.error);
    });
  }

  // Groupe les resultats par recherche, du plus recent au plus ancien.
  // L'ordre des lignes vient des props et ne change jamais (le statut vit dans l'etat local).
  const bySearch = new Map<string, SearchResult[]>();
  for (const r of results) {
    const list = bySearch.get(r.search_id) ?? [];
    list.push(r);
    bySearch.set(r.search_id, list);
  }

  return (
    <div className="space-y-6">
      {/* Formulaire de recherche */}
      <section className="rounded-md border border-border bg-panel p-5">
        <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-text-muted">
          Nouvelle recherche
        </h2>
        <p className="mt-1 text-xs text-text-dim">
          Recherche des profils LinkedIn correspondant a tes criteres. Maximum 50
          resultats par recherche. Les champs marques d&apos;un{" "}
          <span className="text-danger">*</span> sont obligatoires.
        </p>

        <form action={handleSearch} className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              Qui cherches-tu ? <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              name="keywords"
              required
              placeholder="directeur marketing"
              className="w-full rounded-md border border-border bg-panel-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
            />
            <p className="mt-1 text-xs text-text-dim">
              Le metier ou le poste des personnes que tu veux contacter.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                Ou se trouvent-elles ?
              </label>
              <input
                type="text"
                name="location"
                placeholder="Paris"
                className="w-full rounded-md border border-border bg-panel-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
              />
              <p className="mt-1 text-xs text-text-dim">
                Ville, region ou pays. Laisse vide pour ne pas filtrer.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                Quel niveau de relation ?
              </label>
              <select
                name="network_distance"
                className="w-full rounded-md border border-border bg-panel-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
              >
                <option value="">Tout le monde</option>
                <option value="1">Mes contacts</option>
                <option value="2">Contacts de mes contacts</option>
                <option value="3">Inconnus (3e degre et +)</option>
              </select>
              <p className="mt-1 text-xs text-text-dim">
                A quelle distance de toi sur LinkedIn doivent etre les profils.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                Combien de profils ?
              </label>
              <input
                type="number"
                name="max_results"
                min={1}
                max={50}
                value={maxResults}
                onChange={(e) => setMaxResults(e.target.value)}
                placeholder="50"
                aria-invalid={maxResultsError}
                className={`w-full rounded-md border bg-panel-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50 ${
                  maxResultsError ? "border-danger" : "border-border"
                }`}
              />
              {maxResultsError ? (
                <p className="mt-1 text-xs text-danger">
                  Choisis un nombre entre 1 et 50.
                </p>
              ) : (
                <p className="mt-1 text-xs text-text-dim">
                  Laisse vide pour 50 profils (le maximum).
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              Dans quel secteur ?
            </label>
            <input
              type="text"
              name="industry"
              placeholder="Logiciels"
              className="w-full rounded-md border border-border bg-panel-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
            />
            <p className="mt-1 text-xs text-text-dim">
              Le secteur d&apos;activite des entreprises visees. Optionnel.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              Postes a eviter
            </label>
            <input
              type="text"
              name="exclude_titles"
              placeholder="stagiaire, freelance, etudiant"
              className="w-full rounded-md border border-border bg-panel-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
            />
            <p className="mt-1 text-xs text-text-dim">
              Liste de mots separes par des virgules. Les profils dont le poste
              contient un de ces mots seront ecartes automatiquement.
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-md border border-border bg-panel-raised px-3 py-2.5">
            <input type="checkbox" name="auto_invite" className="mt-0.5" />
            <div>
              <span className="text-sm font-medium text-foreground">
                Envoi automatique des invitations
              </span>
              <p className="text-xs text-text-dim">
                Si active, les invitations sont envoyees directement aux profils
                trouves. Sinon, tu valides la liste avant l&apos;envoi.
              </p>
            </div>
          </label>

          {searchError && <p className="text-sm text-danger">{searchError}</p>}
          {searchLaunched && !searchError && (
            <p className="text-sm text-positive">
              Recherche lancee. Reviens dans quelques minutes pour voir les profils.
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="rounded-md border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
          >
            {isPending ? "Lancement..." : "Lancer la recherche"}
          </button>
        </form>
      </section>

      {actionError && <p className="text-sm text-danger">{actionError}</p>}

      {/* Resultats par recherche */}
      {bySearch.size === 0 && (
        <p className="text-sm text-text-dim">
          Aucun resultat pour le moment. Lance une recherche ci-dessus.
        </p>
      )}

      {Array.from(bySearch.entries()).map(([searchId, items]) => {
        // On masque localement les profils ignores sans recharger la page.
        const visibleItems = items.filter((r) => statuses[r.id] !== "ignored");
        if (visibleItems.length === 0) return null;

        const selectedCount = visibleItems.filter(
          (r) => statuses[r.id] === "selected"
        ).length;
        const invitedCount = visibleItems.filter(
          (r) => statuses[r.id] === "invited"
        ).length;
        const pendingCount = visibleItems.filter(
          (r) => statuses[r.id] === "pending"
        ).length;

        // Lignes encore cochables (a valider ou selectionnees) pour le "tout selectionner"
        const toggleableIds = visibleItems
          .filter((r) => statuses[r.id] === "pending" || statuses[r.id] === "selected")
          .map((r) => r.id);
        const allSelected =
          toggleableIds.length > 0 &&
          toggleableIds.every((id) => statuses[id] === "selected");

        const selectedIds = visibleItems
          .filter((r) => statuses[r.id] === "selected")
          .map((r) => r.id);

        const date = new Date(items[0].created_at).toLocaleString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <section key={searchId} className="rounded-md border border-border bg-panel p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-text-muted">
                Recherche du {date}
              </h3>
              {selectedCount > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleIgnoreSelected(selectedIds)}
                    disabled={isPending}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-panel-raised hover:text-danger disabled:opacity-50"
                  >
                    Ignorer la selection
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendInvitations(searchId)}
                    disabled={isPending}
                    className="rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
                  >
                    Envoyer {selectedCount} invitation{selectedCount > 1 ? "s" : ""}
                  </button>
                </div>
              )}
            </div>

            <p className="mb-3 text-xs text-text-dim">
              {visibleItems.length} profil{visibleItems.length > 1 ? "s" : ""} trouve
              {visibleItems.length > 1 ? "s" : ""}
              {pendingCount > 0 && ` · ${pendingCount} a valider`}
              {invitedCount > 0 && ` · ${invitedCount} invite${invitedCount > 1 ? "s" : ""}`}
            </p>

            {/* Tout selectionner */}
            {toggleableIds.length > 0 && (
              <label className="mb-2 flex items-center gap-3 rounded-md border border-border bg-panel-raised px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  disabled={isPending}
                  onChange={(e) => handleToggleAll(toggleableIds, e.target.checked)}
                />
                <span className="text-xs font-medium text-text-muted">
                  {allSelected ? "Tout deselectionner" : "Tout selectionner"}
                </span>
              </label>
            )}

            <div className="space-y-1.5">
              {visibleItems.map((r) => {
                const status = statuses[r.id] ?? "pending";
                const statusInfo = STATUS_LABELS[status] ?? STATUS_LABELS.pending;
                const canToggle = status === "pending" || status === "selected";

                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-panel-raised px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={status === "selected"}
                      disabled={!canToggle || isPending}
                      onChange={(e) => handleToggle(r.id, e.target.checked)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {r.full_name ?? "Profil sans nom"}
                      </p>
                      <p className="truncate text-xs text-text-dim">
                        {r.headline ?? "—"}
                        {r.location ? ` · ${r.location}` : ""}
                      </p>
                      {(r.current_company || r.industry) && (
                        <p className="truncate text-xs text-text-dim">
                          {[r.current_company, r.industry]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs font-medium ${statusInfo.className}`}>
                      {statusInfo.label}
                    </span>
                    {canToggle && (
                      <button
                        type="button"
                        onClick={() => handleIgnore(r.id)}
                        disabled={isPending}
                        title="Ignorer ce profil"
                        className="shrink-0 rounded-md border border-transparent p-1 text-text-dim transition-colors hover:border-border hover:bg-panel hover:text-danger disabled:opacity-50"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
