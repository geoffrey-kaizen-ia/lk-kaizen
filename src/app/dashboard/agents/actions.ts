"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase.from("lk_agents").insert({
    account_id: accountId,
    name: formData.get("name") as string,
    objectif: (formData.get("objectif") as string) || null,
    prompt_content: (formData.get("prompt_content") as string) || null,
    knowledge_base: knowledgeBase,
    is_active: true,
  });

  if (error) return { error: error.message };
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
      max_tokens: 500,
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
  profileSummary: string;
};

// Reproduit le prompt utilisateur du node "Claude - Icebreaker" du workflow n8n
// "Kaizen - Icebreaker LinkedIn" (0yQOYs1Ffiqtj4IX), pour tester un agent
// "premier message" (icebreaker / invitation recue) sans toucher aux vraies donnees.
export async function testFirstMessage(input: TestFirstMessageInput) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "ANTHROPIC_API_KEY non configuree sur le serveur" };
  }

  const userMessage = `Voila le profil du prospect :
Prenom : ${input.firstName}
Headline : ${input.headline}

Resume du profil :${input.profileSummary}`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: TEST_MODEL,
      max_tokens: 500,
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
