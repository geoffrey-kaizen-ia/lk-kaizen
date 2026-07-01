"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { canAssign } from "@/lib/crash-test/gate";
import type { TestStatus } from "@/lib/crash-test/types";

const TEST_MODEL = "claude-sonnet-4-6";

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

// Previent n8n qu'un agent doit passer le crash test. Fire and forget :
// une panne du webhook ne doit jamais casser l'action appelante.
async function triggerCrashTest(agentId: string, trigger: "create" | "manual") {
  const url = process.env.N8N_CRASH_TEST_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId, trigger }),
      cache: "no-store",
    });
  } catch {
    // ignore : le crash test pourra etre relance manuellement
  }
}

export async function createAgent(formData: FormData) {
  const supabase = await createClient();
  const accountId = await getAccountId();
  if (!accountId) return { error: "Compte non configure" };

  const knowledgeRaw = formData.get("knowledge_base") as string | null;
  let knowledgeBase: unknown = null;
  if (knowledgeRaw) {
    try {
      knowledgeBase = JSON.parse(knowledgeRaw);
    } catch {
      knowledgeBase = null;
    }
  }

  const { data: created, error } = await supabase
    .from("lk_agents")
    .insert({
      account_id: accountId,
      name: formData.get("name") as string,
      objectif: (formData.get("objectif") as string) || null,
      prompt_content: (formData.get("prompt_content") as string) || null,
      knowledge_base: knowledgeBase,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  if (created) await triggerCrashTest(created.id, "create");
  revalidatePath("/dashboard/agents");
  return { error: null };
}

export async function relaunchCrashTest(agentId: string) {
  const supabase = await createClient();
  const accountId = await getAccountId();
  if (!accountId) return { error: "Compte non configure" };

  // Verifie que l'agent appartient bien au client connecte avant de declencher.
  const { data: agent } = await supabase
    .from("lk_agents")
    .select("id")
    .eq("id", agentId)
    .eq("account_id", accountId)
    .maybeSingle();

  if (!agent) return { error: "Agent introuvable" };

  await triggerCrashTest(agentId, "manual");
  revalidatePath("/dashboard/agents");
  return { error: null };
}

export async function updateAgent(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;

  const knowledgeRaw = formData.get("knowledge_base") as string | null;
  let knowledgeBase: unknown = null;
  if (knowledgeRaw) {
    try {
      knowledgeBase = JSON.parse(knowledgeRaw);
    } catch {
      knowledgeBase = null;
    }
  }

  const { error } = await supabase
    .from("lk_agents")
    .update({
      name: formData.get("name") as string,
      objectif: (formData.get("objectif") as string) || null,
      prompt_content: (formData.get("prompt_content") as string) || null,
      knowledge_base: knowledgeBase,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/agents");
  return { error: null };
}

export async function duplicateAgent(id: string) {
  const supabase = await createClient();
  const accountId = await getAccountId();
  if (!accountId) return { error: "Compte non configure" };

  // RLS limite la lecture aux agents du compte connecte : pas de risque de
  // dupliquer l'agent d'un autre client.
  const { data: source, error: readError } = await supabase
    .from("lk_agents")
    .select("name, objectif, prompt_content, knowledge_base")
    .eq("id", id)
    .maybeSingle();

  if (readError) return { error: readError.message };
  if (!source) return { error: "Agent introuvable" };

  // La copie repart active mais non assignee a un role : on ne touche pas
  // lk_agent_assignments, l'original garde son ou ses roles.
  const { error } = await supabase.from("lk_agents").insert({
    account_id: accountId,
    name: `${source.name ?? "Agent"} (copie)`,
    objectif: source.objectif,
    prompt_content: source.prompt_content,
    knowledge_base: source.knowledge_base,
    is_active: true,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/agents");
  return { error: null };
}

export async function archiveAgent(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("lk_agents")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/agents");
  return { error: null };
}

export async function deleteAgent(id: string) {
  const supabase = await createClient();

  await supabase.from("lk_agent_assignments").delete().eq("agent_id", id);

  const { error } = await supabase.from("lk_agents").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/agents");
  return { error: null };
}

export async function upsertAssignment(role: string, agentId: string) {
  const supabase = await createClient();
  const accountId = await getAccountId();
  if (!accountId) return { error: "Compte non configure" };

  // Garde crash test : seul un agent valide peut etre assigne a un role de prod.
  const { data: agent } = await supabase
    .from("lk_agents")
    .select("test_status")
    .eq("id", agentId)
    .maybeSingle();

  if (!agent) return { error: "Agent introuvable" };
  if (!canAssign((agent.test_status ?? "untested") as TestStatus)) {
    return {
      error:
        "Cet agent doit reussir le crash test avant d'etre assigne a un role.",
    };
  }

  const { error } = await supabase
    .from("lk_agent_assignments")
    .upsert(
      { account_id: accountId, role, agent_id: agentId },
      { onConflict: "account_id,role" }
    );

  if (error) return { error: error.message };
  revalidatePath("/dashboard/agents");
  return { error: null };
}

type TestAgentInput = {
  promptContent: string;
  historique: string;
  dernierMessage: string;
  nombreEchanges: number;
  entreprise: string;
  poste: string;
  resume: string;
};

// Reproduit le prompt utilisateur du node "Claude - Reponse" du workflow n8n
// "Kaizen - Conversation LinkedIn" (fsSw8bIknV1cAgKx), pour tester un agent
// dans les memes conditions que la production, sans toucher aux vraies donnees.
export async function testAgentReply(input: TestAgentInput) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "ANTHROPIC_API_KEY non configuree sur le serveur" };
  }

  const userMessage = `
Historique de la conversation:
${input.historique}


Dernier message du prospect:
${input.dernierMessage}

Infos prospect:
Entreprise: ${input.entreprise}
Poste: ${input.poste}
Resume: ${input.resume}

Nombre de messages envoyes: ${input.nombreEchanges}`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: TEST_MODEL,
      max_tokens: 700,
      temperature: 0.8,
      system: input.promptContent,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = response.content[0];
    const reply = block?.type === "text" ? block.text.trim() : "";
    return { reply, error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

type TestFirstMessageInput = {
  promptContent: string;
  firstName: string;
  headline: string;
  about: string;
};

// Reproduit le prompt utilisateur du node "Claude - Icebreaker" du workflow n8n
// "Kaizen - Icebreaker LinkedIn" (0yQOYs1Ffiqtj4IX), pour tester un agent
// "premier message" (icebreaker / invitation recue) sans toucher aux vraies donnees.
export async function testFirstMessage(input: TestFirstMessageInput) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "ANTHROPIC_API_KEY non configuree sur le serveur" };
  }

  // Format minimal : prenom + headline + a-propos optionnel.
  const lines: string[] = [];
  lines.push(`Nom complet : ${input.firstName.trim() || "(inconnu)"}`);
  if (input.headline.trim()) lines.push(`Headline : ${input.headline.trim()}`);
  if (input.about.trim()) lines.push(`A-propos : ${input.about.trim()}`);

  const userMessage = `Voici les donnees du profil LinkedIn du prospect :\n\n${lines.join("\n")}`;

  // Override test : le prompt stocke en base peut avoir un garde-fou strict (ancienne version).
  // On ajoute une instruction finale qui prend le dessus : toujours produire un message,
  // meme avec peu d'infos. Le comportement prod (n8n) n'est pas affecte.
  const TEST_OVERRIDE = `\n\n<override_test>\nTu es en mode simulation. Produis TOUJOURS un message, quelle que soit la quantite d'informations disponibles. Ne renvoie JAMAIS profil_insuffisant a true en mode simulation. Si le profil est minimal, appuie-toi sur le headline ou le secteur pour construire une accroche de niveau d (contexte entreprise/secteur). Le champ profil_insuffisant doit toujours etre false.\n</override_test>`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: TEST_MODEL,
      max_tokens: 600,
      temperature: 0.8,
      system: input.promptContent + TEST_OVERRIDE,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = response.content[0];
    const reply = block?.type === "text" ? block.text.trim() : "";
    return { reply, error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

// Scrape un vrai profil LinkedIn via Unipile pour pre-remplir le formulaire de test.
// Le public_identifier est extrait de l'URL ou utilise directement si c'est deja un slug.
export async function scrapeLinkedInProfile(linkedinUrl: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Session expiree" };

  const { data: config } = await supabase
    .from("lk_clients_config")
    .select("account_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const accountId = config?.account_id;
  if (!accountId) return { error: "Compte LinkedIn non configure" };

  const match = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
  const identifier = (match?.[1] ?? linkedinUrl).replace(/\/$/, "").trim();
  if (!identifier) return { error: "URL LinkedIn invalide" };

  const baseUrl = process.env.UNIPILE_BASE_URL;
  const apiKey = process.env.UNIPILE_API_KEY;
  if (!baseUrl || !apiKey) return { error: "Configuration Unipile manquante (UNIPILE_BASE_URL / UNIPILE_API_KEY)" };

  const authHeaders = { "X-API-KEY": apiKey, Accept: "application/json" };

  // 1) Profil : GET /api/v1/users/{identifier}. L'identifier accepte le public_identifier
  // (slug "prenom-nom") ou le provider id.
  try {
    const res = await fetch(
      `${baseUrl}/api/v1/users/${encodeURIComponent(identifier)}?account_id=${accountId}`,
      { headers: authHeaders, cache: "no-store" }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { error: `Unipile ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}` };
    }

    const profile = await res.json();
    const firstName =
      profile.first_name ??
      (typeof profile.name === "string" ? profile.name.split(" ")[0] : "") ??
      "";

    // Assemble un "a-propos" riche a partir des sections du profil.
    const aboutParts: string[] = [];
    const summary = (profile.summary ?? profile.about ?? "").trim();
    if (summary) aboutParts.push(summary);

    if (profile.location) aboutParts.push(`Localisation : ${profile.location}`);

    // Experiences (work_experience selon le schema Unipile profil complet).
    const experiences = profile.work_experience ?? profile.experience ?? [];
    if (Array.isArray(experiences) && experiences.length > 0) {
      const lines = experiences
        .slice(0, 3)
        .map((e: Record<string, unknown>) => {
          const role = (e.position ?? e.role ?? e.title ?? "") as string;
          const company = (e.company ?? e.company_name ?? "") as string;
          return [role, company].filter(Boolean).join(" @ ");
        })
        .filter(Boolean);
      if (lines.length) aboutParts.push(`Experiences :\n- ${lines.join("\n- ")}`);
    }

    // 2) Derniers posts : GET /api/v1/users/{provider_id}/posts. Necessite l'id interne
    // (provider_id), pas le slug. On l'extrait du profil.
    const providerId = profile.provider_id ?? profile.id ?? null;
    if (providerId) {
      try {
        const postsRes = await fetch(
          `${baseUrl}/api/v1/users/${encodeURIComponent(String(providerId))}/posts?account_id=${accountId}&limit=5`,
          { headers: authHeaders, cache: "no-store" }
        );
        if (postsRes.ok) {
          const postsData = await postsRes.json();
          const items = Array.isArray(postsData?.items) ? postsData.items : [];
          const texts = items
            .map((p: Record<string, unknown>) => (p.text as string)?.trim())
            .filter((t: string) => t && t.length > 0)
            .slice(0, 3)
            .map((t: string) => (t.length > 280 ? t.slice(0, 280) + "..." : t));
          if (texts.length) {
            aboutParts.push(`Derniers posts :\n- ${texts.join("\n- ")}`);
          }
        }
      } catch {
        // Posts optionnels : on ignore une erreur ici, le profil seul reste exploitable.
      }
    }

    return {
      firstName: firstName.trim(),
      headline: (profile.headline ?? "").trim(),
      about: aboutParts.join("\n\n"),
      error: null,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

export async function removeAssignment(role: string) {
  const supabase = await createClient();
  const accountId = await getAccountId();
  if (!accountId) return { error: "Compte non configure" };

  const { error } = await supabase
    .from("lk_agent_assignments")
    .delete()
    .eq("account_id", accountId)
    .eq("role", role);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/agents");
  return { error: null };
}

export async function toggleRoleEnabled(role: string, enabled: boolean) {
  const supabase = await createClient();
  const accountId = await getAccountId();
  if (!accountId) return { error: "Compte non configure" };

  const { error } = await supabase
    .from("lk_agent_assignments")
    .update({ is_enabled: enabled })
    .eq("account_id", accountId)
    .eq("role", role);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/agents");
  return { error: null };
}

export async function updateIcebreakerConfig(
  mode: "ai" | "template",
  template: string | null
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expiree, recharge la page." };

  if (mode === "template" && !template?.trim()) {
    return { error: "Le message template ne peut pas etre vide." };
  }

  const { error } = await supabase
    .from("lk_clients_config")
    .update({
      icebreaker_mode: mode,
      icebreaker_template: mode === "template" ? template?.trim() ?? null : null,
    })
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/agents");
  return { error: null };
}

export async function toggleIcebreakerEnabled(enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expiree, recharge la page." };

  const { error } = await supabase
    .from("lk_clients_config")
    .update({ icebreaker_enabled: enabled })
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/agents");
  return { error: null };
}

// --- Relances : liste libre de messages fixes editables, par compte client ---

export async function createRelance() {
  const supabase = await createClient();
  const accountId = await getAccountId();
  if (!accountId) return { error: "Compte non configure" };

  // Position = derniere position + 1 (numerotation continue de la sequence).
  const { data: last } = await supabase
    .from("lk_relances")
    .select("position")
    .eq("account_id", accountId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (last?.position ?? 0) + 1;

  const { error } = await supabase.from("lk_relances").insert({
    account_id: accountId,
    position: nextPosition,
    content: "",
    delay_days: 3,
    is_active: true,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/agents");
  return { error: null };
}

export async function updateRelance(
  id: string,
  fields: { content?: string; delay_days?: number; is_active?: boolean }
) {
  const supabase = await createClient();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.content !== undefined) patch.content = fields.content;
  if (fields.delay_days !== undefined) patch.delay_days = Math.max(0, Math.floor(fields.delay_days));
  if (fields.is_active !== undefined) patch.is_active = fields.is_active;

  // RLS limite la mise a jour aux relances du compte du client connecte.
  const { error } = await supabase.from("lk_relances").update(patch).eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/agents");
  return { error: null };
}

export async function deleteRelance(id: string) {
  const supabase = await createClient();
  const accountId = await getAccountId();
  if (!accountId) return { error: "Compte non configure" };

  const { error } = await supabase.from("lk_relances").delete().eq("id", id);
  if (error) return { error: error.message };

  // Renumerote les positions restantes pour garder une sequence continue 1..n.
  const { data: remaining } = await supabase
    .from("lk_relances")
    .select("id")
    .eq("account_id", accountId)
    .order("position", { ascending: true });

  if (remaining) {
    await Promise.all(
      remaining.map((r, i) =>
        supabase.from("lk_relances").update({ position: i + 1 }).eq("id", r.id)
      )
    );
  }

  revalidatePath("/dashboard/agents");
  return { error: null };
}

// Echange la position de la relance avec sa voisine (haut/bas).
export async function moveRelance(id: string, direction: "up" | "down") {
  const supabase = await createClient();
  const accountId = await getAccountId();
  if (!accountId) return { error: "Compte non configure" };

  const { data: rows } = await supabase
    .from("lk_relances")
    .select("id, position")
    .eq("account_id", accountId)
    .order("position", { ascending: true });

  if (!rows) return { error: null };

  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return { error: null };
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= rows.length) return { error: null };

  const a = rows[idx];
  const b = rows[swapIdx];
  await Promise.all([
    supabase.from("lk_relances").update({ position: b.position }).eq("id", a.id),
    supabase.from("lk_relances").update({ position: a.position }).eq("id", b.id),
  ]);

  revalidatePath("/dashboard/agents");
  return { error: null };
}
