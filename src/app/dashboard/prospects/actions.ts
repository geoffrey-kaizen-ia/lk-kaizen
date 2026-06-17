"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getAccountId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Filtre user_id : la policy admin (geoffrey) lit toutes les fiches, sans ce
  // filtre maybeSingle renverrait null et bloquerait l'admin.
  const { data } = await supabase
    .from("lk_clients_config")
    .select("account_id")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  return data?.account_id ?? null;
}

// Lance une recherche de profils LinkedIn via n8n (Unipile). Appel fire-and-forget :
// n8n ecrit les resultats dans lk_search_results, le client revient les voir plus tard.
export async function launchSearch(formData: FormData) {
  const accountId = await getAccountId();
  if (!accountId) return { error: "Compte non configure" };

  const keywords = formData.get("keywords") as string;
  const location = (formData.get("location") as string) || null;
  const networkDistance = (formData.get("network_distance") as string) || null;
  const maxResultsRaw = (formData.get("max_results") as string)?.trim();
  const maxResults = maxResultsRaw ? Number(maxResultsRaw) : 50;
  const autoInvite = formData.get("auto_invite") === "on";

  // Filtres de ciblage (Feature 4). Le secteur (include) est resolu en ID LinkedIn
  // cote n8n et envoye a Unipile. L'exclusion de secteur n'est PAS geree :
  // l'API classic/people ne la supporte pas et ne renvoie pas le secteur par profil.
  // Les titres a exclure sont des mots-cles bruts, filtres sur le headline cote n8n.
  const industry = (formData.get("industry") as string)?.trim() || null;
  const excludeTitles = ((formData.get("exclude_titles") as string) || "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (!keywords?.trim()) return { error: "Les mots-cles sont obligatoires." };
  if (!Number.isFinite(maxResults) || maxResults < 1 || maxResults > 50) {
    return { error: "Le nombre de resultats doit etre entre 1 et 50." };
  }

  try {
    const res = await fetch(process.env.N8N_PROSPECT_SEARCH_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: accountId,
        keywords: keywords.trim(),
        location,
        network_distance: networkDistance,
        max_results: maxResults,
        auto_invite: autoInvite,
        industry,
        exclude_titles: excludeTitles,
      }),
      cache: "no-store",
    });

    if (!res.ok) return { error: "Le lancement de la recherche a echoue." };

    const data = await res.json().catch(() => null);
    if (data?.exhausted) {
      return { error: "Plus de profils disponibles pour cette recherche. Modifie tes criteres pour relancer." };
    }
  } catch {
    return { error: "Impossible de contacter le service de recherche." };
  }

  revalidatePath("/dashboard/prospects");
  return { error: null };
}

// Coche/decoche un profil dans les resultats (status pending <-> selected).
export async function toggleResultSelection(id: string, selected: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("lk_search_results")
    .update({ status: selected ? "selected" : "pending" })
    .eq("id", id);

  if (error) return { error: error.message };
  // Pas de revalidatePath : la selection est geree en etat local cote client
  // pour eviter que les lignes se reordonnent a chaque clic.
  return { error: null };
}

// Selectionne ou deselectionne plusieurs profils d'un coup (case "tout selectionner").
export async function setSelectionForIds(ids: string[], selected: boolean) {
  if (ids.length === 0) return { error: null };
  const supabase = await createClient();

  const { error } = await supabase
    .from("lk_search_results")
    .update({ status: selected ? "selected" : "pending" })
    .in("id", ids);

  if (error) return { error: error.message };
  return { error: null };
}

// Ignore un profil qui n'interesse pas (status -> ignored). Le profil disparait des profils a valider.
export async function ignoreResult(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("lk_search_results")
    .update({ status: "ignored" })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/prospects");
  return { error: null };
}

// Ignore plusieurs profils d'un coup (bouton "Ignorer la selection").
export async function ignoreSelectedIds(ids: string[]) {
  if (ids.length === 0) return { error: null };
  const supabase = await createClient();

  const { error } = await supabase
    .from("lk_search_results")
    .update({ status: "ignored" })
    .in("id", ids);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/prospects");
  return { error: null };
}

// Envoie les invitations pour les profils selectionnes (status='selected') via n8n.
export async function sendSelectedInvitations(searchId: string) {
  const supabase = await createClient();
  const accountId = await getAccountId();
  if (!accountId) return { error: "Compte non configure" };

  const { data: selected } = await supabase
    .from("lk_search_results")
    .select("id, provider_id")
    .eq("search_id", searchId)
    .eq("status", "selected");

  if (!selected || selected.length === 0) {
    return { error: "Aucun profil selectionne." };
  }

  try {
    const res = await fetch(process.env.N8N_PROSPECT_SEARCH_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send_invitations",
        account_id: accountId,
        search_id: searchId,
        provider_ids: selected.map((r) => r.provider_id),
      }),
      cache: "no-store",
    });

    if (!res.ok) return { error: "L'envoi des invitations a echoue." };
  } catch {
    return { error: "Impossible de contacter le service d'invitation." };
  }

  revalidatePath("/dashboard/prospects");
  return { error: null };
}
