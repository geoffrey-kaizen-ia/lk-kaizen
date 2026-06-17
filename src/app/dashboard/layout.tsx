import { createClient } from "@/lib/supabase/server";
import Sidebar from "./Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // On filtre sur user_id : sans ca, la policy admin (geoffrey@kaizenia.fr lit
  // toutes les fiches clients) ferait remonter plusieurs lignes et maybeSingle
  // renverrait null, ce qui affichait "LinkedIn offline" a tort pour l'admin.
  const { data: config } = await supabase
    .from("lk_clients_config")
    .select("account_id, is_active, ai_enabled")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  const isLinkedinConnected = !!(config?.account_id && config?.is_active);

  return (
    <div className="control-grid min-h-screen bg-background">
      <Sidebar
        userEmail={user?.email ?? null}
        isLinkedinConnected={isLinkedinConnected}
        aiEnabled={config?.ai_enabled ?? true}
      />
      <main className="ml-56 px-8 py-8">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
