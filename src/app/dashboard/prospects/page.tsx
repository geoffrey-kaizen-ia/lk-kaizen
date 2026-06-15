import { createClient } from "@/lib/supabase/server";
import ProspectsClient from "./ProspectsClient";

export default async function NewProspectsPage() {
  const supabase = await createClient();

  const { data: results } = await supabase
    .from("lk_search_results")
    .select("id, search_id, provider_id, full_name, headline, location, industry, current_company, status, created_at")
    .neq("status", "ignored")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <h1 className="mb-1 font-display text-xl font-semibold tracking-tight text-foreground">
        Nouveaux prospects
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        Recherche de profils LinkedIn et envoi d&apos;invitations.
      </p>
      <ProspectsClient results={results ?? []} />
    </div>
  );
}
