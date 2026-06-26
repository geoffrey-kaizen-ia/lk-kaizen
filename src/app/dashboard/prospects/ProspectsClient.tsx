"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createCampaign,
  archiveCampaign,
  deleteCampaign,
  updateCampaignStatus,
  addToQueue,
  removeFromQueue,
  ignoreResult,
  ignoreSelectedIds,
  renameCampaign,
} from "./actions";
import IndustryPicker from "./IndustryPicker";
import TitlePicker from "./TitlePicker";

// Reconstruit la liste des titres à partir des query_params d'une campagne à
// dupliquer : on lit d'abord keywords_list (nouveau format), sinon on retombe
// sur l'ancien champ keywords texte libre (séparé par OR ou virgule).
function titlesFromParams(qp: Record<string, unknown> | null | undefined): string[] {
  if (!qp) return [];
  const list = qp.keywords_list;
  if (Array.isArray(list)) return list.filter((t): t is string => typeof t === "string");
  const raw = (qp.keywords ?? qp.search_keywords) as string | undefined;
  if (!raw) return [];
  return raw
    .split(/\s+OR\s+|,/i)
    .map((t) => t.replace(/"/g, "").trim())
    .filter(Boolean);
}

type Campaign = {
  id: string;
  name: string | null;
  status: string;
  total_scraped: number;
  target_count: number;
  mode: string;
  created_at: string;
  query_params: Record<string, unknown> | null;
};

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
  sent_at?: string | null;
};

const CAMPAIGN_STATUS: Record<string, { label: string; dot: string }> = {
  active:   { label: "En cours", dot: "bg-positive" },
  paused:   { label: "En pause", dot: "bg-text-dim" },
  done:     { label: "Terminé",  dot: "bg-accent" },
  archived: { label: "Archivé",  dot: "bg-text-dim opacity-50" },
};

function getQueueTiming(position: number, remainingToday: number): string {
  return position < remainingToday ? "En cours" : "Prochaine session";
}

function CampaignFilter({
  campaigns,
  value,
  onChange,
}: {
  campaigns: Campaign[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  if (campaigns.length <= 1) return null;
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded-md border border-border bg-panel-raised px-2 py-1 text-xs text-text-muted outline-none focus:border-accent/50"
    >
      <option value="">Toutes les campagnes</option>
      {campaigns.map((c) => (
        <option key={c.id} value={c.id}>{c.name ?? "Sans nom"}</option>
      ))}
    </select>
  );
}

export default function ProspectsClient({
  campaigns,
  pendingResults,
  selectedResults,
  invitedResults,
  invitesToday,
  dailyInviteLimit,
  messagesToday,
  dailyMessageLimit,
}: {
  campaigns: Campaign[];
  pendingResults: SearchResult[];
  selectedResults: SearchResult[];
  invitedResults: SearchResult[];
  invitesToday: number;
  dailyInviteLimit: number;
  messagesToday: number;
  dailyMessageLimit: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [prefillData, setPrefillData] = useState<Campaign | null>(null);
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Verrou du scroll de la page tant qu'une modale est ouverte, sinon le fond
  // scrolle a la place de la modale et les boutons du bas deviennent inatteignables.
  const anyModalOpen = showModal || !!detailCampaign || !!confirmDeleteId;
  useEffect(() => {
    if (anyModalOpen) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [anyModalOpen]);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [campaignNames, setCampaignNames] = useState<Record<string, string>>(
    () => Object.fromEntries(campaigns.map((c) => [c.id, c.name ?? ""]))
  );

  // Filtres indépendants par section
  const [filterPending, setFilterPending] = useState<string | null>(null);
  const [filterQueue, setFilterQueue] = useState<string | null>(null);
  const [filterInvited, setFilterInvited] = useState<string | null>(null);

  // Accordéons
  const [openQueue, setOpenQueue] = useState(true);
  const [openPending, setOpenPending] = useState(true);
  const [openInvited, setOpenInvited] = useState(false);
  const [openArchived, setOpenArchived] = useState(false);

  const [campaignStatuses, setCampaignStatuses] = useState<Record<string, string>>(
    () => Object.fromEntries(campaigns.map((c) => [c.id, c.status]))
  );

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [hiddenPending, setHiddenPending] = useState<Set<string>>(new Set());
  const [hiddenSelected, setHiddenSelected] = useState<Set<string>>(new Set());

  const campaignById = new Map(campaigns.map((c) => [c.id, c]));

  // Compteurs réels par campagne (depuis les résultats, pas total_scraped)
  const countByCampaign = (results: SearchResult[], hidden: Set<string>) => {
    const map: Record<string, number> = {};
    for (const r of results) {
      if (!hidden.has(r.id)) map[r.search_id] = (map[r.search_id] ?? 0) + 1;
    }
    return map;
  };

  const pendingCountByCampaign  = countByCampaign(pendingResults, hiddenPending);
  const selectedCountByCampaign = countByCampaign(selectedResults, hiddenSelected);
  const invitedCountByCampaign  = countByCampaign(invitedResults, new Set());

  // Compteur scrapé réel = pending + selected + invited
  const actualScrapedByCampaign: Record<string, number> = {};
  for (const [id, n] of Object.entries(pendingCountByCampaign))  actualScrapedByCampaign[id] = (actualScrapedByCampaign[id] ?? 0) + n;
  for (const [id, n] of Object.entries(selectedCountByCampaign)) actualScrapedByCampaign[id] = (actualScrapedByCampaign[id] ?? 0) + n;
  for (const [id, n] of Object.entries(invitedCountByCampaign))  actualScrapedByCampaign[id] = (actualScrapedByCampaign[id] ?? 0) + n;

  const visiblePending  = pendingResults.filter((r) => !hiddenPending.has(r.id) && (!filterPending || r.search_id === filterPending));
  const visibleSelected = selectedResults.filter((r) => !hiddenSelected.has(r.id) && (!filterQueue || r.search_id === filterQueue));
  const visibleInvited  = invitedResults.filter((r) => !filterInvited || r.search_id === filterInvited);

  const pendingByCampaign = new Map<string, SearchResult[]>();
  for (const r of visiblePending) {
    const list = pendingByCampaign.get(r.search_id) ?? [];
    list.push(r);
    pendingByCampaign.set(r.search_id, list);
  }

  const remainingToday = Math.max(0, dailyInviteLimit - invitesToday);
  const invitesPct = Math.min(100, Math.round((invitesToday / dailyInviteLimit) * 100));
  const msgPct = Math.min(100, Math.round((messagesToday / dailyMessageLimit) * 100));
  const checkedCount = checkedIds.size;

  const queueSummary = (() => {
    if (visibleSelected.length === 0) return "Vide · aucune invitation planifiée";
    if (visibleSelected.length <= remainingToday) return `${visibleSelected.length} en cours · prochaine session`;
    const sessions = Math.ceil((visibleSelected.length - remainingToday) / dailyInviteLimit) + 1;
    return `${remainingToday} en cours · ${visibleSelected.length - remainingToday} sur ${sessions} sessions suivantes`;
  })();

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleCreateCampaign(formData: FormData) {
    setFormError(null);
    startTransition(async () => {
      const res = await createCampaign(formData);
      if (res.error) setFormError(res.error);
      else setShowModal(false);
    });
  }

  function handleToggleCampaignStatus(id: string, current: string) {
    const next = current === "active" ? "paused" : "active";
    setCampaignStatuses((prev) => ({ ...prev, [id]: next }));
    startTransition(async () => {
      const res = await updateCampaignStatus(id, next as "active" | "paused");
      if (res.error) {
        setCampaignStatuses((prev) => ({ ...prev, [id]: current }));
        setActionError(res.error);
      }
    });
  }

  function handleDuplicate(c: Campaign) {
    setPrefillData(c);
    setDetailCampaign(null);
    setShowModal(true);
    setFormError(null);
  }

  function handleStartRename(c: Campaign) {
    setNameValue(campaignNames[c.id] ?? c.name ?? "");
    setEditingName(true);
  }

  function handleSaveRename(id: string) {
    const trimmed = nameValue.trim();
    setEditingName(false);
    if (!trimmed || trimmed === (campaignNames[id] ?? "")) return;
    setCampaignNames((prev) => ({ ...prev, [id]: trimmed }));
    if (detailCampaign?.id === id) {
      setDetailCampaign((prev) => prev ? { ...prev, name: trimmed } : prev);
    }
    startTransition(async () => {
      const res = await renameCampaign(id, trimmed);
      if (res.error) {
        setCampaignNames((prev) => ({ ...prev, [id]: detailCampaign?.name ?? "" }));
        setActionError(res.error);
      }
    });
  }

  function handleArchive(id: string) {
    setDetailCampaign(null);
    setActionError(null);
    startTransition(async () => {
      const res = await archiveCampaign(id);
      if (res.error) setActionError(res.error);
    });
  }

  function handleDeleteCampaign(id: string) {
    setConfirmDeleteId(null);
    setActionError(null);
    startTransition(async () => {
      const res = await deleteCampaign(id);
      if (res.error) setActionError(res.error);
      else if (detailCampaign?.id === id) setDetailCampaign(null);
    });
  }

  function handleCheck(id: string, checked: boolean) {
    setCheckedIds((prev) => { const n = new Set(prev); if (checked) n.add(id); else n.delete(id); return n; });
  }

  function handleCheckAll(ids: string[], checked: boolean) {
    setCheckedIds((prev) => {
      const n = new Set(prev);
      for (const id of ids) { if (checked) n.add(id); else n.delete(id); }
      return n;
    });
  }

  function handleAddToQueue() {
    const ids = [...checkedIds];
    if (ids.length === 0) return;
    setActionError(null);
    setHiddenPending((prev) => new Set([...prev, ...ids]));
    setCheckedIds(new Set());
    startTransition(async () => {
      const res = await addToQueue(ids);
      if (res.error) {
        setHiddenPending((prev) => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
        setActionError(res.error);
      }
    });
  }

  function handleRemoveFromQueue(ids: string[]) {
    setActionError(null);
    setHiddenSelected((prev) => new Set([...prev, ...ids]));
    startTransition(async () => {
      const res = await removeFromQueue(ids);
      if (res.error) {
        setHiddenSelected((prev) => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
        setActionError(res.error);
      }
    });
  }

  function handleIgnore(id: string) {
    setActionError(null);
    setHiddenPending((prev) => new Set([...prev, id]));
    setCheckedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    startTransition(async () => {
      const res = await ignoreResult(id);
      if (res.error) {
        setHiddenPending((prev) => { const n = new Set(prev); n.delete(id); return n; });
        setActionError(res.error);
      }
    });
  }

  function handleIgnoreChecked() {
    const ids = [...checkedIds];
    if (ids.length === 0) return;
    setActionError(null);
    setHiddenPending((prev) => new Set([...prev, ...ids]));
    setCheckedIds(new Set());
    startTransition(async () => {
      const res = await ignoreSelectedIds(ids);
      if (res.error) {
        setHiddenPending((prev) => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
        setActionError(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">

      {/* ── Quotas du jour ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-border gap-px">
        <div className="bg-panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Invitations aujourd&apos;hui</span>
            <span className="text-sm font-semibold text-foreground">{invitesToday} / {dailyInviteLimit}</span>
          </div>
          <div className="h-1.5 rounded-full bg-panel-raised">
            <div
              className={`h-1.5 rounded-full transition-all ${invitesPct >= 100 ? "bg-warning" : "bg-accent"}`}
              style={{ width: `${invitesPct}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-text-dim">
            {remainingToday > 0
              ? `${remainingToday} restante${remainingToday > 1 ? "s" : ""} aujourd'hui`
              : "Quota atteint pour aujourd'hui"}
          </p>
        </div>
        <div className="bg-panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Messages aujourd&apos;hui</span>
            <span className="text-sm font-semibold text-foreground">{messagesToday} / {dailyMessageLimit}</span>
          </div>
          <div className="h-1.5 rounded-full bg-panel-raised">
            <div
              className={`h-1.5 rounded-full transition-all ${msgPct >= 100 ? "bg-warning" : "bg-accent"}`}
              style={{ width: `${msgPct}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-text-dim">
            {msgPct >= 100 ? "Quota atteint pour aujourd'hui" : `${dailyMessageLimit - messagesToday} restant${dailyMessageLimit - messagesToday > 1 ? "s" : ""} aujourd'hui`}
          </p>
        </div>
      </div>

      {/* ── Campagnes ──────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-text-muted">
            Campagnes
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => startTransition(() => { router.refresh(); })}
              disabled={isPending}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-panel-raised disabled:opacity-50"
            >
              {isPending ? "..." : "Rafraîchir"}
            </button>
            <button
              type="button"
              onClick={() => { setShowModal(true); setFormError(null); }}
              className="rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
            >
              + Nouvelle campagne
            </button>
          </div>
        </div>

        {campaigns.length === 0 && (
          <p className="rounded-md border border-border bg-panel px-5 py-8 text-center text-sm text-text-dim">
            Aucune campagne. Crée-en une pour commencer.
          </p>
        )}

        <div className="space-y-2">
          {campaigns.filter((c) => c.status !== "archived").map((c) => {
            const statusKey = campaignStatuses[c.id] ?? c.status;
            const statusInfo = CAMPAIGN_STATUS[statusKey] ?? CAMPAIGN_STATUS.active;
            const actualScraped = actualScrapedByCampaign[c.id] ?? 0;
            const pct = c.target_count > 0 ? Math.min(100, Math.round((actualScraped / c.target_count) * 100)) : 0;
            const isDone = statusKey === "done";
            const nPending  = pendingCountByCampaign[c.id]  ?? 0;
            const nSelected = selectedCountByCampaign[c.id] ?? 0;
            const nInvited  = invitedCountByCampaign[c.id]  ?? 0;

            return (
              <div
                key={c.id}
                onClick={() => setDetailCampaign(c)}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-panel px-4 py-3 transition-colors hover:border-accent/30"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${statusInfo.dot}`} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {campaignNames[c.id] ?? c.name ?? "Sans nom"}
                </span>

                <div className="hidden items-center gap-2 sm:flex">
                  <div className="h-1.5 w-20 rounded-full bg-panel-raised">
                    <div className="h-1.5 rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="whitespace-nowrap text-xs text-text-dim">
                    {Math.min(actualScraped, c.target_count)}/{c.target_count}
                  </span>
                </div>

                <div className="hidden items-center gap-3 text-xs sm:flex">
                  {nPending > 0  && <span className="text-text-muted">{nPending} à valider</span>}
                  {nSelected > 0 && <span className="text-accent">{nSelected} en file</span>}
                  {nInvited > 0  && <span className="text-positive">{nInvited} invité{nInvited > 1 ? "s" : ""}</span>}
                  {nPending === 0 && nSelected === 0 && nInvited === 0 && (
                    <span className="text-text-dim">Aucun profil encore</span>
                  )}
                </div>

                <span className="shrink-0 rounded-sm bg-panel-raised px-1.5 py-0.5 text-xs text-text-dim">
                  {c.mode === "auto" ? "Auto" : "Manuel"}
                </span>

                {!isDone && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleToggleCampaignStatus(c.id, statusKey); }}
                    disabled={isPending}
                    className="shrink-0 text-xs text-text-dim transition-colors hover:text-text-muted disabled:opacity-50"
                  >
                    {statusKey === "active" ? "Pause" : "Reprendre"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(c.id); }}
                  disabled={isPending}
                  title="Supprimer"
                  className="shrink-0 text-text-dim transition-colors hover:text-danger disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Archives ───────────────────────────────────────────────────── */}
      {campaigns.some((c) => c.status === "archived") && (
        <section>
          <button
            type="button"
            onClick={() => setOpenArchived((v) => !v)}
            className="flex items-center gap-2 group"
          >
            <svg className={`h-3.5 w-3.5 text-text-dim transition-transform ${openArchived ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-text-dim group-hover:text-text-muted">
              Archives ({campaigns.filter((c) => c.status === "archived").length})
            </h2>
          </button>

          {openArchived && (
            <div className="mt-3 space-y-2">
              {campaigns.filter((c) => c.status === "archived").map((c) => {
                const actualScraped = actualScrapedByCampaign[c.id] ?? 0;
                const nInvited = invitedCountByCampaign[c.id] ?? 0;
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-panel px-4 py-3 opacity-60"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-text-dim opacity-40" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-muted">
                      {c.name ?? "Sans nom"}
                    </span>
                    <div className="hidden items-center gap-3 text-xs sm:flex">
                      <span className="text-text-dim">{Math.min(actualScraped, c.target_count)}/{c.target_count} scrapés</span>
                      {nInvited > 0 && <span className="text-text-dim">{nInvited} invité{nInvited > 1 ? "s" : ""}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(c.id)}
                      disabled={isPending}
                      title="Supprimer définitivement"
                      className="shrink-0 text-text-dim transition-colors hover:text-danger disabled:opacity-50"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {actionError && <p className="text-sm text-danger">{actionError}</p>}

      {/* ── File d'attente ─────────────────────────────────────────────── */}
      {selectedResults.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setOpenQueue((v) => !v)}
                className="flex items-center gap-2 group"
              >
                <svg className={`h-3.5 w-3.5 text-text-dim transition-transform ${openQueue ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-text-muted group-hover:text-foreground">
                  File d&apos;attente ({visibleSelected.length})
                </h2>
              </button>
              {openQueue && <CampaignFilter campaigns={campaigns} value={filterQueue} onChange={setFilterQueue} />}
            </div>
            {openQueue && (
              <button
                type="button"
                onClick={() => handleRemoveFromQueue(visibleSelected.map((r) => r.id))}
                disabled={isPending}
                className="text-xs text-text-dim transition-colors hover:text-danger disabled:opacity-50"
              >
                Tout retirer
              </button>
            )}
          </div>

          {openQueue && <div className="overflow-hidden rounded-md border border-border bg-panel">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-panel-raised">
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-dim">Prospect</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-dim">Campagne</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-dim">Statut</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleSelected.map((r, i) => {
                  const timing = getQueueTiming(i, remainingToday);
                  const campaign = campaignById.get(r.search_id);
                  return (
                    <tr key={r.id} className="hover:bg-panel-raised">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{r.full_name ?? "—"}</p>
                        {r.headline && <p className="max-w-xs truncate text-xs text-text-dim">{r.headline}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">{campaign?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${timing === "En cours" ? "text-positive" : "text-text-dim"}`}>
                          {timing}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveFromQueue([r.id])}
                          disabled={isPending}
                          className="text-xs text-text-dim transition-colors hover:text-danger disabled:opacity-50"
                        >
                          Retirer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>}
        </section>
      )}

      {/* ── À valider ──────────────────────────────────────────────────── */}
      {(pendingResults.length > 0 || filterPending) && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setOpenPending((v) => !v)}
                className="flex items-center gap-2 group"
              >
                <svg className={`h-3.5 w-3.5 text-text-dim transition-transform ${openPending ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-text-muted group-hover:text-foreground">
                  À valider ({visiblePending.length})
                </h2>
              </button>
              {openPending && <CampaignFilter campaigns={campaigns} value={filterPending} onChange={setFilterPending} />}
            </div>
            {openPending && checkedCount > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleIgnoreChecked}
                  disabled={isPending}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-panel-raised hover:text-danger disabled:opacity-50"
                >
                  Ignorer ({checkedCount})
                </button>
                <button
                  type="button"
                  onClick={handleAddToQueue}
                  disabled={isPending}
                  className="rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
                >
                  Ajouter à la file ({checkedCount})
                </button>
              </div>
            )}
          </div>

          {openPending && <div className="space-y-4">
            {Array.from(pendingByCampaign.entries()).map(([searchId, items]) => {
              const campaign = campaignById.get(searchId);
              const campaignCheckedIds = items.map((r) => r.id).filter((id) => checkedIds.has(id));
              const allChecked = items.length > 0 && items.every((r) => checkedIds.has(r.id));

              return (
                <div key={searchId} className="rounded-md border border-border bg-panel p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">
                      {campaign?.name ?? "Campagne"}
                      <span className="ml-2 text-xs font-normal text-text-dim">
                        {items.length} profil{items.length > 1 ? "s" : ""}
                      </span>
                    </h3>
                  </div>

                  <label className="mb-2 flex cursor-pointer items-center gap-3 rounded-md border border-border bg-panel-raised px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      disabled={isPending}
                      onChange={(e) => handleCheckAll(items.map((r) => r.id), e.target.checked)}
                    />
                    <span className="text-xs font-medium text-text-muted">
                      {allChecked ? "Tout décocher" : "Tout sélectionner"}
                    </span>
                    {campaignCheckedIds.length > 0 && !allChecked && (
                      <span className="text-xs text-text-dim">
                        {campaignCheckedIds.length} sélectionné{campaignCheckedIds.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </label>

                  <div className="space-y-1.5">
                    {items.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 rounded-md border border-border bg-panel-raised px-3 py-2">
                        <input
                          type="checkbox"
                          checked={checkedIds.has(r.id)}
                          disabled={isPending}
                          onChange={(e) => handleCheck(r.id, e.target.checked)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{r.full_name ?? "Profil sans nom"}</p>
                          <p className="truncate text-xs text-text-dim">
                            {r.headline ?? "—"}{r.location ? ` · ${r.location}` : ""}
                          </p>
                          {(r.current_company || r.industry) && (
                            <p className="truncate text-xs text-text-dim">
                              {[r.current_company, r.industry].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
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
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {visiblePending.length === 0 && (
              <p className="rounded-md border border-border bg-panel px-5 py-6 text-center text-sm text-text-dim">
                Aucun profil à valider{filterPending ? " pour cette campagne" : ""}.
              </p>
            )}
          </div>}
        </section>
      )}

      {/* ── Invitations envoyées (30 dernières) ───────────────────────── */}
      {invitedResults.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setOpenInvited((v) => !v)}
              className="flex items-center gap-2 group"
            >
              <svg className={`h-3.5 w-3.5 text-text-dim transition-transform ${openInvited ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-text-muted group-hover:text-foreground">
                Dernières invitations ({invitedResults.length})
              </h2>
            </button>
            <a
              href="/dashboard/prospects/invited"
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-panel-raised hover:text-foreground"
            >
              Voir toutes les invitations →
            </a>
          </div>

          {openInvited && (
            <div className="overflow-hidden rounded-md border border-border bg-panel">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-panel-raised">
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-dim">Prospect</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-dim">Campagne</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-dim">Invité le</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invitedResults.map((r) => {
                    const campaign = campaignById.get(r.search_id);
                    return (
                      <tr key={r.id} className="hover:bg-panel-raised">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{r.full_name ?? "—"}</p>
                          {r.headline && <p className="max-w-xs truncate text-xs text-text-dim">{r.headline}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-text-muted">{campaign?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-text-dim">
                          {new Date(r.sent_at ?? r.created_at).toLocaleDateString("fr-FR")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-border px-4 py-2.5 text-center">
                <a
                  href="/dashboard/prospects/invited"
                  className="text-xs text-text-dim transition-colors hover:text-accent"
                >
                  Voir toutes les invitations →
                </a>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Modal détail campagne ─────────────────────────────────────── */}
      {detailCampaign && (() => {
        const c = detailCampaign;
        const statusKey = campaignStatuses[c.id] ?? c.status;
        const statusInfo = CAMPAIGN_STATUS[statusKey] ?? CAMPAIGN_STATUS.active;
        const actualScraped = actualScrapedByCampaign[c.id] ?? 0;
        const pct = c.target_count > 0 ? Math.min(100, Math.round((actualScraped / c.target_count) * 100)) : 0;
        const nPending  = pendingCountByCampaign[c.id]  ?? 0;
        const nSelected = selectedCountByCampaign[c.id] ?? 0;
        const nInvited  = invitedCountByCampaign[c.id]  ?? 0;
        const qp = c.query_params ?? {};
        // Compatibilité ancien format n8n (search_keywords…) vs nouveau format dashboard (keywords…)
        // Affichage lisible : on préfère la liste de titres (séparés par des
        // virgules) plutôt que la requête brute "x" OR "y".
        const titleList = titlesFromParams(qp);
        const keywords = titleList.length > 0
          ? titleList.join(", ")
          : (qp.keywords ?? qp.search_keywords ?? "") as string;
        const location = (qp.location ?? qp.search_location ?? "") as string;
        const industry = (qp.industry ?? qp.search_industry ?? "") as string;
        const rawNetwork = qp.network_distance ?? qp.search_network_distance;
        const networkLabel = Array.isArray(rawNetwork)
          ? rawNetwork.join(", ")
          : rawNetwork === "2,3" ? "2e et 3e degré"
          : rawNetwork === "2" ? "2e degré"
          : rawNetwork === "3" ? "3e degré et +"
          : rawNetwork ? String(rawNetwork) : "";
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-8" onClick={() => { setDetailCampaign(null); setEditingName(false); }}>
            <div className="w-full max-w-md rounded-lg border border-border bg-panel p-6 shadow-2xl overscroll-contain" onClick={(e) => e.stopPropagation()}>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${statusInfo.dot}`} />
                  {editingName ? (
                    <input
                      autoFocus
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      onBlur={() => handleSaveRename(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveRename(c.id);
                        if (e.key === "Escape") setEditingName(false);
                      }}
                      className="min-w-0 flex-1 rounded-md border border-accent/50 bg-panel-raised px-2 py-0.5 font-display text-base font-semibold text-foreground outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartRename(c)}
                      title="Cliquer pour renommer"
                      className="min-w-0 truncate font-display text-base font-semibold text-foreground hover:text-accent"
                    >
                      {campaignNames[c.id] ?? c.name ?? "Sans nom"}
                    </button>
                  )}
                </div>
                <button type="button" onClick={() => { setDetailCampaign(null); setEditingName(false); }} className="ml-2 shrink-0 text-text-dim hover:text-foreground">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-1.5 flex justify-between text-xs text-text-muted">
                    <span>Profils retenus</span>
                    <span>{Math.min(actualScraped, c.target_count)} / {c.target_count} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-panel-raised">
                    <div className="h-2 rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md border border-border bg-panel-raised p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{nPending}</p>
                    <p className="text-xs text-text-dim">À valider</p>
                  </div>
                  <div className="rounded-md border border-border bg-panel-raised p-3 text-center">
                    <p className="text-lg font-bold text-accent">{nSelected}</p>
                    <p className="text-xs text-text-dim">En file</p>
                  </div>
                  <div className="rounded-md border border-border bg-panel-raised p-3 text-center">
                    <p className="text-lg font-bold text-positive">{nInvited}</p>
                    <p className="text-xs text-text-dim">Invités</p>
                  </div>
                </div>

                <div className="space-y-1.5 rounded-md border border-border bg-panel-raised px-3 py-2.5 text-xs">
                  {!!keywords && (
                    <div className="flex justify-between gap-4">
                      <span className="shrink-0 text-text-dim">Mots-clés</span>
                      <span className="text-right font-medium text-foreground">{keywords}</span>
                    </div>
                  )}
                  {!!location && (
                    <div className="flex justify-between gap-4">
                      <span className="shrink-0 text-text-dim">Localisation</span>
                      <span className="text-right font-medium text-foreground">{location}</span>
                    </div>
                  )}
                  {!!networkLabel && (
                    <div className="flex justify-between gap-4">
                      <span className="shrink-0 text-text-dim">Réseau</span>
                      <span className="text-right font-medium text-foreground">{networkLabel}</span>
                    </div>
                  )}
                  {!!industry && (
                    <div className="flex justify-between gap-4">
                      <span className="shrink-0 text-text-dim">Secteur</span>
                      <span className="text-right font-medium text-foreground">{industry}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <span className="shrink-0 text-text-dim">Objectif</span>
                    <span className="font-medium text-foreground">{c.target_count} profils</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="shrink-0 text-text-dim">Mode</span>
                    <span className="font-medium text-foreground">{c.mode === "auto" ? "Invitation auto" : "Validation manuelle"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="shrink-0 text-text-dim">Statut</span>
                    <span className="font-medium text-foreground">{statusInfo.label}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="shrink-0 text-text-dim">Créée le</span>
                    <span className="font-medium text-foreground">{new Date(c.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  {statusKey !== "done" && statusKey !== "archived" && (
                    <button
                      type="button"
                      onClick={() => { handleToggleCampaignStatus(c.id, statusKey); setDetailCampaign(null); }}
                      disabled={isPending}
                      className="rounded-md border border-border px-3 py-2 text-sm font-medium text-text-muted hover:bg-panel-raised disabled:opacity-50"
                    >
                      {statusKey === "active" ? "Mettre en pause" : "Reprendre"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDuplicate(c)}
                    className="rounded-md border border-border px-3 py-2 text-sm font-medium text-text-muted hover:bg-panel-raised"
                  >
                    Dupliquer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(c.id)}
                    disabled={isPending}
                    className="rounded-md border border-border px-3 py-2 text-sm font-medium text-text-muted hover:border-warning/30 hover:text-warning disabled:opacity-50"
                  >
                    Archiver
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDetailCampaign(null); setConfirmDeleteId(c.id); }}
                    className="rounded-md border border-border px-3 py-2 text-sm font-medium text-text-muted hover:border-danger/30 hover:text-danger"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal confirmation suppression ────────────────────────────── */}
      {confirmDeleteId && (() => {
        const c = campaignById.get(confirmDeleteId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmDeleteId(null)}>
            <div className="w-full max-w-sm rounded-lg border border-border bg-panel p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-2 font-display text-base font-semibold text-foreground">Supprimer la campagne</h3>
              <p className="mb-5 text-sm text-text-muted">
                Supprimer <strong>{c?.name ?? "cette campagne"}</strong> et tous ses profils ? Cette action est irréversible.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleDeleteCampaign(confirmDeleteId)}
                  disabled={isPending}
                  className="flex-1 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/20 disabled:opacity-50"
                >
                  {isPending ? "Suppression..." : "Supprimer"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-panel-raised"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal nouvelle campagne ────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-8">
          <div className="w-full max-w-lg rounded-lg border border-border bg-panel p-6 shadow-2xl overscroll-contain">
            <h3 className="mb-5 font-display text-base font-semibold text-foreground">
              {prefillData ? `Dupliquer — ${prefillData.name ?? "Campagne"}` : "Nouvelle campagne"}
            </h3>
            <form key={prefillData?.id ?? "new"} action={handleCreateCampaign} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">Nom de la campagne <span className="text-danger">*</span></label>
                  <input type="text" name="name" required placeholder="Ex : Directeurs marketing Paris" defaultValue={prefillData ? `${prefillData.name ?? ""} (copie)` : ""} className="w-full rounded-md border border-border bg-panel-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">Quel profil cherches-tu ? <span className="text-danger">*</span></label>
                  <TitlePicker defaultTitles={titlesFromParams(prefillData?.query_params)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">Localisation</label>
                  <input type="text" name="location" placeholder="Ex : Paris, Lyon, France" defaultValue={(prefillData?.query_params?.location as string) ?? ""} className="w-full rounded-md border border-border bg-panel-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">Secteur d&apos;activité</label>
                  <IndustryPicker
                    defaultId={(prefillData?.query_params?.industry_id as string) ?? null}
                    defaultLabel={(prefillData?.query_params?.industry as string) ?? null}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-xs font-medium text-text-muted">Niveau de relation</label>
                  <div className="space-y-2">
                    {[
                      { value: "2,3", label: "2e et 3e degré", desc: "Amis d'amis + inconnus — le plus large panel.", recommended: true },
                      { value: "2",   label: "2e degré uniquement", desc: "Contacts de tes contacts — taux d'acceptation plus élevé." },
                      { value: "3",   label: "3e degré et +", desc: "Inconnus hors de ton réseau — volume maximal." },
                    ].map(({ value, label, desc, recommended }) => (
                      <label key={value} className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-panel-raised px-3 py-2.5 hover:border-accent/30">
                        <input type="radio" name="network_distance" value={value} defaultChecked={(prefillData?.query_params?.network_distance as string ?? "2,3") === value} className="mt-0.5 shrink-0" />
                        <div>
                          <span className="text-sm font-medium text-foreground">{label}</span>
                          {recommended && <span className="ml-2 rounded-sm bg-accent/10 px-1.5 py-0.5 text-xs font-medium text-accent">Recommandé</span>}
                          <p className="mt-0.5 text-xs text-text-dim">{desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">Objectif (profils)</label>
                  <input type="number" name="target_count" min={1} max={5000} defaultValue={prefillData?.target_count ?? 500} className="w-full rounded-md border border-border bg-panel-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50" />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-text-muted">Mode</label>
                <div className="flex gap-3">
                  <label className="flex flex-1 cursor-pointer items-start gap-2.5 rounded-md border border-border bg-panel-raised px-3 py-2.5">
                    <input type="radio" name="mode" value="validation" defaultChecked={(prefillData?.mode ?? "validation") === "validation"} className="mt-0.5" />
                    <div>
                      <span className="text-sm font-medium text-foreground">Validation manuelle</span>
                      <p className="text-xs text-text-dim">Tu choisis les profils avant l&apos;envoi.</p>
                    </div>
                  </label>
                  <label className="flex flex-1 cursor-pointer items-start gap-2.5 rounded-md border border-border bg-panel-raised px-3 py-2.5">
                    <input type="radio" name="mode" value="auto" defaultChecked={prefillData?.mode === "auto"} className="mt-0.5" />
                    <div>
                      <span className="text-sm font-medium text-foreground">Invitation auto</span>
                      <p className="text-xs text-text-dim">Invitations envoyées automatiquement.</p>
                    </div>
                  </label>
                </div>
              </div>
              {formError && <p className="text-sm text-danger">{formError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={isPending} className="rounded-md border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50">
                  {isPending ? "Création..." : "Lancer la campagne"}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setFormError(null); }} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-panel-raised">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
