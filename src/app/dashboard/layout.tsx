import { createClient } from "@/lib/supabase/server";
import Sidebar from "./Sidebar";

async function checkUnipileStatus(accountId: string): Promise<boolean> {
  const baseUrl = process.env.UNIPILE_BASE_URL;
  const apiKey = process.env.UNIPILE_API_KEY;
  if (!baseUrl || !apiKey) return false;

  try {
    const res = await fetch(`${baseUrl}/api/v1/accounts/${accountId}`, {
      headers: { "X-API-KEY": apiKey, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.sources?.[0]?.status === "OK";
  } catch {
    return false;
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: config } = await supabase
    .from("lk_clients_config")
    .select("account_id, ai_enabled")
    .maybeSingle();

  const isLinkedinConnected = config?.account_id
    ? await checkUnipileStatus(config.account_id)
    : false;

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
