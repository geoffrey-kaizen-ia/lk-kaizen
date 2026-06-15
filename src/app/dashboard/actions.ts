"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Declenche la connexion LinkedIn : appelle le webhook n8n (serveur a serveur, pas de CORS),
// recupere l'URL hosted-auth Unipile et redirige le client dessus.
export async function connectLinkedin() {
  const supabase = await createClient();

  // user_id de la session courante — c'est lui qu'on envoie a n8n comme identifiant de correspondance.
  // Unipile le renvoie dans le callback notify_url pour qu'on puisse faire le lien avec l'account_id.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/dashboard/agents?linkedin=error");
  }

  let unipileUrl: string | null = null;
  try {
    const res = await fetch(process.env.N8N_UNIPILE_CONNECT_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id }),
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      // L'URL hosted-auth Unipile peut arriver a la racine ou sous une cle body selon n8n.
      unipileUrl = data?.url ?? data?.body?.url ?? null;
    }
  } catch {
    unipileUrl = null;
  }

  if (!unipileUrl) {
    redirect("/dashboard/agents?linkedin=error");
  }

  redirect(unipileUrl);
}
