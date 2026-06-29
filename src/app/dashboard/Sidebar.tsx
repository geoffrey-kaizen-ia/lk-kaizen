"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout, connectLinkedin } from "./actions";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  {
    href: "/dashboard/agents",
    label: "Agents",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
      </svg>
    ),
  },
  {
    href: "/dashboard/pipeline",
    label: "CRM",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/conversations",
    label: "Conversations",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/prospects",
    label: "Recherche prospects",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16zM11 8v3m0 0v3m0-3h3m-3 0H8" />
      </svg>
    ),
  },
  {
    href: "/dashboard/stats",
    label: "Statistiques",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/settings",
    label: "Réglages",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function Sidebar({
  userEmail,
  isLinkedinConnected,
  aiEnabled,
}: {
  userEmail: string | null;
  isLinkedinConnected: boolean;
  aiEnabled: boolean;
}) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [aiActive, setAiActive] = useState(aiEnabled);
  const [togglingAi, setTogglingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const initial = userEmail?.[0]?.toUpperCase() ?? "?";

  async function toggleGlobalAi() {
    const next = !aiActive;
    setTogglingAi(true);
    setAiError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setAiError("Session expirée, recharge la page.");
      setTogglingAi(false);
      return;
    }
    const { error } = await supabase
      .from("lk_clients_config")
      .update({ ai_enabled: next })
      .eq("user_id", userId);
    if (error) {
      setAiError(error.message);
    } else {
      setAiActive(next);
    }
    setTogglingAi(false);
  }

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <aside className="fixed inset-y-0 left-0 flex w-56 flex-col border-r border-border bg-panel">
      {/* Logo */}
      <div className="border-b border-border px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
          <span className="font-display text-sm font-semibold tracking-[0.2em] text-foreground uppercase">
            Kaizen
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-transparent text-text-muted hover:border-border hover:bg-panel-raised hover:text-foreground"
              }`}
            >
              <span className={active ? "text-accent" : "text-text-dim"}>
                {icon}
              </span>
              {label}
            </Link>
          );
        })}

        {userEmail === "geoffrey@kaizenia.fr" && (
          <Link
            href="/dashboard/admin"
            className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/admin")
                ? "border-warning/30 bg-warning/10 text-warning"
                : "border-transparent text-text-dim hover:border-border hover:bg-panel-raised hover:text-foreground"
            }`}
          >
            <span className={pathname.startsWith("/dashboard/admin") ? "text-warning" : "text-text-dim"}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </span>
            Admin
          </Link>
        )}
      </nav>

      {/* Bas de sidebar */}
      <div className="space-y-1 border-t border-border p-3">
        {/* Pause IA globale */}
        <div className="rounded-md border border-border bg-panel-raised px-3 py-2.5">
          <button
            type="button"
            onClick={toggleGlobalAi}
            disabled={togglingAi}
            className="flex w-full items-center justify-between disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  aiActive
                    ? "bg-positive shadow-[0_0_6px_var(--positive)]"
                    : "bg-danger shadow-[0_0_6px_var(--danger)]"
                }`}
              />
              <span className="font-display text-[10px] text-text-muted">
                {aiActive ? "IA active" : "IA en pause"}
              </span>
            </div>
            <span
              className={`font-display text-[10px] font-semibold ${
                aiActive ? "text-text-dim" : "text-accent"
              }`}
            >
              {aiActive ? "Désactiver" : "Réactiver"}
            </span>
          </button>
          <p className="mt-1.5 text-[10px] leading-snug text-text-dim">
            {aiActive
              ? "Coupe les réponses automatiques sur toutes les conversations en une fois."
              : "Aucune conversation ne reçoit de réponse automatique pour le moment."}
          </p>
          {aiError && (
            <p className="mt-1.5 text-[10px] leading-snug text-danger">
              {aiError}
            </p>
          )}
        </div>

        {/* Statut LinkedIn */}
        <div className="rounded-md border border-border bg-panel-raised px-3 py-2.5">
          {isLinkedinConnected ? (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-positive shadow-[0_0_6px_var(--positive)]" />
              <span className="font-display text-[10px] text-text-muted">
                LinkedIn connecté
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
                </span>
                <span className="font-display text-[10px] text-text-muted">
                  LinkedIn déconnecté
                </span>
              </div>
              <form action={connectLinkedin}>
                <button
                  type="submit"
                  className="w-full rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
                >
                  Connecter LinkedIn
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Avatar utilisateur */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-panel-raised"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-strong bg-panel-raised font-display text-xs font-semibold text-accent">
              {initial}
            </div>
            <span className="min-w-0 flex-1 truncate text-xs text-text-muted">
              {userEmail}
            </span>
          </button>

          {dropdownOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-full overflow-hidden rounded-md border border-border bg-panel-raised shadow-lg">
              <div className="border-b border-border px-4 py-2">
                <p className="truncate text-xs text-text-muted">{userEmail}</p>
              </div>
              <form action={logout}>
                <button
                  type="submit"
                  className="w-full px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-panel"
                >
                  Déconnexion
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
