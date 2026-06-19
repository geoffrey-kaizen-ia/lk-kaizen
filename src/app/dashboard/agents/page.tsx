import { createClient } from "@/lib/supabase/server";
import AgentsClient from "./AgentsClient";

type Agent = {
  id: string;
  name: string | null;
  objectif: string | null;
  prompt_content: string | null;
  is_active: boolean | null;
  knowledge_base: Record<string, unknown> | null;
};

type Assignment = {
  role: string;
  agent_id: string;
  is_enabled: boolean;
};

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ linkedin?: string }>;
}) {
  const { linkedin } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: agents, error },
    { data: assignments },
    { data: clientConfig },
  ] = await Promise.all([
    supabase
      .from("lk_agents")
      .select("id, name, objectif, prompt_content, is_active, knowledge_base"),
    supabase
      .from("lk_agent_assignments")
      .select("role, agent_id, is_enabled"),
    // Filtre user_id : la policy admin (geoffrey) lit toutes les fiches, sans ce
    // filtre maybeSingle renverrait null et bloquerait l'admin.
    supabase
      .from("lk_clients_config")
      .select("allowed_roles, can_edit_prompt, icebreaker_mode, icebreaker_template, icebreaker_enabled")
      .eq("user_id", user?.id ?? "")
      .maybeSingle(),
  ]);

  return (
    <div>
      {linkedin === "ok" && (
        <p className="mb-6 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Connexion LinkedIn reussie.
        </p>
      )}
      {linkedin === "error" && (
        <p className="mb-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          La connexion LinkedIn a echoue. Reessaie ou contacte le support.
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Erreur lors du chargement : {error.message}
        </p>
      )}
      {!error && (
        <AgentsClient
          agents={(agents ?? []) as Agent[]}
          assignments={(assignments ?? []) as Assignment[]}
          allowedRoles={(clientConfig?.allowed_roles ?? ["icebreaker", "conversation", "relance"]) as string[]}
          canEditPrompt={clientConfig?.can_edit_prompt ?? false}
          icebreakerMode={(clientConfig?.icebreaker_mode as "ai" | "template") ?? "ai"}
          icebreakerTemplate={clientConfig?.icebreaker_template ?? ""}
          icebreakerEnabled={clientConfig?.icebreaker_enabled ?? true}
        />
      )}
    </div>
  );
}
