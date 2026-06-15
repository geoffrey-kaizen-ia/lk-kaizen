"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Period = {
  weekStartLabel: string;
  weekEndLabel: string;
  sent: number;
  replies: number;
  rate: number;
};

type MessageDay = {
  label: string;
  inbound: number;
  outbound: number;
};

const STATUS_LABELS: Record<string, string> = {
  invited: "Invite",
  connected: "Connecte",
  in_conversation: "En discussion",
  interested: "Interesse",
  not_interested: "Pas interesse",
};

export default function StatsClient({
  period,
  status,
  totalSent,
  totalReplies,
  globalRate,
  totalInterested,
  periodCount,
  periods,
  messagesByDay,
  totalInbound,
  totalOutbound,
}: {
  period: string;
  status: string;
  totalSent: number;
  totalReplies: number;
  globalRate: number;
  totalInterested: number;
  periodCount: number;
  periods: Period[];
  messagesByDay: MessageDay[];
  totalInbound: number;
  totalOutbound: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateFilter(key: "period" | "status", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const evolutionData = periods.map((c) => ({
    name: c.weekStartLabel,
    Envoyes: c.sent,
    Reponses: c.replies,
  }));

  const messagesData = messagesByDay.map((d) => ({
    name: d.label,
    Recus: d.inbound,
    Envoyes: d.outbound,
  }));

  return (
    <div>
      {/* Filtres */}
      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={period}
          onChange={(e) => updateFilter("period", e.target.value)}
          className="rounded-md border border-border-strong bg-panel-raised px-3 py-2 font-display text-xs text-text-muted focus:border-accent focus:outline-none"
        >
          <option value="all">Toute la periode</option>
          <option value="7">7 derniers jours</option>
          <option value="30">30 derniers jours</option>
        </select>
        <select
          value={status}
          onChange={(e) => updateFilter("status", e.target.value)}
          className="rounded-md border border-border-strong bg-panel-raised px-3 py-2 font-display text-xs text-text-muted focus:border-accent focus:outline-none"
        >
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Cartes de stats globales */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total envoyes"
          value={totalSent.toString()}
          accent="accent"
        />
        <StatCard
          label="Total reponses"
          value={totalReplies.toString()}
          accent="positive"
        />
        <StatCard
          label="Taux global"
          value={`${globalRate.toFixed(1)}%`}
          accent="warning"
        />
        <StatCard
          label="Interesses"
          value={totalInterested.toString()}
          accent="muted"
        />
      </div>

      {/* Graphique messages recus / envoyes */}
      <div className="mb-6 rounded-lg border border-border bg-panel p-5">
        <h2 className="mb-4 font-display text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          Messages recus / envoyes ({totalInbound} / {totalOutbound})
        </h2>
        {messagesData.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            Pas encore de donnees.
          </p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={messagesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232b39" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#7d8aa3" }}
                  stroke="#303a4b"
                />
                <YAxis tick={{ fontSize: 12, fill: "#7d8aa3" }} stroke="#303a4b" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 6,
                    border: "1px solid #303a4b",
                    background: "#161b25",
                    fontSize: 13,
                    color: "#e4e9f1",
                  }}
                  labelStyle={{ color: "#e4e9f1" }}
                />
                <Legend wrapperStyle={{ fontSize: 13, color: "#7d8aa3" }} />
                <Line
                  type="monotone"
                  dataKey="Recus"
                  stroke="#34d399"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="Envoyes"
                  stroke="#22d3ee"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Graphique d'evolution */}
      <div className="mb-6 rounded-lg border border-border bg-panel p-5">
        <h2 className="mb-4 font-display text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          Evolution par periode
        </h2>
        {evolutionData.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            Pas encore de donnees.
          </p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232b39" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#7d8aa3" }}
                  stroke="#303a4b"
                />
                <YAxis tick={{ fontSize: 12, fill: "#7d8aa3" }} stroke="#303a4b" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 6,
                    border: "1px solid #303a4b",
                    background: "#161b25",
                    fontSize: 13,
                    color: "#e4e9f1",
                  }}
                  labelStyle={{ color: "#e4e9f1" }}
                />
                <Legend wrapperStyle={{ fontSize: 13, color: "#7d8aa3" }} />
                <Line
                  type="monotone"
                  dataKey="Envoyes"
                  stroke="#22d3ee"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="Reponses"
                  stroke="#34d399"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Tableau des periodes */}
      <div className="rounded-lg border border-border bg-panel p-5">
        <h2 className="mb-4 font-display text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          Detail par periode ({periodCount})
        </h2>
        {periods.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            Pas encore de donnees.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left font-display text-xs uppercase tracking-wider text-text-dim">
                  <th className="py-2.5 pl-3 pr-4 font-medium">
                    Debut periode
                  </th>
                  <th className="py-2.5 pr-4 font-medium">Fin periode</th>
                  <th className="py-2.5 pr-4 text-right font-medium">
                    Envoyes
                  </th>
                  <th className="py-2.5 pr-4 text-right font-medium">
                    Reponses
                  </th>
                  <th className="py-2.5 pr-3 text-right font-medium">
                    Taux
                  </th>
                </tr>
              </thead>
              <tbody>
                {periods.map((c, i) => (
                  <tr
                    key={i}
                    className="border-b border-border last:border-0 odd:bg-panel-raised/40"
                  >
                    <td className="py-2.5 pl-3 pr-4 text-text-muted">
                      {c.weekStartLabel}
                    </td>
                    <td className="py-2.5 pr-4 text-text-muted">
                      {c.weekEndLabel}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-display font-medium text-foreground">
                      {c.sent}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-display font-medium text-foreground">
                      {c.replies}
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <span className="rounded border border-accent/30 bg-accent/10 px-2.5 py-1 font-display text-xs font-semibold text-accent">
                        {c.rate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const ACCENT_STYLES = {
  accent: { text: "text-accent", bar: "bg-accent", glow: "shadow-[0_0_18px_-6px_var(--accent)]" },
  positive: { text: "text-positive", bar: "bg-positive", glow: "shadow-[0_0_18px_-6px_var(--positive)]" },
  warning: { text: "text-warning", bar: "bg-warning", glow: "shadow-[0_0_18px_-6px_var(--warning)]" },
  muted: { text: "text-foreground", bar: "bg-text-dim", glow: "" },
} as const;

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: keyof typeof ACCENT_STYLES;
}) {
  const style = ACCENT_STYLES[accent];
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-panel px-5 py-6 text-center">
      <span className={`absolute inset-x-0 top-0 h-0.5 ${style.bar}`} />
      <p className="mb-3 font-display text-xs font-medium uppercase tracking-[0.2em] text-text-dim">
        {label}
      </p>
      <p className={`font-display text-4xl font-semibold tabular-nums ${style.text} ${style.glow}`}>
        {value}
      </p>
    </div>
  );
}
