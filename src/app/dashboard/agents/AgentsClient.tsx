"use client";

import { useState, useTransition, useRef } from "react";
import {
  createAgent,
  updateAgent,
  archiveAgent,
  deleteAgent,
  upsertAssignment,
  removeAssignment,
  toggleRoleEnabled,
  updateIcebreakerConfig,
  toggleIcebreakerEnabled,
} from "./actions";

const IB_VARIABLES = [
  { label: "{{first_name}}", desc: "Prenom" },
  { label: "{{last_name}}", desc: "Nom" },
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
};

type Assignment = {
  role: string;
  agent_id: string;
  is_enabled: boolean;
};

const ROLES = [
  {
    key: "icebreaker",
    label: "Icebreaker",
    longDesc:
      "Quand un prospect que tu as invite accepte ta demande de connexion, cet agent lui envoie automatiquement UN SEUL message pour briser la glace. Pas de conversation : juste un message d'ouverture, sans pitch ni lien.",
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
    key: "intent",
    label: "Invitation recue",
    longDesc:
      "Quand quelqu'un t'invite sur LinkedIn et que tu acceptes, cet agent lui envoie automatiquement UN SEUL message pour le remercier de la mise en relation et engager la conversation. Pas de conversation non plus : juste un message d'ouverture.",
    iconColor: "text-warning",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
] as const;

type RoleKey = (typeof ROLES)[number]["key"];

const FIRST_MESSAGE_ROLE_LABELS: Record<string, string> = {
  icebreaker: "Icebreaker",
  invitation_recue: "Invitation recue",
};

// Quel agentType peut etre assigne a quel role : evite de mixer un agent
// conversationnel avec un role "premier message" et inversement.
const ROLE_AGENT_TYPE: Record<RoleKey, string> = {
  icebreaker: "icebreaker",
  conversation: "conversation",
  intent: "invitation_recue",
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
    label: "Agent icebreaker (premier message)",
    iconColor: "text-accent",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    ),
  },
  invitation_recue: {
    label: "Agent invitation recue (premier message)",
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
  { value: "icebreaker", label: "Icebreaker (premier message)" },
  { value: "invitation_recue", label: "Invitation recue (premier message)" },
];

export default function AgentsClient({
  agents,
  assignments,
  allowedRoles,
  canEditPrompt,
  icebreakerMode,
  icebreakerTemplate,
  icebreakerEnabled,
}: {
  agents: Agent[];
  assignments: Assignment[];
  allowedRoles: string[];
  canEditPrompt: boolean;
  icebreakerMode: "ai" | "template";
  icebreakerTemplate: string;
  icebreakerEnabled: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
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

  const assignmentMap: Record<string, string> = Object.fromEntries(
    assignments.map((a) => [a.role, a.agent_id])
  );
  const enabledMap: Record<string, boolean> = Object.fromEntries(
    assignments.map((a) => [a.role, a.is_enabled])
  );

  function openCreate() {
    setEditingAgent(null);
    setFormError(null);
    setPendingAgentType(null);
    setWizardOpen(true);
  }

  function handleWizardCreate(data: {
    name: string;
    objectif: string;
    prompt_content: string;
    knowledge_base?: unknown;
  }) {
    if (data.name === "" && data.objectif === "" && data.prompt_content === "") {
      // Agent vierge : ouvrir le formulaire libre habituel, en conservant le type choisi
      const kb = data.knowledge_base as { agentType?: unknown } | undefined;
      const agentType = typeof kb?.agentType === "string" ? kb.agentType : null;
      setWizardOpen(false);
      setEditingAgent(null);
      setFormError(null);
      setPendingAgentType(agentType);
      setModalOpen(true);
      return;
    }

    const formData = new FormData();
    formData.set("name", data.name);
    formData.set("objectif", data.objectif);
    formData.set("prompt_content", data.prompt_content);
    if (data.knowledge_base) {
      formData.set("knowledge_base", JSON.stringify(data.knowledge_base));
    }

    startTransition(async () => {
      const result = await createAgent(formData);
      if (result.error) {
        setFormError(result.error);
      } else {
        setWizardOpen(false);
      }
    });
  }

  function openEdit(agent: Agent) {
    setEditingAgent(agent);
    setFormError(null);
    setPendingAgentType(null);
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
          Chaque agent joue un seul role a la fois. Les agents Icebreaker et Invitation recue
          envoient un seul message automatique (pas de discussion), l&apos;agent Conversation gere
          tous les echanges qui suivent.
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

      {/* Roles */}
      <section className="mb-8">
        <h2 className="mb-1 font-display text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          Roles actifs
        </h2>
        <p className="mb-4 text-sm text-text-muted">
          Choisit quel agent joue chaque role dans ta sequence de prospection.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {ROLES.map(({ key, label, iconColor, icon }) => {
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
                              <p className="mt-1.5 text-xs text-warning">Selectionne un agent pour que l&apos;Icebreaker fonctionne.</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Option Message fixe — s'ouvre en accordeon */}
                      <div className={`rounded-md border transition-colors ${templateActive ? "border-accent/30 bg-accent/5" : "border-border"}`}>
                        <button
                          type="button"
                          disabled={ibSaving}
                          onClick={() => templateActive ? handleIbDisable() : handleIbBlockActivate("template")}
                          className="flex w-full items-center gap-2.5 p-3 text-left"
                        >
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${templateActive ? "border-accent bg-accent" : "border-border-strong bg-panel-raised"}`}>
                            {templateActive && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                          <span className={`text-sm font-medium ${templateActive ? "text-foreground" : "text-text-muted"}`}>Message fixe</span>
                          {templateActive && (
                            <span className="ml-auto rounded bg-accent/10 px-1.5 py-0.5 font-display text-[9px] font-semibold uppercase tracking-wider text-accent">Actif</span>
                          )}
                        </button>

                        {/* Accordeon : uniquement si actif */}
                        {templateActive && (
                          <div className="border-t border-border/60 px-3 pb-3 pt-2.5 space-y-2.5">
                            <p className="text-xs text-text-muted">
                              Le meme message part a chaque prospect. Utilise les variables pour personnaliser automatiquement avec son prenom ou son nom.
                            </p>

                            {/* Explication des variables */}
                            <div className="rounded-md border border-border bg-panel-raised px-3 py-2 space-y-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">Variables de personnalisation</p>
                              <div className="flex items-start gap-2">
                                <code className="shrink-0 rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">{`{{first_name}}`}</code>
                                <p className="text-xs text-text-muted">Prenom du prospect tel qu&apos;il apparait sur LinkedIn. <span className="text-text-dim italic">Ex : Marie</span></p>
                              </div>
                              <div className="flex items-start gap-2">
                                <code className="shrink-0 rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">{`{{last_name}}`}</code>
                                <p className="text-xs text-text-muted">Nom de famille. <span className="text-text-dim italic">Ex : Dupont</span></p>
                              </div>
                              <p className="text-[10px] text-text-dim">Kaizen remplace ces variables par les vraies infos du prospect au moment de l&apos;envoi. Clique sur une variable pour l&apos;inserer dans ton message.</p>
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
                              placeholder="Bonjour {{first_name}}, ravi de te compter dans mon reseau !"
                              className="w-full resize-none rounded-md border border-border bg-panel px-2.5 py-2 text-xs text-foreground placeholder:text-text-dim outline-none focus:border-accent/50"
                            />

                            {ibError && <p className="text-xs text-danger">{ibError}</p>}
                            {ibSaved && !ibError && <p className="text-xs text-positive">Message enregistre.</p>}

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
                    <p className="text-xs text-text-dim">Non inclus dans votre forfait actuel.</p>
                  )}
                </div>
              );
            }

            // Conversation + Intent : comportement original
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
                ) : (
                  <p className="text-xs text-text-dim">Non inclus dans votre forfait actuel.</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Agents list header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
          Mes agents
        </h1>
        <button
          onClick={openCreate}
          className="rounded-md border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
        >
          Nouvel agent
        </button>
      </div>

      {/* Active agents */}
      {activeAgents.length === 0 && (
        <p className="text-sm text-text-muted">
          Aucun agent actif. Cree ton premier agent.
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
              onArchive={handleArchive}
              onDelete={handleDelete}
              onTest={setTestingAgent}
              isPending={isPending}
            />
          );
        })}
      </ul>

      {/* Archived agents */}
      {archivedAgents.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer font-display text-xs uppercase tracking-widest text-text-muted hover:text-foreground">
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
            testingAssignedRoles.find((r) => r === "Icebreaker" || r === "Invitation recue") ||
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setWizardOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-panel p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold uppercase tracking-widest text-foreground">
                Nouvel agent
              </h2>
              <button
                onClick={() => setWizardOpen(false)}
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
              onCancel={() => setWizardOpen(false)}
              onCreate={handleWizardCreate}
              isPending={isPending}
              canEditPrompt={canEditPrompt}
            />
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-lg border border-border bg-panel p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold uppercase tracking-widest text-foreground">
                {editingAgent ? "Modifier l'agent" : "Nouvel agent"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-text-muted hover:text-foreground"
                aria-label="Fermer"
              >
                &#x2715;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {editingAgent && (
                <input type="hidden" name="id" value={editingAgent.id} />
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-muted">
                  Nom <span className="text-danger">*</span>
                </label>
                <input
                  name="name"
                  required
                  defaultValue={editingAgent?.name ?? ""}
                  className="w-full rounded-md border border-border-strong bg-panel-raised px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                  placeholder="Ex: Agent Icebreaker SaaS"
                />
              </div>
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
                  {AGENT_TYPE_OPTIONS.map((opt) => (
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
              {canEditPrompt ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-muted">
                    Prompt
                  </label>
                  <textarea
                    name="prompt_content"
                    defaultValue={editingAgent?.prompt_content ?? ""}
                    rows={7}
                    className="w-full rounded-md border border-border-strong bg-panel-raised px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                    placeholder="Le prompt complet de l'agent..."
                  />
                </div>
              ) : (
                <div className="rounded-md border border-border bg-panel-raised px-3 py-2.5">
                  <p className="text-xs text-text-dim">
                    Le prompt est genere automatiquement par le wizard de creation.
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
          </div>
        </div>
      )}
    </div>
  );
}

function AgentCard({
  agent,
  assignedRoles,
  onEdit,
  onArchive,
  onDelete,
  onTest,
  isPending,
}: {
  agent: Agent;
  assignedRoles: string[];
  onEdit: (a: Agent) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string, name: string | null) => void;
  onTest: (a: Agent) => void;
  isPending: boolean;
}) {
  const typeIcon = AGENT_TYPE_ICON[getAgentType(agent) ?? ""] ?? null;

  return (
    <li className="rounded-lg border border-border bg-panel p-5">
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
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => onTest(agent)}
            disabled={isPending || !agent.prompt_content}
            className="rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
          >
            Tester
          </button>
          <button
            onClick={() => onEdit(agent)}
            disabled={isPending}
            className="rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-muted hover:bg-panel-raised hover:text-foreground disabled:opacity-50"
          >
            Modifier
          </button>
          <button
            onClick={() => onArchive(agent.id)}
            disabled={isPending}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text-dim hover:bg-panel-raised hover:text-text-muted disabled:opacity-50"
          >
            Archiver
          </button>
          <button
            onClick={() => onDelete(agent.id, agent.name)}
            disabled={isPending}
            className="rounded-md border border-danger/30 px-3 py-1.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
          >
            Supprimer
          </button>
        </div>
      </div>
      {agent.prompt_content && (
        <pre className="mt-3 max-h-28 overflow-hidden whitespace-pre-wrap rounded-md border border-border bg-panel-raised p-3 font-display text-xs text-text-muted [mask-image:linear-gradient(to_bottom,black_60%,transparent)]">
          {agent.prompt_content}
        </pre>
      )}
    </li>
  );
}
