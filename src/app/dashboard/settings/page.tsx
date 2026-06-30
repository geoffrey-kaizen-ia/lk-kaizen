import { createClient } from "@/lib/supabase/server";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Filtre user_id obligatoire : la policy admin (geoffrey) lit toutes les fiches,
  // sans ce filtre maybeSingle renverrait null pour l'admin.
  const { data: config } = await supabase
    .from("lk_clients_config")
    .select(
      "daily_invite_limit, daily_message_limit, response_delay_mode, active_hours_start, active_hours_end, active_days, timezone, daily_report"
    )
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  return (
    <div>
      <h1 className="mb-1 font-display text-xl font-semibold tracking-tight text-foreground">
        Réglages
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        Cadence et sécurité du compte LinkedIn.
      </p>
      <SettingsClient
        dailyInviteLimit={config?.daily_invite_limit ?? 20}
        dailyMessageLimit={config?.daily_message_limit ?? 40}
        responseDelayMode={config?.response_delay_mode ?? "normal"}
        activeHoursStart={config?.active_hours_start ?? 9}
        activeHoursEnd={config?.active_hours_end ?? 19}
        activeDays={config?.active_days ?? [1, 2, 3, 4, 5]}
        timezone={config?.timezone ?? "Europe/Paris"}
        dailyReport={config?.daily_report ?? true}
      />
    </div>
  );
}
