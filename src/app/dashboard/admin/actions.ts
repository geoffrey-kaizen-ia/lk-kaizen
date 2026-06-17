"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = "geoffrey@kaizenia.fr";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email !== ADMIN_EMAIL) throw new Error("Acces refuse");
  return supabase;
}

export async function adminSetAllowedRoles(userId: string, roles: string[]) {
  const supabase = await assertAdmin();
  const { error } = await supabase.rpc("admin_set_allowed_roles", {
    p_user_id: userId,
    p_roles: roles,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/admin");
  return { error: null };
}

export async function adminSetCanEditPrompt(userId: string, value: boolean) {
  const supabase = await assertAdmin();
  const { error } = await supabase.rpc("admin_set_can_edit_prompt", {
    p_user_id: userId,
    p_value: value,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/admin");
  return { error: null };
}
