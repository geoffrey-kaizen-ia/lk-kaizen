import { createClient } from "@/lib/supabase/server";
import StatsClient from "./StatsClient";

const STATUS_OPTIONS = [
  "invited",
  "connected",
  "in_conversation",
  "interested",
  "not_interested",
];

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // lundi = debut de semaine
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; status?: string }>;
}) {
  const { period: periodParam, status: statusParam } = await searchParams;
  const period = periodParam === "7" || periodParam === "30" ? periodParam : "all";
  const status = statusParam && STATUS_OPTIONS.includes(statusParam) ? statusParam : "all";

  const supabase = await createClient();

  const [{ data: prospects }, { data: messages }] = await Promise.all([
    supabase.from("lk_prospects").select("id, created_at, status"),
    supabase
      .from("lk_messages")
      .select("prospect_id, direction, sent_at"),
  ]);

  const allProspects = prospects ?? [];
  const allMessages = messages ?? [];

  // Santé du compte : invitations en attente (état live, tout l'historique, hors filtre période)
  const PENDING_INVITE_LIMIT = 500; // cap LinkedIn approximatif sur le total en attente
  const pendingInvites = allProspects.filter((p) => p.status === "invited").length;

  // Filtre periode : date de coupure basee sur created_at / sent_at
  const cutoff =
    period === "all"
      ? null
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() - Number(period));
          d.setHours(0, 0, 0, 0);
          return d;
        })();

  const filteredProspects = allProspects.filter((p) => {
    if (status !== "all" && p.status !== status) return false;
    if (cutoff && (!p.created_at || new Date(p.created_at) < cutoff)) return false;
    return true;
  });
  const filteredProspectIds = new Set(filteredProspects.map((p) => p.id));

  const filteredMessages = allMessages.filter((m) => {
    if (!filteredProspectIds.has(m.prospect_id)) return false;
    if (cutoff && (!m.sent_at || new Date(m.sent_at) < cutoff)) return false;
    return true;
  });

  const inboundMessages = filteredMessages.filter((m) => m.direction === "inbound");
  const outboundMessages = filteredMessages.filter((m) => m.direction === "outbound");

  const repliedProspectIds = new Set(inboundMessages.map((m) => m.prospect_id));

  // Actions envoyées
  const totalInvitesSent = filteredProspects.length;
  const totalMessagesSent = outboundMessages.length;

  // Résultats
  const acceptedProspects = filteredProspects.filter((p) => p.status !== "invited");
  const totalAccepted = acceptedProspects.length;
  const acceptanceRate = totalInvitesSent > 0 ? (totalAccepted / totalInvitesSent) * 100 : 0;

  const totalReplied = filteredProspects.filter((p) => repliedProspectIds.has(p.id)).length;
  const replyRate = totalAccepted > 0 ? (totalReplied / totalAccepted) * 100 : 0;

  // Compat legacy (pour les courbes)
  const totalSent = totalInvitesSent;
  const totalReplies = totalReplied;
  const globalRate = acceptanceRate;
  const totalInterested = filteredProspects.filter((p) => p.status === "interested").length;

  // Regroupement par periode hebdomadaire (semaine de creation du prospect)
  const periodMap = new Map<
    string,
    { weekStart: Date; sent: number; replies: number }
  >();

  for (const p of filteredProspects) {
    if (!p.created_at) continue;
    const weekStart = startOfWeek(new Date(p.created_at));
    const key = weekStart.toISOString();
    const entry = periodMap.get(key) ?? { weekStart, sent: 0, replies: 0 };
    entry.sent += 1;
    if (repliedProspectIds.has(p.id)) entry.replies += 1;
    periodMap.set(key, entry);
  }

  const periods = Array.from(periodMap.values())
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
    .map((c) => {
      const weekEnd = new Date(c.weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return {
        weekStartLabel: formatDate(c.weekStart),
        weekEndLabel: formatDate(weekEnd),
        sent: c.sent,
        replies: c.replies,
        rate: c.sent > 0 ? (c.replies / c.sent) * 100 : 0,
      };
    });

  // Messages recus / envoyes par jour
  const dayMap = new Map<string, { date: Date; inbound: number; outbound: number }>();

  for (const m of filteredMessages) {
    if (!m.sent_at) continue;
    const d = new Date(m.sent_at);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString();
    const entry = dayMap.get(key) ?? { date: d, inbound: 0, outbound: 0 };
    if (m.direction === "inbound") entry.inbound += 1;
    else if (m.direction === "outbound") entry.outbound += 1;
    dayMap.set(key, entry);
  }

  const messagesByDay = Array.from(dayMap.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((d) => ({
      label: formatDayLabel(d.date),
      inbound: d.inbound,
      outbound: d.outbound,
    }));

  return (
    <div>
      <h1 className="mb-1 font-display text-xl font-semibold tracking-tight text-foreground">
        Statistiques
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        Performance de la prospection.
      </p>
      <StatsClient
        period={period}
        status={status}
        pendingInvites={pendingInvites}
        pendingInviteLimit={PENDING_INVITE_LIMIT}
        totalInvitesSent={totalInvitesSent}
        totalMessagesSent={totalMessagesSent}
        totalAccepted={totalAccepted}
        acceptanceRate={acceptanceRate}
        totalReplied={totalReplied}
        replyRate={replyRate}
        totalSent={totalSent}
        totalReplies={totalReplies}
        globalRate={globalRate}
        totalInterested={totalInterested}
        periodCount={periods.length}
        periods={periods}
        messagesByDay={messagesByDay}
        totalInbound={inboundMessages.length}
        totalOutbound={outboundMessages.length}
      />
    </div>
  );
}
