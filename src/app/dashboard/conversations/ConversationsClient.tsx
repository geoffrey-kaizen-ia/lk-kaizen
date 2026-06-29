"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Prospect = {
  id: string;
  full_name: string | null;
  status: string | null;
  message_count: number | null;
  created_at: string | null;
  ai_enabled: boolean;
  linkedin_url: string | null;
  occupation: string | null;
  lastMessage: {
    content: string;
    sent_at: string;
    direction: string;
  } | null;
};

type Message = {
  id: string;
  direction: string;
  content: string;
  sent_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  invited: "Invité",
  connected: "Connecté",
  in_conversation: "En discussion",
  interested: "Intéressé",
  not_interested: "Pas intéressé",
};

function getInitials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateSeparator(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatRelative(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return formatTime(dateStr);
  if (diffDays < 7)
    return date.toLocaleDateString("fr-FR", { weekday: "short" });
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

export default function ConversationsClient({
  prospects: initialProspects,
}: {
  prospects: Prospect[];
}) {
  const searchParams = useSearchParams();
  const [prospects, setProspects] = useState(initialProspects);
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get("prospect") ?? initialProspects[0]?.id ?? null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [aiFilter, setAiFilter] = useState<"all" | "active" | "paused">("all");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setMessages([]);
    const supabase = createClient();
    supabase
      .from("lk_messages")
      .select("id, direction, content, sent_at")
      .eq("prospect_id", selectedId)
      .order("sent_at", { ascending: true })
      .then(({ data }) => {
        setMessages(data ?? []);
        setLoading(false);
      });
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedProspect = prospects.find((p) => p.id === selectedId) ?? null;

  async function toggleAi(prospectId: string, current: boolean) {
    setTogglingAi(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("lk_prospects")
      .update({ ai_enabled: !current })
      .eq("id", prospectId);
    if (!error) {
      setProspects((prev) =>
        prev.map((p) =>
          p.id === prospectId ? { ...p, ai_enabled: !current } : p
        )
      );
    }
    setTogglingAi(false);
  }

  const filteredProspects = prospects.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (aiFilter === "active" && !p.ai_enabled) return false;
    if (aiFilter === "paused" && p.ai_enabled) return false;
    return true;
  });

  // Group messages by calendar day
  const byDate: { dateKey: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const key = new Date(msg.sent_at).toDateString();
    const last = byDate[byDate.length - 1];
    if (last?.dateKey === key) {
      last.msgs.push(msg);
    } else {
      byDate.push({ dateKey: key, msgs: [msg] });
    }
  }

  return (
    <div className="flex h-[calc(100vh-160px)] min-h-[520px] overflow-hidden rounded-lg border border-border bg-panel">
      {/* Left panel — prospect list */}
      <div className="flex w-72 shrink-0 flex-col border-r border-border">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-xs font-semibold text-text-muted">
            Prospects
          </h2>
          {prospects.length > 0 && (
            <p className="font-display text-xs text-text-dim">
              {filteredProspects.length} / {prospects.length} conversation
              {prospects.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
        {/* Filtres */}
        <div className="space-y-2 border-b border-border px-4 py-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-panel-raised px-2 py-1.5 font-display text-xs text-text-muted focus:border-accent focus:outline-none"
          >
            <option value="all">Tous les statuts</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={aiFilter}
            onChange={(e) =>
              setAiFilter(e.target.value as "all" | "active" | "paused")
            }
            className="w-full rounded-md border border-border-strong bg-panel-raised px-2 py-1.5 font-display text-xs text-text-muted focus:border-accent focus:outline-none"
          >
            <option value="all">IA : tous</option>
            <option value="active">IA active</option>
            <option value="paused">IA en pause</option>
          </select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredProspects.length === 0 && (
            <p className="px-4 py-6 text-sm text-text-muted">
              {prospects.length === 0
                ? "Aucune conversation pour le moment."
                : "Aucune conversation ne correspond aux filtres."}
            </p>
          )}
          <ul>
            {filteredProspects.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-panel-raised ${
                    selectedId === p.id
                      ? "border-r-2 border-accent bg-accent/10"
                      : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border-strong bg-panel-raised text-sm font-medium text-text-muted">
                        {getInitials(p.full_name)}
                      </div>
                      <span
                        title={p.ai_enabled ? "IA active" : "IA en pause"}
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-panel ${
                          p.ai_enabled
                            ? "bg-positive shadow-[0_0_4px_var(--positive)]"
                            : "bg-danger shadow-[0_0_4px_var(--danger)]"
                        }`}
                      />
                    </div>
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {p.full_name ?? "Inconnu"}
                        </p>
                        {p.lastMessage && (
                          <span className="shrink-0 font-display text-xs text-text-dim">
                            {formatRelative(p.lastMessage.sent_at)}
                          </span>
                        )}
                      </div>
                      {p.lastMessage ? (
                        <p className="truncate text-xs text-text-muted">
                          {p.lastMessage.direction === "outbound"
                            ? "Vous : "
                            : ""}
                          {p.lastMessage.content}
                        </p>
                      ) : (
                        <p className="text-xs text-text-dim">
                          {STATUS_LABELS[p.status ?? ""] ?? p.status}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right panel — conversation */}
      {!selectedProspect ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-text-muted">
            Selectionnez une conversation.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border px-6 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border-strong bg-panel-raised text-sm font-medium text-text-muted">
              {getInitials(selectedProspect.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">
                {selectedProspect.full_name ?? "Inconnu"}
              </p>
              {selectedProspect.occupation && (
                <p className="truncate text-xs text-text-muted">
                  {selectedProspect.occupation}
                </p>
              )}
              <p className="font-display text-xs text-text-dim">
                {STATUS_LABELS[selectedProspect.status ?? ""] ??
                  selectedProspect.status}
                {selectedProspect.message_count != null &&
                  selectedProspect.message_count > 0 &&
                  ` · ${selectedProspect.message_count} message${selectedProspect.message_count > 1 ? "s" : ""}`}
              </p>
            </div>
            {selectedProspect.linkedin_url && (
              <a
                href={selectedProspect.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-md border border-[#0a66c2]/40 bg-gradient-to-b from-[#1d8be0] to-[#0a66c2] px-3 py-1.5 font-display text-xs uppercase tracking-wider text-white shadow-[0_2px_6px_rgba(10,102,194,0.45),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all hover:from-[#2a96eb] hover:to-[#0b72d9] hover:shadow-[0_3px_10px_rgba(10,102,194,0.55),inset_0_1px_0_rgba(255,255,255,0.3)] active:translate-y-px active:shadow-[0_1px_3px_rgba(10,102,194,0.4),inset_0_1px_0_rgba(255,255,255,0.15)]"
              >
                Profil LinkedIn
              </a>
            )}
            <button
              type="button"
              onClick={() =>
                toggleAi(selectedProspect.id, selectedProspect.ai_enabled)
              }
              disabled={togglingAi}
              className="flex shrink-0 items-center gap-2 disabled:opacity-50"
              title={
                selectedProspect.ai_enabled
                  ? "Desactiver l'IA pour cette conversation"
                  : "Reactiver l'IA pour cette conversation"
              }
            >
              <span className="font-display text-xs uppercase tracking-wider text-text-muted">
                {selectedProspect.ai_enabled ? "IA active" : "IA en pause"}
              </span>
              <span
                className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                  selectedProspect.ai_enabled
                    ? "border-positive/30 bg-positive/20"
                    : "border-border-strong bg-panel-raised"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                    selectedProspect.ai_enabled
                      ? "translate-x-6 bg-positive"
                      : "translate-x-1 bg-text-dim"
                  }`}
                />
              </span>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading && (
              <p className="py-8 text-center text-sm text-text-muted">
                Chargement...
              </p>
            )}
            {!loading && messages.length === 0 && (
              <p className="py-8 text-center text-sm text-text-muted">
                Aucun message dans cette conversation.
              </p>
            )}
            {!loading &&
              byDate.map(({ dateKey, msgs }) => (
                <div key={dateKey}>
                  {/* Date separator */}
                  <div className="my-4 flex items-center gap-3">
                    <div className="flex-1 border-t border-border" />
                    <span className="font-display text-xs uppercase tracking-wider text-text-dim">
                      {formatDateSeparator(msgs[0].sent_at)}
                    </span>
                    <div className="flex-1 border-t border-border" />
                  </div>
                  <div className="space-y-2">
                    {msgs.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.direction === "outbound"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                            msg.direction === "outbound"
                              ? "rounded-br-sm border border-accent/30 bg-accent/10 text-foreground"
                              : "rounded-bl-sm border border-border bg-panel-raised text-foreground"
                          }`}
                        >
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {msg.content}
                          </p>
                          <p
                            className={`mt-1 text-right font-display text-xs ${
                              msg.direction === "outbound"
                                ? "text-accent/60"
                                : "text-text-dim"
                            }`}
                          >
                            {formatTime(msg.sent_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </div>
  );
}
