import { createClient } from "@/lib/supabase/server";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: config } = await supabase
    .from("lk_clients_config")
    .select("daily_invite_limit, daily_message_limit, response_delay_mode")
    .maybeSingle();

  return (
    <div>
      <h1 className="mb-1 font-display text-xl font-semibold tracking-tight text-foreground">
        Reglages
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        Cadence et securite du compte LinkedIn.
      </p>
      <SettingsClient
        dailyInviteLimit={config?.daily_invite_limit ?? 25}
        dailyMessageLimit={config?.daily_message_limit ?? 40}
        responseDelayMode={config?.response_delay_mode ?? "normal"}
      />
    </div>
  );
}
