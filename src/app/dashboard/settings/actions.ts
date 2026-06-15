"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const SOCLE_MAX_INVITE_LIMIT = 25;
const SOCLE_MAX_MESSAGE_LIMIT = 40;
const DELAY_MODES = ["rapide", "normal", "lent"];

export async function updateCadenceSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expiree, recharge la page." };

  const dailyInviteLimit = Number(formData.get("daily_invite_limit"));
  const dailyMessageLimit = Number(formData.get("daily_message_limit"));
  const responseDelayMode = formData.get("response_delay_mode") as string;

  if (!Number.isFinite(dailyInviteLimit) || dailyInviteLimit < 1 || dailyInviteLimit > SOCLE_MAX_INVITE_LIMIT) {
    return { error: `Le plafond d'invitations doit etre entre 1 et ${SOCLE_MAX_INVITE_LIMIT} (plafond socle).` };
  }
  if (!Number.isFinite(dailyMessageLimit) || dailyMessageLimit < 1 || dailyMessageLimit > SOCLE_MAX_MESSAGE_LIMIT) {
    return { error: `Le plafond de messages doit etre entre 1 et ${SOCLE_MAX_MESSAGE_LIMIT} (plafond socle).` };
  }
  if (!DELAY_MODES.includes(responseDelayMode)) {
    return { error: "Mode de delai de reponse invalide." };
  }

  const { error } = await supabase
    .from("lk_clients_config")
    .update({
      daily_invite_limit: dailyInviteLimit,
      daily_message_limit: dailyMessageLimit,
      response_delay_mode: responseDelayMode,
    })
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { error: null };
}
