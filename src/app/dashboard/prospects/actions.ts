"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getAccountId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("lk_clients_config")
    .select("account_id")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  return data?.account_id ?? null;
}

export async function createCampaign(formData: FormData) {
  const accountId = await getAccountId();
  if (!accountId) return { error: "Compte non configure" };

  const name = (formData.get("name") as string)?.trim();
  // keywords = requête LinkedIn finale ("x" OR "y") assemblée par TitlePicker.
  // keywords_list = liste brute des titres (JSON), conservée pour ré-édition.
  const keywords = (formData.get("keywords") as string)?.trim();
  let keywordsList: string[] = [];
  try {
    const parsed = JSON.parse((formData.get("keywords_list") as string) || "[]");
    if (Array.isArray(parsed)) keywordsList = parsed.filter((t) => typeof t === "string");
  } catch {
    keywordsList = [];
  }
  const location = (formData.get("location") as string)?.trim() || null;
  const networkDistance = (formData.get("network_distance") as string) || null;
  // Secteur : on stocke le libellé LinkedIn (pour l'affichage) ET son ID résolu
  // (pour n8n, qui filtre directement dessus sans avoir à le re-résoudre).
  const industry = (formData.get("industry_label") as string)?.trim() || null;
  const industryId = (formData.get("industry_id") as string)?.trim() || null;
  const targetCountRaw = (formData.get("target_count") as string)?.trim();
  const targetCount = targetCountRaw ? Number(targetCountRaw) : 500;
  const mode = (formData.get("mode") as string) === "auto" ? "auto" : "validation";

  if (!name) return { error: "Le nom de la campagne est obligatoire." };
  if (!keywords) return { error: "Les mots-cles sont obligatoires." };
  if (!Number.isFinite(targetCount) || targetCount < 1 || targetCount > 500) {
    return { error: "Le nombre de profils doit etre entre 1 et 500." };
  }

  // Le secteur fait partie de l'identite de la recherche : deux campagnes qui ne
  // different que par le secteur doivent avoir des hash distincts.
  const queryHash = createHash("sha256")
    .update(`${accountId}:${keywords}:${location ?? ""}:${networkDistance ?? ""}:${industryId ?? ""}`)
    .digest("hex")
    .slice(0, 16);

  const supabase = await createClient();
  // Relancer une campagne aux criteres identiques reprend la meme ligne (et son
  // curseur de pagination) au lieu de violer la contrainte UNIQUE (account_id, query_hash).
  // On omet volontairement total_scraped / total_sent / last_cursor : sur une reprise ils
  // sont preserves (curseur = on continue les profils suivants), sur une creation ils
  // prennent leur defaut (0 / null).
  const { data: campaign, error } = await supabase
    .from("lk_searches")
    .upsert(
      {
        account_id: accountId,
        name,
        query_hash: queryHash,
        query_params: { keywords, keywords_list: keywordsList, location, network_distance: networkDistance, industry, industry_id: industryId },
        target_count: targetCount,
        mode,
        status: "active",
        exhausted: false,
      },
      { onConflict: "account_id,query_hash" }
    )
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Déclenche le scraping immédiatement sans attendre le cron 8h30
  fetch("https://n8n.srv1213804.hstgr.cloud/webhook/Scrapping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_id: accountId,
      campaign_id: campaign.id,
      keywords,
      location: location || "",
      network_distance: networkDistance || "",
      max_results: targetCount,
      auto_invite: mode === "auto",
      industry: industry || "",
      industry_id: industryId || "",
    }),
  }).catch(() => {});

  revalidatePath("/dashboard/prospects");
  return { error: null };
}

export async function deleteCampaign(id: string) {
  const supabase = await createClient();
  await supabase.from("lk_search_results").delete().eq("search_id", id);
  const { error } = await supabase.from("lk_searches").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/prospects");
  return { error: null };
}

export async function archiveCampaign(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lk_searches")
    .update({ status: "archived" })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/prospects");
  return { error: null };
}

export async function updateCampaignStatus(id: string, status: "active" | "paused") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lk_searches")
    .update({ status })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/prospects");
  return { error: null };
}

// Valide les profils sélectionnés → file d'attente (cron les enverra à 7h)
export async function addToQueue(ids: string[]) {
  if (ids.length === 0) return { error: null };
  const supabase = await createClient();
  const { error } = await supabase
    .from("lk_search_results")
    .update({ status: "selected" })
    .in("id", ids);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/prospects");
  return { error: null };
}

// Retire un profil de la file d'attente → retour en "à valider"
export async function removeFromQueue(ids: string[]) {
  if (ids.length === 0) return { error: null };
  const supabase = await createClient();
  const { error } = await supabase
    .from("lk_search_results")
    .update({ status: "pending" })
    .in("id", ids);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/prospects");
  return { error: null };
}

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

export async function renameCampaign(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Le nom ne peut pas être vide." };
  const accountId = await getAccountId();
  if (!accountId) return { error: "Compte non configuré." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("lk_searches")
    .update({ name: trimmed })
    .eq("id", id)
    .eq("account_id", accountId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/prospects");
  return { error: null };
}
