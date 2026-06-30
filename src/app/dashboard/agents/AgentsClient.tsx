"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
  createAgent,
  updateAgent,
  duplicateAgent,
  archiveAgent,
  deleteAgent,
  upsertAssignment,
  removeAssignment,
  toggleRoleEnabled,
  updateIcebreakerConfig,
  toggleIcebreakerEnabled,
  createRelance,
  updateRelance,
} from "./actions";

const IB_VARIABLES = [
  { label: "{{first_name}}", desc: "Prenom" },
];

const RELANCE_VARS = [
  { label: "{{first_name}}", desc: "Prénom" },
  { label: "{{last_name}}", desc: "Nom" },
];

const RELANCE_TEMPLATES = [
  "Bonjour {{first_name}}, je reviens vers toi suite à mon message précédent. Tu as eu l'occasion d'y jeter un œil ?",
  "Bonjour {{first_name}}, toujours dans ma liste de personnes avec qui j'aimerais bien échanger. Le timing est peut-être meilleur maintenant ?",
  "Bonjour {{first_name}}, je referme la boucle sur mon message. Si ce n'est pas pour toi, dis-le moi franchement, aucun souci.",
  "Bonjour {{first_name}}, pas de réponse de ta part, peut-être pas le bon moment. Je reste disponible si jamais tu veux qu'on en parle.",
  "Bonjour {{first_name}}, je retente ma chance ! Tu as deux minutes pour qu'on échange ?",
  "Bonjour {{first_name}}, dernier message de ma part. Si tu as 15 min pour en parler, je suis là.",
  "Bonjour {{first_name}}, je passe te faire signe. Mon message précédent a peut-être été enterré dans ta messagerie ?",
  "Bonjour {{first_name}}, comment ça se passe de ton côté en ce moment ? Je me demandais si mon message avait résonné.",
  "Bonjour {{first_name}}, un petit coucou pour ne pas disparaître de ton radar. Toujours partant pour qu'on échange ?",
  "Bonjour {{first_name}}, je voulais savoir si tu avais eu le temps de réfléchir. Aucune urgence, je suis là quand tu veux.",
];
import AgentWizard from "./AgentWizard";
import TestAgentModal from "./TestAgentModal";
import TestFirstMessageModal from "./TestFirstMessageModal";

type Agent = {
  id: string;
  name: string | null;
  objectif: string | null;
  prompt_content: string | null;
  is_active: boolean | null;
  knowledge_base: Record<string, unknown> | null;
  test_status: string | null;
};

type Assignment = {
  role: string;
  agent_id: string;
  is_enabled: boolean;
};

type Relance = {
  id: string;
  position: number;
  content: string;
  delay_days: number;
  is_active: boolean;
};


const ROLES = [
  {
    key: "icebreaker",
    label: "Prise de contact",
    longDesc:
      "Quand un prospect accepte ton invitation, cet agent lui envoie un seul message d'ouverture, personnalisé à partir de son profil. Selon son réglage, il pose une question ou propose ton invitation. Pas de conversation, juste l'ouverture.",
    iconColor: "text-accent",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    ),
  },
  {
    key: "conversation",
    label: "Conversation",
    longDesc:
      "C'est l'agent qui discute avec tes prospects une fois la conversation engagee : il relance, repond aux questions, qualifie et amene vers ton objectif. C'est lui qui gere TOUS les echanges, message apres message.",
    iconColor: "text-positive",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    key: "relance",
    label: "Relance",
    longDesc:
      "Message envoye automatiquement quand un prospect ne repond pas. Utilise la variable {{first_name}} pour personnaliser. Le message est fixe, pas d'IA.",
    iconColor: "text-warning",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
] as const;

type RoleKey = (typeof ROLES)[number]["key"];

const FIRST_MESSAGE_ROLE_LABELS: Record<string, string> = {
  icebreaker: "Prise de contact",
  invitation_recue: "Invitation reçue",
};

// Quel agentType peut etre assigne a quel role : evite de mixer un agent
// conversationnel avec un role "premier message" et inversement.
const ROLE_AGENT_TYPE: Record<RoleKey, string> = {
  icebreaker: "icebreaker",
  conversation: "conversation",
  relance: "relance",
};

function getAgentType(agent: Agent): string | null {
  const agentType = agent.knowledge_base?.agentType;
  return typeof agentType === "string" ? agentType : null;
}

function isFirstMessageAgent(agent: Agent, assignedRoles: string[]): boolean {
  const agentType = getAgentType(agent);
  if (agentType === "icebreaker" || agentType === "invitation_recue") return true;
  if (agentType === "conversation") return false;
  // Agents crees avant l'introduction du type : on se base sur le role assigne.
  return assignedRoles.includes("Icebreaker") || assignedRoles.includes("Invitation recue");
}

// Agents pouvant etre assignes a un role donne : meme type que le role, ou
// agents anciens sans type defini (on ne peut pas les classer, on les laisse partout).
function agentsCompatibleWithRole(agents: Agent[], role: RoleKey): Agent[] {
  return agents.filter((a) => {
    const agentType = getAgentType(a);
    return agentType === null || agentType === ROLE_AGENT_TYPE[role];
  });
}

// Petit logo colore indiquant le type de l'agent (affiche a cote de son nom).
const AGENT_TYPE_ICON: Record<string, { label: string; iconColor: string; icon: React.ReactNode }> = {
  conversation: {
    label: "Agent de conversation",
    iconColor: "text-positive",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  icebreaker: {
    label: "Agent prise de contact (premier message)",
    iconColor: "text-accent",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    ),
  },
  relance: {
    label: "Agent relance (message fixe)",
    iconColor: "text-warning",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  invitation_recue: {
    label: "Agent invitation reçue (premier message)",
    iconColor: "text-warning",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

// Options du selecteur "Type d'agent" du formulaire (modal creation/edition).
const AGENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "conversation", label: "Conversation" },
  { value: "icebreaker", label: "Prise de contact (premier message)" },
];

export default function AgentsClient({
  agents,
  assignments,
  allowedRoles,
  canEditPrompt,
  icebreakerMode,
  icebreakerTemplate,
  icebreakerEnabled,
  relances,
  accountFullName,
}: {
  agents: Agent[];
  assignments: Assignment[];
  allowedRoles: string[];
  canEditPrompt: boolean;
  icebreakerMode: "ai" | "template";
  icebreakerTemplate: string;
  icebreakerEnabled: boolean;
  relances: Relance[];
  accountFullName: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  useEffect(() => {
    if (wizardOpen || modalOpen) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [wizardOpen, modalOpen]);
  const [editingWizardAgent, setEditingWizardAgent] = useState<Agent | null>(null);
  const [testingAgent, setTestingAgent] = useState<Agent | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingAgentType, setPendingAgentType] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Icebreaker config state
  const [ibMode, setIbMode] = useState<"ai" | "template">(icebreakerMode);
  const [ibTemplate, setIbTemplate] = useState(icebreakerTemplate);
  const [ibEnabled, setIbEnabled] = useState(icebreakerEnabled);
  const [ibSaving, startIbTransition] = useTransition();
  const [ibError, setIbError] = useState<string | null>(null);
  const [ibSaved, setIbSaved] = useState(false);
  const [ibTemplateDirty, setIbTemplateDirty] = useState(false);
  const ibTextareaRef = useRef<HTMLTextAreaElement>(null);
  const relanceTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [relanceContent, setRelanceContent] = useState("");
  const [promptContent, setPromptContent] = useState("");
  const [promptFullscreen, setPromptFullscreen] = useState(false);

  function insertIbVariable(variable: string) {
    const el = ibTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = ibTemplate.slice(0, start) + variable + ibTemplate.slice(end);
    setIbTemplate(next);
    setIbTemplateDirty(true);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    });
  }

  // Active un bloc (ai ou template) — desactive l'autre automatiquement
  function handleIbBlockActivate(block: "ai" | "template") {
    setIbMode(block);
    setIbEnabled(true);
    setIbError(null);
    setIbSaved(false);
    startIbTransition(async () => {
      const result = await updateIcebreakerConfig(block, block === "template" ? ibTemplate : null);
      if (result.error) {
        setIbError(result.error);
        return;
      }
      await toggleIcebreakerEnabled(true);
    });
  }

  // Desactive l'icebreaker (les deux blocs s'eteignent)
  function handleIbDisable() {
    setIbEnabled(false);
    startIbTransition(async () => {
      await toggleIcebreakerEnabled(false);
    });
  }

  function insertRelanceVariable(variable: string) {
    const el = relanceTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = relanceContent.slice(0, start) + variable + relanceContent.slice(end);
    setRelanceContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    });
  }

  function handleIbSaveTemplate() {
    setIbError(null);
    setIbSaved(false);
    startIbTransition(async () => {
      const result = await updateIcebreakerConfig("template", ibTemplate);
      if (result.error) {
        setIbError(result.error);
      } else {
        setIbSaved(true);
        setIbTemplateDirty(false);
      }
    });
  }

  const activeAgents = agents.filter((a) => a.is_active !== false);
  const archivedAgents = agents.filter((a) => a.is_active === false);

  // Prefill du wizard a la creation : on reutilise le nom et le business deja
  // saisis dans un agent precedent. La fiche client (full_name) est souvent
  // vide, on ne s'appuie donc pas dessus en priorite pour le nom. Tout reste
  // vide au tout premier agent, c'est attendu.
  const firstAgentValue = (
    key: "userName" | "businessName" | "businessDescription"
  ): string => {
    for (const a of agents) {
      const v = a.knowledge_base?.[key];
      if (typeof v === "string" && v.trim() !== "") return v.trim();
    }
    return "";
  };
  const wizardDefaults = {
    userName: firstAgentValue("userName") || accountFullName,
    businessName: firstAgentValue("businessName"),
    businessDescription: firstAgentValue("businessDescription"),
  };

  const assignmentMap: Record<string, string> = Object.fromEntries(
    assignments.map((a) => [a.role, a.agent_id])
  );
  const enabledMap: Record<string, boolean> = Object.fromEntries(
    assignments.map((a) => [a.role, a.is_enabled])
  );

  function openCreate() {
    setEditingAgent(null);
    setEditingWizardAgent(null);
    setFormError(null);
    setPendingAgentType(null);
    setWizardOpen(true);
  }

  function openCreateRelance() {
    setEditingAgent(null);
    setFormError(null);
    setPendingAgentType("relance");
    setRelanceContent("");
    setPromptContent("");
    setModalOpen(true);
  }

  function handleWizardCreate(data: {
    id?: string;
    name: string;
    objectif: string;
    prompt_content: string;
    knowledge_base?: unknown;
  }) {
    if (!data.id && data.name === "" && data.objectif === "" && data.prompt_content === "") {
      // Agent vierge : ouvrir le formulaire libre habituel, en conservant le type choisi
      const kb = data.knowledge_base as { agentType?: unknown } | undefined;
      const agentType = typeof kb?.agentType === "string" ? kb.agentType : null;
      setWizardOpen(false);
      setEditingAgent(null);
      setFormError(null);
      setPendingAgentType(agentType);
      setPromptContent("");
      setModalOpen(true);
      return;
    }

    const formData = new FormData();
    if (data.id) formData.set("id", data.id);
    formData.set("name", data.name);
    formData.set("objectif", data.objectif);
    formData.set("prompt_content", data.prompt_content);
    if (data.knowledge_base) {
      formData.set("knowledge_base", JSON.stringify(data.knowledge_base));
    }

    startTransition(async () => {
      const result = data.id ? await updateAgent(formData) : await createAgent(formData);
      if (result.error) {
        setFormError(result.error);
      } else {
        setWizardOpen(false);
        setEditingWizardAgent(null);
      }
    });
  }

  function openEdit(agent: Agent) {
    setFormError(null);
    const type = getAgentType(agent);
    // Agents crees via le wizard (conversation / prise de contact) : on rouvre
    // le wizard pre-rempli pour modifier les reponses et regenerer le prompt.
    const hasWizardData =
      !!agent.knowledge_base &&
      (type === "conversation" || type === "icebreaker" || type === "invitation_recue");
    if (hasWizardData) {
      setEditingWizardAgent(agent);
      setPendingAgentType(null);
      setWizardOpen(true);
      return;
    }
    // Relances + agents legacy sans donnees structurees : modal simple.
    setEditingAgent(agent);
    setPendingAgentType(null);
    setRelanceContent(agent.prompt_content ?? "");
    setPromptContent(agent.prompt_content ?? "");
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setFormError(null);

    const agentType = formData.get("agent_type") as string;
    formData.delete("agent_type");
    const knowledgeBase = {
      ...(editingAgent?.knowledge_base ?? {}),
      agentType: agentType || null,
    };
    formData.set("knowledge_base", JSON.stringify(knowledgeBase));

    startTransition(async () => {
      const result = editingAgent
        ? await updateAgent(formData)
        : await createAgent(formData);

      if (result.error) {
        setFormError(result.error);
      } else {
        setModalOpen(false);
        setPendingAgentType(null);
      }
    });
  }

  function handleDuplicate(id: string) {
    setFormError(null);
    startTransition(async () => {
      const result = await duplicateAgent(id);
      if (result.error) setFormError(result.error);
    });
  }

  function handleArchive(id: string) {
    startTransition(async () => {
      await archiveAgent(id);
    });
  }

  function handleDelete(id: string, name: string | null) {
    if (
      !window.confirm(
        `Supprimer definitivement l'agent "${name ?? "Sans nom"}" ? Cette action est irreversible.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      await deleteAgent(id);
    });
  }

  function handleRoleChange(role: RoleKey, agentId: string) {
    startTransition(async () => {
      if (agentId === "") {
        await removeAssignment(role);
      } else {
        await upsertAssignment(role, agentId);
      }
    });
  }

  function handleToggleEnabled(role: RoleKey, enabled: boolean) {
    startTransition(async () => {
      await toggleRoleEnabled(role, enabled);
    });
  }

  return (
    <div>
      {/* Explication des 3 types d'agents */}
      <section className="mb-8 rounded-lg border border-border bg-panel p-5">
        <h2 className="mb-1 font-display text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          Comprendre les agents
        </h2>
        <p className="mb-4 text-sm text-text-muted">
          Chaque agent joue un seul rôle à la fois. L&apos;agent Prise de contact envoie un seul message
          automatique quand un prospect accepte ton invitation, l&apos;agent Conversation gère tous les échanges qui suivent.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {ROLES.map(({ key, label, longDesc, iconColor, icon }) => (
            <div key={key} className="flex items-start gap-3">
              <div className={`mt-0.5 shrink-0 ${iconColor}`}>{icon}</div>
              <div>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="mt-0.5 text-xs text-text-muted">{longDesc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Nouvel agent */}
      <button
        onClick={openCreate}
        className="mb-8 flex w-full items-center gap-4 rounded-lg border-2 border-dashed border-accent/30 bg-accent/5 px-5 py-4 text-left transition-colors hover:border-accent/50 hover:bg-accent/10"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold text-accent">Créer un nouvel agent</p>
          <p className="text-xs text-text-muted">Prise de contact ou conversation : guide ton prospect vers ton objectif.</p>
        </div>
      </button>

      {/* Roles */}
      <section className="mb-8">
        <h2 className="mb-1 font-display text-base font-semibold tracking-tight text-foreground">
          Rôles actifs
        </h2>
        <p className="mb-4 text-sm text-text-muted">
          Choisis quel agent joue chaque rôle dans ta séquence de prospection.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ROLES.filter((r) => r.key !== "relance").map(({ key, label, iconColor, icon }) => {
            const isAllowed = allowedRoles.includes(key);

            // Icebreaker : radio list vertical dans la card, Message fixe s'ouvre en accordeon
            if (key === "icebreaker") {
              const aiActive = ibEnabled && ibMode === "ai";
              const templateActive = ibEnabled && ibMode === "template";

              return (
                <div
                  key={key}
                  className={`rounded-lg border p-4 ${
                    isAllowed ? "border-border bg-panel" : "border-border bg-panel opacity-50"
                  }`}
                >
                  {/* Header identique aux autres cards */}
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`shrink-0 ${isAllowed ? iconColor : "text-text-dim"}`}>{icon}</div>
                      <p className={`text-sm font-semibold ${isAllowed ? "text-foreground" : "text-text-muted"}`}>
                        {label}
                      </p>
                    </div>
                    {!isAllowed && (
                      <span className="rounded border border-border-strong px-1.5 py-0.5 font-display text-[9px] font-medium uppercase tracking-wider text-text-dim">
                        Forfait
                      </span>
                    )}
                  </div>

                  {isAllowed ? (
                    <div className="space-y-2">

                      {/* Option Agent IA */}
                      <div className={`rounded-md border p-3 transition-colors ${aiActive ? "border-accent/30 bg-accent/5" : "border-border"}`}>
                        <button
                          type="button"
                          disabled={ibSaving}
                          onClick={() => aiActive ? handleIbDisable() : handleIbBlockActivate("ai")}
                          className="flex w-full items-center gap-2.5 text-left"
                        >
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${aiActive ? "border-accent bg-accent" : "border-border-strong bg-panel-raised"}`}>
                            {aiActive && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                          <span className={`text-sm font-medium ${aiActive ? "text-foreground" : "text-text-muted"}`}>Agent IA</span>
                          {aiActive && (
                            <span className="ml-auto rounded bg-accent/10 px-1.5 py-0.5 font-display text-[9px] font-semibold uppercase tracking-wider text-accent">Actif</span>
                          )}
                        </button>
                        {aiActive && (
                          <div className="mt-2.5 pl-6">
                            <select
                              className="w-full rounded-md border border-border-strong bg-panel-raised px-2.5 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
                              value={assignmentMap["icebreaker"] ?? ""}
                              onChange={(e) => handleRoleChange("icebreaker", e.target.value)}
                              disabled={isPending}
                            >
                              <option value="">-- Choisir un agent --</option>
                              {agentsCompatibleWithRole(activeAgents, "icebreaker").map((a) => (
                                <option key={a.id} value={a.id}>{a.name ?? "Sans nom"}</option>
                              ))}
                            </select>
                            {!assignmentMap["icebreaker"] && (
                              <p className="mt-1.5 text-xs text-warning">Selectionne un agent pour que la prise de contact fonctionne.</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Option Message fixe — secondaire, replié en accordeon */}
                      <div className={`rounded-md border transition-colors ${templateActive ? "border-border bg-panel-raised/50" : "border-border/50"}`}>
                        <button
                          type="button"
                          disabled={ibSaving}
                          onClick={() => templateActive ? handleIbDisable() : handleIbBlockActivate("template")}
                          className="flex w-full items-center gap-2.5 p-3 text-left"
                        >
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${templateActive ? "border-accent bg-accent" : "border-border-strong bg-panel-raised"}`}>
                            {templateActive && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                          <span className={`text-xs ${templateActive ? "font-medium text-foreground" : "text-text-dim"}`}>
                            Ou utiliser un message fixe
                          </span>
                          {templateActive && (
                            <span className="ml-auto rounded bg-accent/10 px-1.5 py-0.5 font-display text-[9px] font-semibold uppercase tracking-wider text-accent">Actif</span>
                          )}
                        </button>
                        {!templateActive && (
                          <p className="px-3 pb-3 text-[11px] leading-relaxed text-text-dim">
                            Le même message pour tous, sans lecture du profil. À réserver aux cas où la personnalisation n&apos;apporte rien, comme un simple mot de remerciement.
                          </p>
                        )}

                        {/* Accordeon : uniquement si actif */}
                        {templateActive && (
                          <div className="border-t border-border/60 px-3 pb-3 pt-2.5 space-y-2.5">
                            <p className="text-xs text-text-muted">
                              Le même message part à chaque prospect. Utilise les variables pour personnaliser automatiquement avec son prénom ou son nom.
                            </p>

                            {/* Explication des variables */}
                            <div className="rounded-md border border-border bg-panel-raised px-3 py-2 space-y-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">Variable de personnalisation</p>
                              <div className="flex items-start gap-2">
                                <code className="shrink-0 rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">{`{{first_name}}`}</code>
                                <p className="text-xs text-text-muted">Prénom du prospect tel qu&apos;il apparaît sur LinkedIn. <span className="text-text-dim italic">Ex : Marie</span></p>
                              </div>
                              <p className="text-[10px] text-text-dim">Kaizen remplace cette variable par le vrai prénom du prospect au moment de l&apos;envoi. Clique dessus pour l&apos;insérer dans ton message.</p>
                            </div>

                            {/* Boutons insertion */}
                            <div className="flex flex-wrap gap-1">
                              {IB_VARIABLES.map((v) => (
                                <button
                                  key={v.label}
                                  type="button"
                                  onClick={() => insertIbVariable(v.label)}
                                  className="rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent hover:bg-accent/20"
                                >
                                  + {v.label}
                                </button>
                              ))}
                            </div>

                            <textarea
                              ref={ibTextareaRef}
                              value={ibTemplate}
                              onChange={(e) => { setIbTemplate(e.target.value); setIbTemplateDirty(true); setIbSaved(false); }}
                              rows={4}
                              placeholder="Bonjour {{first_name}}, ravi de te compter dans mon réseau !"
                              className="w-full resize-none rounded-md border border-border bg-panel px-2.5 py-2 text-xs text-foreground placeholder:text-text-dim outline-none focus:border-accent/50"
                            />

                            {ibError && <p className="text-xs text-danger">{ibError}</p>}
                            {ibSaved && !ibError && <p className="text-xs text-positive">Message enregistré.</p>}

                            <button
                              type="button"
                              onClick={handleIbSaveTemplate}
                              disabled={ibSaving}
                              className={`w-full rounded-md border py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                                ibTemplateDirty
                                  ? "border-warning/40 bg-warning/10 text-warning hover:bg-warning/20"
                                  : "border-accent/30 bg-accent/10 text-accent hover:bg-accent/20"
                              }`}
                            >
                              {ibSaving ? "Enregistrement..." : ibTemplateDirty ? "Enregistrer les modifications" : "Enregistrer"}
                            </button>
                          </div>
                        )}
                      </div>

                    </div>
                  ) : (
                    <p className="text-xs text-text-dim">Non inclus dans ton forfait actuel.</p>
                  )}
                </div>
              );
            }

            const isEnabled = enabledMap[key] ?? true;
            const hasAssignment = !!assignmentMap[key];

            return (
              <div
                key={key}
                className={`rounded-lg border p-4 transition-opacity ${
                  isAllowed ? "border-border bg-panel" : "border-border bg-panel opacity-50"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`shrink-0 ${isAllowed ? iconColor : "text-text-dim"}`}>{icon}</div>
                    <p className={`text-sm font-semibold ${isAllowed ? "text-foreground" : "text-text-muted"}`}>
                      {label}
                    </p>
                  </div>
                  {isAllowed ? (
                    <button
                      type="button"
                      disabled={isPending || !hasAssignment}
                      onClick={() => handleToggleEnabled(key, !isEnabled)}
                      title={isEnabled ? "Desactiver ce role" : "Activer ce role"}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
                        isEnabled && hasAssignment ? "bg-accent" : "bg-border-strong"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                          isEnabled && hasAssignment ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  ) : (
                    <span className="rounded border border-border-strong px-1.5 py-0.5 font-display text-[9px] font-medium uppercase tracking-wider text-text-dim">
                      Forfait
                    </span>
                  )}
                </div>
                {isAllowed ? (
                  <div className="space-y-2">
                    <select
                      className="w-full rounded-md border border-border-strong bg-panel-raised px-2.5 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
                      value={assignmentMap[key] ?? ""}
                      onChange={(e) => handleRoleChange(key, e.target.value)}
                      disabled={isPending}
                    >
                      <option value="">-- Aucun agent --</option>
                      {agentsCompatibleWithRole(activeAgents, key).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name ?? "Sans nom"}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-xs text-text-dim">Non inclus dans ton forfait actuel.</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Relances automatiques */}
      <section className="mb-8">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
            Relances automatiques
          </h2>
          {!allowedRoles.includes("relance") && (
            <span className="rounded border border-border-strong px-1.5 py-0.5 font-display text-[9px] font-medium uppercase tracking-wider text-text-dim">
              Forfait
            </span>
          )}
        </div>
        <p className="mb-4 text-sm text-text-muted">
          Messages envoyes automatiquement si un prospect ne repond pas, dans l&apos;ordre de la sequence.
        </p>
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${!allowedRoles.includes("relance") ? "pointer-events-none opacity-50" : ""}`}>
          <RelanceCard
            position={1}
            relance={relances.find((r) => r.position === 1)}
            canCreate={true}
          />
          <RelanceCard
            position={2}
            relance={relances.find((r) => r.position === 2)}
            canCreate={!!relances.find((r) => r.position === 1)}
          />
        </div>
      </section>

      {/* Agents list header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
          Mes agents
        </h1>
      </div>

      {/* Active agents */}
      {activeAgents.length === 0 && (
        <p className="text-sm text-text-muted">
          Aucun agent actif. Crée ton premier agent.
        </p>
      )}
      <ul className="space-y-4">
        {activeAgents.map((agent) => {
          const assignedRoles = ROLES.filter(
            (r) => assignmentMap[r.key] === agent.id
          ).map((r) => r.label);
          return (
            <AgentCard
              key={agent.id}
              agent={agent}
              assignedRoles={assignedRoles}
              onEdit={openEdit}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onTest={setTestingAgent}
              isPending={isPending}
              canEditPrompt={canEditPrompt}
            />
          );
        })}
      </ul>

      {/* Archived agents */}
      {archivedAgents.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer font-display text-xs text-text-muted hover:text-foreground">
            Agents archives ({archivedAgents.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {archivedAgents.map((agent) => (
              <li
                key={agent.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-panel p-4 opacity-60"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {agent.name ?? "Sans nom"}
                  </p>
                  {agent.objectif && (
                    <p className="text-xs text-text-muted">{agent.objectif}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(agent.id, agent.name)}
                  disabled={isPending}
                  className="shrink-0 rounded-md border border-danger/30 px-3 py-1.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Mode test agent */}
      {testingAgent && (() => {
        const testingAssignedRoles = ROLES.filter(
          (r) => assignmentMap[r.key] === testingAgent.id
        ).map((r) => r.label);
        if (isFirstMessageAgent(testingAgent, testingAssignedRoles)) {
          const agentType = testingAgent.knowledge_base?.agentType;
          const typeLabel =
            (typeof agentType === "string" && FIRST_MESSAGE_ROLE_LABELS[agentType]) ||
            testingAssignedRoles.find((r) => r === "Prise de contact") ||
            "premier message";
          return (
            <TestFirstMessageModal
              agent={testingAgent}
              agentTypeLabel={typeLabel}
              onClose={() => setTestingAgent(null)}
            />
          );
        }
        return (
          <TestAgentModal
            agent={testingAgent}
            onClose={() => setTestingAgent(null)}
          />
        );
      })()}

      {/* Wizard de creation */}
      {wizardOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-8"
        >
          <div className="w-full max-w-2xl rounded-lg border border-border bg-panel p-6 shadow-xl overscroll-contain">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-foreground">
                {editingWizardAgent ? "Modifier l'agent" : "Nouvel agent"}
              </h2>
              <button
                onClick={() => { setWizardOpen(false); setEditingWizardAgent(null); }}
                className="text-text-muted hover:text-foreground"
                aria-label="Fermer"
              >
                &#x2715;
              </button>
            </div>
            {formError && (
              <p className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {formError}
              </p>
            )}
            <AgentWizard
              key={editingWizardAgent?.id ?? "new"}
              onCancel={() => { setWizardOpen(false); setEditingWizardAgent(null); }}
              onCreate={handleWizardCreate}
              isPending={isPending}
              canEditPrompt={canEditPrompt}
              allowedRoles={allowedRoles}
              initialAgent={editingWizardAgent}
              defaults={wizardDefaults}
            />
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        >
          <div className="w-full max-w-lg rounded-lg border border-border bg-panel p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-foreground">
                {(() => {
                  const t = editingAgent ? getAgentType(editingAgent) : pendingAgentType;
                  if (t === "relance") return editingAgent ? "Modifier la relance" : "Nouvelle relance";
                  return editingAgent ? "Modifier l'agent" : "Nouvel agent";
                })()}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-text-muted hover:text-foreground"
                aria-label="Fermer"
              >
                &#x2715;
              </button>
            </div>
            {(() => {
              const formType = editingAgent ? (getAgentType(editingAgent) ?? "") : (pendingAgentType ?? "");
              const isRelance = formType === "relance";
              return (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {editingAgent && (
                    <input type="hidden" name="id" value={editingAgent.id} />
                  )}
                  {/* Pour une relance : type fixe en hidden, pas de type selector */}
                  {isRelance ? (
                    <input type="hidden" name="agent_type" value="relance" />
                  ) : null}

                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-muted">
                      {isRelance ? "Description" : "Nom"} <span className="text-danger">*</span>
                    </label>
                    <input
                      name="name"
                      required
                      defaultValue={editingAgent?.name ?? ""}
                      className="w-full rounded-md border border-border-strong bg-panel-raised px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                      placeholder={isRelance ? "Ex: Relance 1" : "Ex: Prospection dirigeants TPE"}
                    />
                  </div>

                  {!isRelance && (
                    <>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-text-muted">
                          Type d&apos;agent
                        </label>
                        <select
                          name="agent_type"
                          defaultValue={
                            (editingAgent ? getAgentType(editingAgent) : pendingAgentType) ?? ""
                          }
                          className="w-full rounded-md border border-border-strong bg-panel-raised px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                        >
                          <option value="">Non defini</option>
                          {AGENT_TYPE_OPTIONS.filter((o) => o.value !== "relance").map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-text-muted">
                          Objectif
                        </label>
                        <input
                          name="objectif"
                          defaultValue={editingAgent?.objectif ?? ""}
                          className="w-full rounded-md border border-border-strong bg-panel-raised px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                          placeholder="Ex: Prise de rendez-vous"
                        />
                      </div>
                    </>
                  )}

                  {isRelance ? (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-muted">
                        Message de relance
                      </label>
                      <p className="mb-2 text-xs text-text-dim">
                        Tu peux personnaliser ton message avec le prenom du prospect. Clique sur la variable pour l&apos;inserer — Kaizen la remplacera automatiquement au moment de l&apos;envoi.
                      </p>
                      <div className="mb-2 flex flex-wrap gap-1">
                        {IB_VARIABLES.map((v) => (
                          <button
                            key={v.label}
                            type="button"
                            onClick={() => insertRelanceVariable(v.label)}
                            title={v.desc}
                            className="rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent hover:bg-accent/20"
                          >
                            + {v.label}
                          </button>
                        ))}
                      </div>
                      <textarea
                        ref={relanceTextareaRef}
                        name="prompt_content"
                        value={relanceContent}
                        onChange={(e) => setRelanceContent(e.target.value)}
                        rows={4}
                        className="w-full resize-none rounded-md border border-border-strong bg-panel-raised px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                        placeholder="Bonjour {{first_name}}, je reviens vers toi..."
                      />
                    </div>
                  ) : canEditPrompt ? (
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-sm font-medium text-text-muted">
                          Prompt
                        </label>
                        <button
                          type="button"
                          onClick={() => setPromptFullscreen(true)}
                          title="Ouvrir en plein ecran"
                          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-text-dim hover:bg-panel-raised hover:text-foreground"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                          </svg>
                          Plein ecran
                        </button>
                      </div>
                      <textarea
                        name="prompt_content"
                        value={promptContent}
                        onChange={(e) => setPromptContent(e.target.value)}
                        rows={7}
                        className="w-full rounded-md border border-border-strong bg-panel-raised px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                        placeholder="Le prompt complet de l'agent..."
                      />
                    </div>
                  ) : (
                    <div className="rounded-md border border-border bg-panel-raised px-3 py-2.5">
                      <p className="text-xs text-text-muted">
                        Le moteur technique de cet agent est gere par l&apos;equipe Kaizen.
                      </p>
                    </div>
                  )}

                  {formError && (
                    <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                      {formError}
                    </p>
                  )}
                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="rounded-md border border-border-strong px-4 py-2 text-sm text-text-muted hover:bg-panel-raised hover:text-foreground"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-md border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
                    >
                      {isPending ? "Enregistrement..." : "Enregistrer"}
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal plein ecran edition du prompt */}
      {promptFullscreen && (
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-background"
          onClick={(e) => { if (e.target === e.currentTarget) setPromptFullscreen(false); }}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-3">
            <span className="text-sm font-medium text-text-muted">Prompt</span>
            <button
              type="button"
              onClick={() => setPromptFullscreen(false)}
              className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-muted hover:bg-panel-raised hover:text-foreground"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
                <line x1="10" y1="14" x2="21" y2="3"/><line x1="3" y1="21" x2="14" y2="10"/>
              </svg>
              Fermer
            </button>
          </div>
          <textarea
            value={promptContent}
            onChange={(e) => setPromptContent(e.target.value)}
            className="flex-1 resize-none bg-panel-raised px-6 py-4 font-mono text-sm text-foreground focus:outline-none"
            placeholder="Le prompt complet de l'agent..."
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

function RelanceCard({
  position,
  relance,
  canCreate,
}: {
  position: 1 | 2;
  relance: Relance | undefined;
  canCreate: boolean;
}) {
  const [content, setContent] = useState(relance?.content ?? "");
  const [delayDays, setDelayDays] = useState(relance?.delay_days ?? 3);
  const [isActive, setIsActive] = useState(relance?.is_active ?? true);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertVar(v: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = content.slice(0, start) + v + content.slice(end);
    setContent(next);
    setDirty(true);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + v.length, start + v.length);
    });
  }

  function handleSave() {
    if (!relance) return;
    setError(null);
    startTransition(async () => {
      const res = await updateRelance(relance.id, { content, delay_days: delayDays });
      if (res.error) setError(res.error);
      else setDirty(false);
    });
  }

  function handleToggle() {
    if (!relance) return;
    const next = !isActive;
    setIsActive(next);
    startTransition(async () => {
      const res = await updateRelance(relance.id, { is_active: next });
      if (res.error) {
        setIsActive(!next);
        setError(res.error);
      }
    });
  }

  function handleCreate() {
    startTransition(async () => {
      await createRelance();
    });
  }

  return (
    <div className="rounded-lg border border-warning/25 bg-warning/[0.04] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p className="text-sm font-semibold text-foreground">Relance {position}</p>
        </div>
        {relance && (
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            title={isActive ? "Désactiver" : "Activer"}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-40 ${
              isActive ? "bg-accent" : "bg-border-strong"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                isActive ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        )}
      </div>

      {!relance ? (
        <div className="flex flex-col items-center justify-center py-6">
          {canCreate ? (
            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending}
              className="rounded-md border border-dashed border-border-strong px-4 py-2 text-xs text-text-muted transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
            >
              {isPending ? "Création..." : "+ Configurer cette relance"}
            </button>
          ) : (
            <p className="text-xs text-text-dim">Configure d&apos;abord la Relance 1</p>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <div className="flex flex-wrap gap-1">
              {RELANCE_VARS.map((v) => (
                <button
                  key={v.label}
                  type="button"
                  onClick={() => insertVar(v.label)}
                  title={v.desc}
                  className="rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent hover:bg-accent/20"
                >
                  + {v.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowTemplates((v) => !v)}
              className="text-[10px] text-text-dim hover:text-text-muted"
            >
              {showTemplates ? "Masquer les modèles" : "Choisir un modèle"}
            </button>
          </div>
          {showTemplates && (
            <div className="rounded-md border border-border bg-panel-raised p-2 space-y-1">
              {RELANCE_TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setContent(tpl);
                    setDirty(true);
                    setShowTemplates(false);
                  }}
                  className="w-full rounded px-2 py-1.5 text-left text-[11px] text-text-muted hover:bg-panel hover:text-foreground transition-colors"
                >
                  {tpl}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => { setContent(e.target.value); setDirty(true); }}
            rows={3}
            placeholder="Bonjour {{first_name}}, je reviens vers toi..."
            className="w-full resize-none rounded-md border border-border-strong bg-panel-raised px-2.5 py-2 text-xs text-foreground placeholder:text-text-dim focus:border-accent/50 focus:outline-none"
          />
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>Envoyer après</span>
            <input
              type="number"
              min={1}
              max={60}
              value={delayDays}
              onChange={(e) => {
                setDelayDays(Math.max(1, parseInt(e.target.value) || 1));
                setDirty(true);
              }}
              className="w-12 rounded-md border border-border-strong bg-panel-raised px-2 py-1 text-center text-xs text-foreground focus:border-accent/50 focus:outline-none"
            />
            <span>jours sans réponse</span>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !dirty}
            className={`w-full rounded-md border py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
              dirty
                ? "border-warning/40 bg-warning/10 text-warning hover:bg-warning/20"
                : "border-border-strong text-text-muted"
            }`}
          >
            {isPending ? "Enregistrement..." : dirty ? "Enregistrer les modifications" : "Enregistrer"}
          </button>
        </div>
      )}
    </div>
  );
}

function TestStatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    untested:  { label: "Non testé",      cls: "bg-panel-raised text-text-dim" },
    testing:   { label: "Test en cours",  cls: "bg-accent/15 text-accent" },
    validated: { label: "Validé",         cls: "bg-positive/15 text-positive" },
    failed:    { label: "Échec",          cls: "bg-danger/15 text-danger" },
  };
  const s = map[status ?? "untested"] ?? map.untested;
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

function buildAgentSummary(agent: Agent): string | null {
  const kb = agent.knowledge_base as Record<string, unknown> | null;
  if (!kb) return null;
  const type = kb.agentType as string | undefined;
  if (!type) return null;
  const parts: string[] = [];
  if (type === "icebreaker") {
    const structure = kb.structureMessage as string | undefined;
    if (structure === "diagnostic") parts.push("Mode diagnostic");
    else if (structure === "proposition_directe") parts.push("Mode proposition directe");
    const sujet = kb.sujetLegitimite as string | undefined;
    if (sujet) parts.push(`Terrain : ${sujet}`);
    const tutoiement = kb.tutoiement as boolean | undefined;
    parts.push(tutoiement === false ? "Vouvoiement" : "Tutoiement");
  } else if (type === "conversation") {
    if (agent.objectif) parts.push(`Objectif : ${agent.objectif}`);
    const tutoiement = kb.tutoiement as boolean | undefined;
    parts.push(tutoiement === false ? "Vouvoiement" : "Tutoiement");
  } else if (type === "relance") {
    return "Message de relance automatique";
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function AgentCard({
  agent,
  assignedRoles,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
  onTest,
  isPending,
  canEditPrompt,
}: {
  agent: Agent;
  assignedRoles: string[];
  onEdit: (a: Agent) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string, name: string | null) => void;
  onTest: (a: Agent) => void;
  isPending: boolean;
  canEditPrompt: boolean;
}) {
  const typeIcon = AGENT_TYPE_ICON[getAgentType(agent) ?? ""] ?? null;
  const summary = buildAgentSummary(agent);
  const agentType = getAgentType(agent);
  const cardAccent =
    agentType === "icebreaker" ? "border-accent/25 bg-accent/[0.03]"
    : agentType === "conversation" ? "border-positive/25 bg-positive/[0.03]"
    : "border-border bg-panel";

  return (
    <li className={`rounded-lg border p-5 ${cardAccent}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {typeIcon && (
              <span className={typeIcon.iconColor} title={typeIcon.label}>
                {typeIcon.icon}
              </span>
            )}
            <h2 className="text-base font-medium text-foreground">
              {agent.name ?? "Sans nom"}
            </h2>
            <TestStatusBadge status={agent.test_status} />
            {assignedRoles.map((r) => (
              <span
                key={r}
                className="rounded border border-accent/30 bg-accent/10 px-2 py-0.5 font-display text-[10px] font-medium uppercase tracking-wider text-accent"
              >
                {r}
              </span>
            ))}
          </div>
          {agent.objectif && (
            <p className="mt-0.5 text-sm text-text-muted">{agent.objectif}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {getAgentType(agent) !== "relance" && (
            <button
              onClick={() => onTest(agent)}
              disabled={isPending || !agent.prompt_content}
              className="rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
            >
              Tester
            </button>
          )}
          <button
            onClick={() => onEdit(agent)}
            disabled={isPending}
            title="Modifier"
            aria-label="Modifier"
            className="rounded-md border border-border-strong p-1.5 text-text-muted transition-colors hover:bg-panel-raised hover:text-foreground disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDuplicate(agent.id)}
            disabled={isPending}
            title="Dupliquer"
            aria-label="Dupliquer"
            className="rounded-md border border-border-strong p-1.5 text-text-muted transition-colors hover:bg-panel-raised hover:text-foreground disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
          </button>
          <button
            onClick={() => onArchive(agent.id)}
            disabled={isPending}
            title="Archiver"
            aria-label="Archiver"
            className="rounded-md border border-border p-1.5 text-text-dim transition-colors hover:bg-panel-raised hover:text-text-muted disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(agent.id, agent.name)}
            disabled={isPending}
            title="Supprimer"
            aria-label="Supprimer"
            className="rounded-md border border-danger/30 p-1.5 text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      {canEditPrompt ? (
        agent.prompt_content && (
          <pre className="mt-3 max-h-28 overflow-hidden whitespace-pre-wrap rounded-md border border-border bg-panel-raised p-3 font-display text-xs text-text-muted [mask-image:linear-gradient(to_bottom,black_60%,transparent)]">
            {agent.prompt_content}
          </pre>
        )
      ) : (
        summary && (
          <p className="mt-2 text-xs text-text-dim">{summary}</p>
        )
      )}
    </li>
  );
}

