"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signup(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirm = formData.get("confirm") as string;
  const accessCode = formData.get("access_code") as string;

  // Verification du code d'acces
  const validCode = process.env.SIGNUP_ACCESS_CODE;
  if (!validCode || accessCode.trim() !== validCode.trim()) {
    redirect(
      `/signup?error=${encodeURIComponent("Code d'acces invalide.")}`
    );
  }

  // Verification cote serveur que les mots de passe correspondent
  if (password !== confirm) {
    redirect(
      `/signup?error=${encodeURIComponent(
        "Les mots de passe ne correspondent pas."
      )}`
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (!data.session) {
    redirect(
      `/login?message=${encodeURIComponent(
        "Compte cree. Verifie ta boite mail pour confirmer ton adresse, puis connecte-toi."
      )}`
    );
  }

  redirect("/dashboard/agents");
}
