import { createClient } from "@/lib/supabase/server";
import PipelineClient from "./PipelineClient";

export default async function PipelinePage() {
  const supabase = await createClient();

  const { data: prospects } = await supabase
    .from("lk_prospects")
    .select(
      "id, full_name, job_title, company_name, occupation, linkedin_url, profile_picture_url, status, scoring, scoring_justification, intent_state, reply_sentiment, profile_summary, message_count, ai_enabled, last_reply_at, last_message_sent_at, created_at, nb_relance"
    )
    .order("last_reply_at", { ascending: false, nullsFirst: false });

  return (
    <div>
      <h1 className="mb-6 font-display text-xl font-semibold tracking-tight text-foreground">
        CRM
      </h1>
      <PipelineClient prospects={prospects ?? []} />
    </div>
  );
}
