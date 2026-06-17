import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminClient from "./AdminClient";

const ADMIN_EMAIL = "geoffrey@kaizenia.fr";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user?.email !== ADMIN_EMAIL) {
    redirect("/dashboard/agents");
  }

  const { data: clients, error } = await supabase
    .from("lk_clients_config")
    .select("user_id, email, full_name, is_active, allowed_roles, can_edit_prompt")
    .order("full_name");

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
          Administration clients
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {clients?.length ?? 0} client{(clients?.length ?? 0) > 1 ? "s" : ""}
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error.message}
        </p>
      )}

      <AdminClient
        clients={(clients ?? []).map((c) => ({
          ...c,
          allowed_roles: c.allowed_roles ?? ["icebreaker", "conversation", "intent"],
          can_edit_prompt: c.can_edit_prompt ?? false,
        }))}
      />
    </div>
  );
}
