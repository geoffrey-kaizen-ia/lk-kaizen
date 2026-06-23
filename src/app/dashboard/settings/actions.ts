"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DELAY_PRESETS,
  isDelayMode,
  SOCLE_MAX_INVITE_LIMIT,
  SOCLE_MAX_MESSAGE_LIMIT,
  ALLOWED_TIMEZONES,
} from "./delayPresets";

export async function updateCadenceSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expiree, recharge la page." };

  const dailyInviteLimit = Number(formData.get("daily_invite_limit"));
  const dailyMessageLimit = Number(formData.get("daily_message_limit"));
  const responseDelayMode = formData.get("response_delay_mode") as string;
  const activeHoursStart = Number(formData.get("active_hours_start"));
  const activeHoursEnd = Number(formData.get("active_hours_end"));
  const timezone = formData.get("timezone") as string;
  // active_days arrive comme plusieurs entrees (cases a cocher) -> reconstruit en tableau d'entiers.
  const activeDays = formData
    .getAll("active_days")
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);

  if (!Number.isFinite(dailyInviteLimit) || dailyInviteLimit < 1 || dailyInviteLimit > SOCLE_MAX_INVITE_LIMIT) {
    return { error: `Le plafond d'invitations doit etre entre 1 et ${SOCLE_MAX_INVITE_LIMIT} (plafond socle).` };
  }
  if (!Number.isFinite(dailyMessageLimit) || dailyMessageLimit < 1 || dailyMessageLimit > SOCLE_MAX_MESSAGE_LIMIT) {
    return { error: `Le plafond de messages doit etre entre 1 et ${SOCLE_MAX_MESSAGE_LIMIT} (plafond socle).` };
  }
  if (!isDelayMode(responseDelayMode)) {
    return { error: "Mode de delai de reponse invalide." };
  }
  if (
    !Number.isInteger(activeHoursStart) ||
    !Number.isInteger(activeHoursEnd) ||
    activeHoursStart < 0 ||
    activeHoursEnd > 23 ||
    activeHoursStart >= activeHoursEnd
  ) {
    return { error: "Le creneau horaire est invalide (debut avant fin, entre 0h et 23h)." };
  }
  if (activeDays.length === 0) {
    return { error: "Selectionne au moins un jour actif." };
  }
  if (!(ALLOWED_TIMEZONES as readonly string[]).includes(timezone)) {
    return { error: "Fuseau horaire invalide." };
  }

  // Bornes en minutes derivees du preset (source de verite serveur, jamais la valeur client).
  const { min: delayMin, max: delayMax } = DELAY_PRESETS[responseDelayMode];

  const { error } = await supabase
    .from("lk_clients_config")
    .update({
      daily_invite_limit: dailyInviteLimit,
      daily_message_limit: dailyMessageLimit,
      response_delay_mode: responseDelayMode,
      response_delay_min_minutes: delayMin,
      response_delay_max_minutes: delayMax,
      active_hours_start: activeHoursStart,
      active_hours_end: activeHoursEnd,
      active_days: activeDays.sort((a, b) => a - b),
      timezone,
    })
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { error: null };
}

export async function updateDailyReport(enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, recharge la page." };

  const { error } = await supabase
    .from("lk_clients_config")
    .update({ daily_report: enabled })
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { error: null };
}
