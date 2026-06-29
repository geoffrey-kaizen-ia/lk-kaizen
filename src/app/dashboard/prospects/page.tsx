import { createClient } from "@/lib/supabase/server";
import ProspectsClient from "./ProspectsClient";

export default async function ProspectsPage() {
  const supabase = await createClient();

  // Début de journée en timezone Europe/Paris
  const now = new Date();
  const parisDate = now.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  const startOfTodayISO = new Date(parisDate + "T00:00:00+02:00").toISOString();

  const [
    { data: campaigns },
    { data: pendingResults },
    { data: selectedResults },
    { data: invitedRows },
    { count: invitesToday },
    { data: clientConfig },
    { count: messagesToday },
  ] = await Promise.all([
    supabase
      .from("lk_searches")
      .select("id, name, status, total_scraped, target_count, mode, created_at, query_params")
      .order("created_at", { ascending: false }),
    supabase
      .from("lk_search_results")
      .select("id, search_id, provider_id, full_name, headline, location, industry, current_company, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("lk_search_results")
      .select("id, search_id, provider_id, full_name, headline, location, industry, current_company, status, created_at")
      .eq("status", "selected")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("lk_search_results")
      .select("id, search_id, provider_id, full_name, headline, location, industry, current_company, status, created_at, sent_at")
      .eq("status", "invited")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("lk_search_results")
      .select("*", { count: "exact", head: true })
      .eq("status", "invited")
      .gte("sent_at", startOfTodayISO),
    supabase
      .from("lk_clients_config")
      .select("daily_invite_limit, daily_message_limit")
      .maybeSingle(),
    supabase
      .from("lk_messages")
      .select("*", { count: "exact", head: true })
      .eq("direction", "outbound")
      .gte("sent_at", startOfTodayISO),
  ]);

  return (
    <div>
      <h1 className="mb-1 font-display text-xl font-semibold tracking-tight text-foreground">
        Campagnes de prospection
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        Trouve de nouveaux profils LinkedIn et gère tes invitations.
      </p>
      <ProspectsClient
        campaigns={campaigns ?? []}
        pendingResults={pendingResults ?? []}
        selectedResults={selectedResults ?? []}
        invitedResults={invitedRows ?? []}
        invitesToday={invitesToday ?? 0}
        dailyInviteLimit={clientConfig?.daily_invite_limit ?? 20}
        messagesToday={messagesToday ?? 0}
        dailyMessageLimit={clientConfig?.daily_message_limit ?? 40}
      />
    </div>
  );
}
