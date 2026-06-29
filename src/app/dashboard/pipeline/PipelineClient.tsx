"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

type Prospect = {
  id: string;
  full_name: string | null;
  job_title: string | null;
  company_name: string | null;
  occupation: string | null;
  linkedin_url: string | null;
  profile_picture_url: string | null;
  status: string | null;
  scoring: number | null;
  scoring_justification: string | null;
  intent_state: string | null;
  reply_sentiment: string | null;
  profile_summary: string | null;
  message_count: number | null;
  ai_enabled: boolean | null;
  last_reply_at: string | null;
  last_message_sent_at: string | null;
  created_at: string | null;
  nb_relance: number | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  invited: { label: "Invité", color: "text-text-muted border-border" },
  connected: { label: "Connecté", color: "text-accent border-accent/30 bg-accent/10" },
  in_conversation: { label: "En discussion", color: "text-positive border-positive/30 bg-positive/10" },
  interested: { label: "Intéressé", color: "text-warning border-warning/30 bg-warning/10" },
  not_interested: { label: "Pas intéressé", color: "text-danger border-danger/30 bg-danger/10" },
};

const INTENT_LABELS: Record<string, { label: string; color: string }> = {
  interested: { label: "Interesse", color: "text-positive border-positive/30 bg-positive/10" },
  neutral: { label: "Neutre", color: "text-text-muted border-border" },
  not_interested: { label: "Pas interesse", color: "text-danger border-danger/30 bg-danger/10" },
  opt_out: { label: "Opt-out", color: "text-danger border-danger/50 bg-danger/20" },
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-text-dim">--</span>;
  const color =
    score >= 7 ? "text-positive" : score >= 4 ? "text-warning" : "text-danger";
  return <span className={`font-semibold ${color}`}>{score}/10</span>;
}

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  const initials = (name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (url) {
    return (
      <img
        src={url}
        alt={name ?? ""}
        className="h-8 w-8 rounded-full border border-border object-cover"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-panel-raised font-display text-xs font-semibold text-accent">
      {initials}
    </div>
  );
}

function formatDate(date: string | null) {
  if (!date) return "--";
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function PipelineClient({ prospects }: { prospects: Prospect[] }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [aiFilter, setAiFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string>("last_activity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  const filtered = useMemo(() => {
    return prospects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (aiFilter === "active" && !p.ai_enabled) return false;
      if (aiFilter === "paused" && p.ai_enabled !== false) return false;
      if (scoreFilter === "hot" && (p.scoring ?? 0) < 7) return false;
      if (scoreFilter === "warm" && ((p.scoring ?? 0) < 4 || (p.scoring ?? 0) > 6)) return false;
      if (scoreFilter === "cold" && (p.scoring ?? 11) > 3) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (p.full_name ?? "").toLowerCase();
        const company = (p.company_name ?? "").toLowerCase();
        const job = (p.job_title ?? p.occupation ?? "").toLowerCase();
        if (!name.includes(q) && !company.includes(q) && !job.includes(q)) return false;
      }
      return true;
    });
  }, [prospects, statusFilter, aiFilter, scoreFilter, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;
      if (sortKey === "full_name") { aVal = a.full_name ?? ""; bVal = b.full_name ?? ""; }
      else if (sortKey === "status") { aVal = a.status ?? ""; bVal = b.status ?? ""; }
      else if (sortKey === "message_count") { aVal = a.message_count ?? 0; bVal = b.message_count ?? 0; }
      else if (sortKey === "ai_enabled") { aVal = a.ai_enabled ? 1 : 0; bVal = b.ai_enabled ? 1 : 0; }
      else if (sortKey === "last_activity") {
        aVal = a.last_reply_at ?? a.last_message_sent_at ?? a.created_at ?? "";
        bVal = b.last_reply_at ?? b.last_message_sent_at ?? b.created_at ?? "";
      }
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const statuses = Array.from(new Set(prospects.map((p) => p.status).filter(Boolean)));

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="h-8 rounded-md border border-border bg-panel px-3 text-sm text-foreground placeholder:text-text-dim focus:border-accent focus:outline-none"
        />

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className="h-8 rounded-md border border-border bg-panel px-2 text-sm text-foreground focus:border-accent focus:outline-none"
        >
          <option value="all">Tous les statuts</option>
          {statuses.map((s) => (
            <option key={s} value={s!}>
              {STATUS_LABELS[s!]?.label ?? s}
            </option>
          ))}
        </select>

        <select
          value={scoreFilter}
          onChange={(e) => { setScoreFilter(e.target.value); setPage(0); }}
          className="h-8 rounded-md border border-border bg-panel px-2 text-sm text-foreground focus:border-accent focus:outline-none"
        >
          <option value="all">Tous les scores</option>
          <option value="hot">Chaud (7+)</option>
          <option value="warm">Tiède (4-6)</option>
          <option value="cold">Froid (1-3)</option>
        </select>

        <select
          value={aiFilter}
          onChange={(e) => { setAiFilter(e.target.value); setPage(0); }}
          className="h-8 rounded-md border border-border bg-panel px-2 text-sm text-foreground focus:border-accent focus:outline-none"
        >
          <option value="all">IA : tous</option>
          <option value="active">IA active</option>
          <option value="paused">IA en pause</option>
        </select>

        <span className="ml-auto text-xs text-text-dim">
          {sorted.length} / {prospects.length} prospects
        </span>
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-panel-raised">
              {[
                { key: "full_name", label: "Prospect", align: "left" },
                { key: null, label: "Poste", align: "left" },
                { key: "status", label: "Statut", align: "left" },
                { key: "scoring", label: "Score", align: "center" },
                { key: "message_count", label: "Msgs", align: "center" },
                { key: "ai_enabled", label: "IA", align: "center" },
                { key: "last_activity", label: "Dernière activité", align: "left" },
              ].map(({ key, label, align }) => (
                <th
                  key={label}
                  onClick={key ? () => toggleSort(key) : undefined}
                  className={`px-4 py-3 text-${align} text-xs font-medium uppercase tracking-wider text-text-dim ${key ? "cursor-pointer select-none hover:text-foreground" : ""}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {key && (
                      <span className="text-[10px]">
                        {sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-text-dim">
                  Aucun prospect ne correspond aux filtres.
                </td>
              </tr>
            ) : (
              paginated.map((p) => {
                const statusInfo = STATUS_LABELS[p.status ?? ""] ?? {
                  label: p.status ?? "--",
                  color: "text-text-muted border-border",
                };
                const lastActivity = p.last_reply_at ?? p.last_message_sent_at ?? p.created_at;
                const jobLine = p.job_title ?? p.occupation ?? null;

                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedProspect(p)}
                    className="cursor-pointer bg-panel transition-colors hover:bg-panel-raised"
                  >
                    {/* Prospect */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={p.full_name} url={p.profile_picture_url} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-foreground truncate">
                              {p.full_name ?? "--"}
                            </span>
                            {p.linkedin_url && (
                              <a
                                href={p.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 text-text-dim hover:text-accent"
                              >
                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                </svg>
                              </a>
                            )}
                          </div>
                          {p.company_name && (
                            <div className="text-xs text-text-dim truncate">{p.company_name}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Poste */}
                    <td className="px-4 py-3">
                      <span className="text-text-muted truncate block max-w-[180px]">
                        {jobLine ?? "--"}
                      </span>
                    </td>

                    {/* Statut */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                    </td>

                    {/* Score */}
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge score={p.scoring} />
                    </td>

                    {/* Msgs */}
                    <td className="px-4 py-3 text-center text-text-muted">
                      {p.message_count ?? 0}
                    </td>

                    {/* IA */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          p.ai_enabled !== false
                            ? "bg-positive shadow-[0_0_6px_var(--positive)]"
                            : "bg-danger"
                        }`}
                      />
                    </td>

                    {/* Derniere activite */}
                    <td className="px-4 py-3 text-text-dim">
                      {formatDate(lastActivity)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/conversations?prospect=${p.id}`}
                        className="inline-flex items-center justify-center rounded-md border border-border p-1.5 text-text-dim transition-colors hover:border-accent/30 hover:bg-accent/10 hover:text-accent"
                        title="Voir la conversation"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between text-sm text-text-dim">
          <div className="flex items-center gap-2">
            <span>Lignes par page :</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="h-7 rounded border border-border bg-panel px-2 text-sm text-foreground focus:border-accent focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span>
              {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filtered.length)} sur {filtered.length}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(0)}
                disabled={page === 0}
                className="rounded border border-border px-2 py-1 text-xs disabled:opacity-30 hover:bg-panel-raised disabled:cursor-not-allowed"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded border border-border px-2 py-1 text-xs disabled:opacity-30 hover:bg-panel-raised disabled:cursor-not-allowed"
              >
                ‹
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded border border-border px-2 py-1 text-xs disabled:opacity-30 hover:bg-panel-raised disabled:cursor-not-allowed"
              >
                ›
              </button>
              <button
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
                className="rounded border border-border px-2 py-1 text-xs disabled:opacity-30 hover:bg-panel-raised disabled:cursor-not-allowed"
              >
                »
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer prospect */}
      {selectedProspect && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setSelectedProspect(null)}
          />

          {/* Panel */}
          <div className="fixed inset-y-0 right-0 z-50 flex w-96 flex-col border-l border-border bg-panel shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border p-5">
              <div className="flex items-center gap-3">
                <Avatar name={selectedProspect.full_name} url={selectedProspect.profile_picture_url} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {selectedProspect.full_name ?? "--"}
                    </span>
                    {selectedProspect.linkedin_url && (
                      <a
                        href={selectedProspect.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-text-dim hover:text-accent"
                      >
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                        </svg>
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-text-dim">
                    {selectedProspect.job_title ?? selectedProspect.occupation ?? "--"}
                    {selectedProspect.company_name && ` · ${selectedProspect.company_name}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProspect(null)}
                className="text-text-dim hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Contenu */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Statut + IA */}
              <div className="flex items-center gap-3">
                {(() => {
                  const s = STATUS_LABELS[selectedProspect.status ?? ""] ?? { label: selectedProspect.status ?? "--", color: "text-text-muted border-border" };
                  return (
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${s.color}`}>
                      {s.label}
                    </span>
                  );
                })()}
                <span className={`flex items-center gap-1.5 text-xs ${selectedProspect.ai_enabled !== false ? "text-positive" : "text-danger"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${selectedProspect.ai_enabled !== false ? "bg-positive" : "bg-danger"}`} />
                  {selectedProspect.ai_enabled !== false ? "IA active" : "IA en pause"}
                </span>
              </div>

              {/* Score + Intent */}
              {(selectedProspect.scoring !== null || selectedProspect.intent_state) && (
                <div className="grid grid-cols-2 gap-3">
                  {selectedProspect.scoring !== null && (
                    <div className="rounded-md border border-border bg-panel-raised px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-text-dim">Score IA</p>
                      <p className="mt-0.5 text-sm font-semibold">
                        <ScoreBadge score={selectedProspect.scoring} />
                      </p>
                    </div>
                  )}
                  {selectedProspect.intent_state && (
                    <div className="rounded-md border border-border bg-panel-raised px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-text-dim">Intention</p>
                      <p className="mt-1.5">
                        {(() => {
                          const i = INTENT_LABELS[selectedProspect.intent_state ?? ""] ?? { label: selectedProspect.intent_state, color: "text-text-muted border-border" };
                          return (
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${i.color}`}>
                              {i.label}
                            </span>
                          );
                        })()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Justification du scoring */}
              {selectedProspect.scoring_justification && (
                <div className="rounded-md border border-border bg-panel-raised px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">Pourquoi ce score</p>
                  <p className="mt-1 text-xs text-text-muted leading-relaxed">{selectedProspect.scoring_justification}</p>
                </div>
              )}

              {/* Sentiment derniere reponse */}
              {selectedProspect.reply_sentiment && (
                <div className="rounded-md border border-border bg-panel-raised px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">Sentiment dernier message</p>
                  <p className="mt-0.5 text-sm text-foreground">{selectedProspect.reply_sentiment}</p>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Messages", value: selectedProspect.message_count ?? 0 },
                  { label: "Relances", value: selectedProspect.nb_relance ?? 0 },
                  { label: "Derniere reponse", value: formatDate(selectedProspect.last_reply_at) },
                  { label: "Dernier envoi", value: formatDate(selectedProspect.last_message_sent_at) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-md border border-border bg-panel-raised px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-text-dim">{label}</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
                  </div>
                ))}
              </div>

              {/* Profil LinkedIn */}
              {selectedProspect.profile_summary && (
                <div className="rounded-md border border-border bg-panel-raised px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">Profil</p>
                  <p className="mt-1 text-xs text-text-muted leading-relaxed">{selectedProspect.profile_summary}</p>
                </div>
              )}
            </div>

            {/* Footer — action */}
            <div className="border-t border-border p-4">
              <Link
                href={`/dashboard/conversations?prospect=${selectedProspect.id}`}
                onClick={() => setSelectedProspect(null)}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Voir la conversation
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
