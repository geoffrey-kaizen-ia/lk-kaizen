"use client";

import { useState, useEffect } from "react";
import {
  buildPromptContent,
  EMPTY_FORM,
  type AgentFormData,
  type ObjectionItem,
  type FaqItem,
} from "./promptTemplate";
import {
  buildFirstMessagePromptContent,
  EMPTY_FIRST_MESSAGE_FORM,
  FIRST_MESSAGE_OBJECTIF,
  type FirstMessageAgentType,
  type FirstMessageFormData,
} from "./firstMessageTemplate";

type Step = "type" | "choice" | "form" | "generating" | "preview" | "fm_form" | "fm_generating" | "fm_preview";

const GENERATING_STEPS = [
  "Analyse de tes reponses...",
  "Compilation de la strategie commerciale...",
  "Redaction du prompt...",
];

const STEPS = [
  { key: 1, label: "Identite" },
  { key: 2, label: "Offre & cible" },
  { key: 3, label: "Preuves & objections" },
  { key: 4, label: "Style & voix" },
  { key: 5, label: "Qualification" },
] as const;

type StringListKey = "qualificationCriteria" | "disqualificationCriteria" | "styleExamples" | "proofPoints" | "neverSay";

export default function AgentWizard({
  onCancel,
  onCreate,
  isPending,
  canEditPrompt = false,
}: {
  onCancel: () => void;
  onCreate: (data: {
    name: string;
    objectif: string;
    prompt_content: string;
    knowledge_base: unknown;
  }) => void;
  isPending: boolean;
  canEditPrompt?: boolean;
}) {
  const [step, setStep] = useState<Step>("type");
  const [agentType, setAgentType] = useState<"conversation" | FirstMessageAgentType | null>(null);
  const [formStep, setFormStep] = useState(1);
  const [form, setForm] = useState<AgentFormData>(EMPTY_FORM);
  const [agentName, setAgentName] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [generatingStepIndex, setGeneratingStepIndex] = useState(0);

  // Formulaire court "premier message" (icebreaker / invitation recue)
  const [fmForm, setFmForm] = useState<FirstMessageFormData>(EMPTY_FIRST_MESSAGE_FORM);
  const [fmAgentName, setFmAgentName] = useState("");
  const [fmGeneratedPrompt, setFmGeneratedPrompt] = useState("");
  const [fmGeneratingStepIndex, setFmGeneratingStepIndex] = useState(0);

  function handleGenerate() {
    setStep("generating");
  }

  function updateFmField<K extends keyof FirstMessageFormData>(key: K, value: FirstMessageFormData[K]) {
    setFmForm((prev) => ({ ...prev, [key]: value }));
  }

  function addFmStyleExample() {
    setFmForm((prev) => ({ ...prev, styleExamples: [...prev.styleExamples, ""] }));
  }
  function updateFmStyleExample(index: number, value: string) {
    setFmForm((prev) => {
      const list = [...prev.styleExamples];
      list[index] = value;
      return { ...prev, styleExamples: list };
    });
  }
  function removeFmStyleExample(index: number) {
    setFmForm((prev) => ({ ...prev, styleExamples: prev.styleExamples.filter((_, i) => i !== index) }));
  }

  const fmFormValid =
    fmForm.userName.trim() && fmForm.businessName.trim() && fmForm.businessDescription.trim();

  useEffect(() => {
    if (step !== "generating") return;

    setGeneratingStepIndex(0);
    const stepInterval = setInterval(() => {
      setGeneratingStepIndex((i) => Math.min(i + 1, GENERATING_STEPS.length - 1));
    }, 800);
    const timeout = setTimeout(() => {
      setGeneratedPrompt(buildPromptContent(form));
      setStep("preview");
    }, 2400);

    return () => {
      clearInterval(stepInterval);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (step !== "fm_generating") return;

    setFmGeneratingStepIndex(0);
    const stepInterval = setInterval(() => {
      setFmGeneratingStepIndex((i) => Math.min(i + 1, GENERATING_STEPS.length - 1));
    }, 800);
    const timeout = setTimeout(() => {
      if (agentType === "icebreaker" || agentType === "invitation_recue") {
        setFmGeneratedPrompt(buildFirstMessagePromptContent(fmForm, agentType));
      }
      setStep("fm_preview");
    }, 2400);

    return () => {
      clearInterval(stepInterval);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function updateField<K extends keyof AgentFormData>(key: K, value: AgentFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateListItem(key: StringListKey, index: number, value: string) {
    setForm((prev) => {
      const list = [...prev[key]];
      list[index] = value;
      return { ...prev, [key]: list };
    });
  }

  function addListItem(key: StringListKey) {
    setForm((prev) => ({ ...prev, [key]: [...prev[key], ""] }));
  }

  function removeListItem(key: StringListKey, index: number) {
    setForm((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  }

  // Objections (paires objection/reponse)
  function addObjection() {
    setForm((prev) => ({ ...prev, objections: [...prev.objections, { objection: "", reponse: "" }] }));
  }
  function updateObjection(index: number, field: keyof ObjectionItem, value: string) {
    setForm((prev) => {
      const list = [...prev.objections];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, objections: list };
    });
  }
  function removeObjection(index: number) {
    setForm((prev) => ({ ...prev, objections: prev.objections.filter((_, i) => i !== index) }));
  }

  // FAQ (paires question/reponse)
  function addFaq() {
    setForm((prev) => ({ ...prev, faq: [...prev.faq, { question: "", reponse: "" }] }));
  }
  function updateFaq(index: number, field: keyof FaqItem, value: string) {
    setForm((prev) => {
      const list = [...prev.faq];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, faq: list };
    });
  }
  function removeFaq(index: number) {
    setForm((prev) => ({ ...prev, faq: prev.faq.filter((_, i) => i !== index) }));
  }

  // Validation par etape (seuls les champs cles bloquent)
  const step1Valid =
    form.userName.trim() &&
    form.businessName.trim() &&
    form.businessDescription.trim() &&
    form.objectifDescription.trim() &&
    form.objectifUrl.trim();
  const step2Valid = form.offerDescription.trim() && form.idealClient.trim();
  const step3Valid = form.objections.some((o) => o.objection.trim());

  function canGoNext(): boolean {
    if (formStep === 1) return Boolean(step1Valid);
    if (formStep === 2) return Boolean(step2Valid);
    if (formStep === 3) return Boolean(step3Valid);
    return true;
  }

  // --- ECRAN TYPE D'AGENT ---
  if (step === "type") {
    return (
      <div>
        <p className="mb-4 text-sm text-text-muted">
          Quel type d&apos;agent veux-tu creer ?
        </p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setAgentType("conversation");
              setStep("choice");
            }}
            className="w-full rounded-lg border border-positive/30 bg-positive/10 p-4 text-left transition-colors hover:border-positive/50"
          >
            <p className="text-sm font-semibold text-foreground">Agent conversationnel</p>
            <p className="mt-0.5 text-xs text-text-muted">
              Repond aux messages de tes prospects pendant toute la discussion : il relance, repond aux questions, qualifie et amene vers ton objectif. C&apos;est l&apos;agent du role &quot;Conversation&quot;.
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setAgentType("icebreaker");
              setFmForm(EMPTY_FIRST_MESSAGE_FORM);
              setFmAgentName("");
              setStep("fm_form");
            }}
            className="w-full rounded-lg border border-accent/30 bg-accent/10 p-4 text-left transition-colors hover:border-accent/50"
          >
            <p className="text-sm font-semibold text-foreground">
              Agent icebreaker <span className="font-normal text-text-muted">(premier message)</span>
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              Envoie automatiquement UN SEUL message dès qu&apos;un prospect accepte une invitation que tu lui as envoyee. C&apos;est l&apos;agent du role &quot;Icebreaker&quot;.
            </p>
          </button>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border-strong px-4 py-2 text-sm text-text-muted hover:bg-panel-raised hover:text-foreground"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  // --- ECRAN CHOIX (agent conversationnel) ---
  if (step === "choice") {
    return (
      <div>
        <p className="mb-4 text-sm text-text-muted">
          Choisis comment tu veux creer ton nouvel agent conversationnel.
        </p>
        <button
          type="button"
          onClick={() => {
            setStep("form");
            setFormStep(1);
          }}
          className="w-full rounded-lg border border-accent/30 bg-accent/10 p-4 text-left transition-colors hover:border-accent/50"
        >
          <p className="text-sm font-semibold text-foreground">Formulaire guide (recommande)</p>
          <p className="mt-0.5 text-xs text-text-muted">
            On te pose des questions etape par etape pour rassembler le maximum d&apos;infos sur ton offre, ta cible et tes objections. Plus tu remplis, meilleur sera ton agent. Tu pourras relire le prompt avant de creer l&apos;agent.
          </p>
        </button>
        <div className="mt-5 flex items-center justify-between">
          {canEditPrompt && (
            <button
              type="button"
              onClick={() =>
                onCreate({
                  name: "",
                  objectif: "",
                  prompt_content: "",
                  knowledge_base: { ...EMPTY_FORM, agentType: "conversation" },
                })
              }
              className="text-xs text-text-dim underline-offset-2 hover:text-text-muted hover:underline"
            >
              Ou creer un agent vierge (avance)
            </button>
          )}
          {!canEditPrompt && <span />}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("type")}
              className="rounded-md border border-border-strong px-4 py-2 text-sm text-text-muted hover:bg-panel-raised hover:text-foreground"
            >
              Retour
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border-strong px-4 py-2 text-sm text-text-muted hover:bg-panel-raised hover:text-foreground"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- ECRAN GENERATION ---
  if (step === "generating") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        <p className="font-display text-sm text-text-muted">
          {GENERATING_STEPS[generatingStepIndex]}
        </p>
      </div>
    );
  }

  // --- ECRAN FORMULAIRE COURT "PREMIER MESSAGE" (icebreaker / invitation recue) ---
  if (step === "fm_form" && (agentType === "icebreaker" || agentType === "invitation_recue")) {
    const typeLabel = agentType === "icebreaker" ? "Icebreaker" : "Invitation recue";
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-foreground">
          Agent &quot;premier message&quot; ({typeLabel}) : il envoie automatiquement UN SEUL message, pas une conversation. Le formulaire est donc plus court.
        </div>
        <Field
          label="Ton nom (celui affiche sur ton profil LinkedIn)"
          required
          value={fmForm.userName}
          onChange={(v) => updateFmField("userName", v)}
          placeholder="Ex: Jean Dupont"
        />
        <Field
          label="Nom de ton business"
          required
          value={fmForm.businessName}
          onChange={(v) => updateFmField("businessName", v)}
          placeholder="Ex: nom de ton entreprise"
        />
        <TextAreaField
          label="Description de ton activite"
          required
          value={fmForm.businessDescription}
          onChange={(v) => updateFmField("businessDescription", v)}
          placeholder="Explique ton activite en quelques lignes : ce que tu fais, depuis quand, pour qui. Ce contexte ne sera mentionne que si c'est tres naturel : le premier message ne doit pas vendre quoi que ce soit."
          rows={4}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-muted">Ton de l&apos;agent</label>
            <select
              value={fmForm.tutoiement ? "tu" : "vous"}
              onChange={(e) => updateFmField("tutoiement", e.target.value === "tu")}
              className="w-full rounded-md border border-border-strong bg-panel-raised px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            >
              <option value="tu">Tutoiement</option>
              <option value="vous">Vouvoiement</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-muted">Style de message</label>
            <select
              value={fmForm.styleDecontracte ? "decontracte" : "formel"}
              onChange={(e) => updateFmField("styleDecontracte", e.target.value === "decontracte")}
              className="w-full rounded-md border border-border-strong bg-panel-raised px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            >
              <option value="decontracte">Decontracte</option>
              <option value="formel">Formel</option>
            </select>
          </div>
        </div>
        <ListField
          label="Exemples de ta facon de t'exprimer (optionnel)"
          helper="Quelques phrases types pour que l'IA reprenne ton style."
          items={fmForm.styleExamples}
          onAdd={addFmStyleExample}
          onChange={updateFmStyleExample}
          onRemove={removeFmStyleExample}
          placeholder="Ex: ah ok ca marche"
        />
        <TextAreaField
          label="Instructions supplementaires (optionnel)"
          value={fmForm.additionalInstructions}
          onChange={(v) => updateFmField("additionalInstructions", v)}
          placeholder="Regles ou contexte que l'IA doit absolument connaitre pour ce premier message."
          rows={3}
        />

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setStep("type")}
            className="rounded-md border border-border-strong px-4 py-2 text-sm text-text-muted hover:bg-panel-raised hover:text-foreground"
          >
            Retour
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border-strong px-4 py-2 text-sm text-text-muted hover:bg-panel-raised hover:text-foreground"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={!fmFormValid}
              onClick={() => setStep("fm_generating")}
              className="rounded-md border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
            >
              Generer le prompt
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- ECRAN GENERATION "PREMIER MESSAGE" ---
  if (step === "fm_generating") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        <p className="font-display text-sm text-text-muted">
          {GENERATING_STEPS[fmGeneratingStepIndex]}
        </p>
      </div>
    );
  }

  // --- ECRAN PREVIEW "PREMIER MESSAGE" ---
  if (step === "fm_preview" && (agentType === "icebreaker" || agentType === "invitation_recue")) {
    return (
      <div>
        <p className="mb-3 text-sm text-text-muted">
          Voici le prompt genere a partir de tes reponses. Relis-le et ajuste-le si besoin avant de creer l&apos;agent.
        </p>
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-text-muted">
            Nom de l&apos;agent <span className="text-danger">*</span>
          </label>
          <input
            value={fmAgentName}
            onChange={(e) => setFmAgentName(e.target.value)}
            required
            className="w-full rounded-md border border-border-strong bg-panel-raised px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            placeholder={agentType === "icebreaker" ? "Ex: Icebreaker principal" : "Ex: Remerciement invitation recue"}
          />
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-text-muted">Prompt genere</label>
          <textarea
            value={fmGeneratedPrompt}
            onChange={(e) => setFmGeneratedPrompt(e.target.value)}
            rows={16}
            className="w-full rounded-md border border-border-strong bg-panel-raised px-3 py-2 font-display text-xs text-foreground focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep("fm_form")}
            className="rounded-md border border-border-strong px-4 py-2 text-sm text-text-muted hover:bg-panel-raised hover:text-foreground"
          >
            Retour au formulaire
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border-strong px-4 py-2 text-sm text-text-muted hover:bg-panel-raised hover:text-foreground"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={isPending || !fmAgentName.trim()}
              onClick={() =>
                onCreate({
                  name: fmAgentName.trim(),
                  objectif: FIRST_MESSAGE_OBJECTIF[agentType],
                  prompt_content: fmGeneratedPrompt,
                  knowledge_base: { ...fmForm, agentType },
                })
              }
              className="rounded-md border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
            >
              {isPending ? "Creation..." : "Creer l'agent"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- ECRAN PREVIEW ---
  if (step === "preview") {
    return (
      <div>
        <p className="mb-3 text-sm text-text-muted">
          Voici le prompt genere a partir de tes reponses. Relis-le et ajuste-le si besoin avant de creer l&apos;agent.
        </p>
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-text-muted">
            Nom de l&apos;agent <span className="text-danger">*</span>
          </label>
          <input
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            required
            className="w-full rounded-md border border-border-strong bg-panel-raised px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            placeholder="Ex: Setter LinkedIn principal"
          />
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-text-muted">Prompt genere</label>
          <textarea
            value={generatedPrompt}
            onChange={(e) => setGeneratedPrompt(e.target.value)}
            rows={16}
            className="w-full rounded-md border border-border-strong bg-panel-raised px-3 py-2 font-display text-xs text-foreground focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep("form")}
            className="rounded-md border border-border-strong px-4 py-2 text-sm text-text-muted hover:bg-panel-raised hover:text-foreground"
          >
            Retour au formulaire
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border-strong px-4 py-2 text-sm text-text-muted hover:bg-panel-raised hover:text-foreground"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={isPending || !agentName.trim()}
              onClick={() =>
                onCreate({
                  name: agentName.trim(),
                  objectif: form.objectifDescription.trim(),
                  prompt_content: generatedPrompt,
                  knowledge_base: { ...form, agentType: "conversation" },
                })
              }
              className="rounded-md border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
            >
              {isPending ? "Creation..." : "Creer l'agent"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- ECRAN FORMULAIRE (multi-etapes) ---
  return (
    <div className="space-y-5">
      {/* Barre de progression */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((s) => (
          <div key={s.key} className="flex-1">
            <button
              type="button"
              onClick={() => setFormStep(s.key)}
              className={`h-1.5 w-full rounded-full transition-colors ${
                s.key <= formStep ? "bg-accent" : "bg-border"
              }`}
              aria-label={s.label}
            />
            <span
              className={`mt-1 block text-[10px] ${
                s.key === formStep ? "font-semibold text-accent" : "text-text-dim"
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Etape 1 - Identite */}
      {formStep === 1 && (
        <div className="space-y-4">
          <Field
            label="Ton nom (celui affiche sur ton profil LinkedIn)"
            required
            value={form.userName}
            onChange={(v) => updateField("userName", v)}
            placeholder="Ex: Jean Dupont"
          />
          <Field
            label="Nom de ton business"
            required
            value={form.businessName}
            onChange={(v) => updateField("businessName", v)}
            placeholder="Ex: nom de ton entreprise"
          />
          <TextAreaField
            label="Description de ton activite"
            required
            value={form.businessDescription}
            onChange={(v) => updateField("businessDescription", v)}
            placeholder="Explique ton activite en quelques lignes : ce que tu fais, depuis quand, pour qui."
            rows={4}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Description de l'objectif"
              required
              value={form.objectifDescription}
              onChange={(v) => updateField("objectifDescription", v)}
              placeholder='Ex: "Prendre un rdv"'
            />
            <Field
              label="URL de l'objectif"
              required
              value={form.objectifUrl}
              onChange={(v) => updateField("objectifUrl", v)}
              placeholder="Ex: lien Calendly"
            />
          </div>
        </div>
      )}

      {/* Etape 2 - Offre & cible */}
      {formStep === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-text-dim">
            Ces infos sont le carburant de ton agent. Plus elles sont precises, plus les reponses seront pertinentes.
          </p>
          <TextAreaField
            label="Offre principale"
            required
            value={form.offerDescription}
            onChange={(v) => updateField("offerDescription", v)}
            placeholder="Decris precisement ce que tu vends : le produit/service, ce qu'il inclut, comment ca marche."
            rows={4}
          />
          <TextAreaField
            label="Probleme que tu resous"
            value={form.problemSolved}
            onChange={(v) => updateField("problemSolved", v)}
            placeholder="Quel probleme concret ton offre resout pour le client ?"
            rows={3}
          />
          <TextAreaField
            label="Client ideal (ICP)"
            required
            value={form.idealClient}
            onChange={(v) => updateField("idealClient", v)}
            placeholder="Decris ton client type : secteur, taille d'entreprise, poste, situation, ce qui le caracterise."
            rows={3}
          />
          <TextAreaField
            label="Positionnement tarifaire (optionnel)"
            value={form.pricePositioning}
            onChange={(v) => updateField("pricePositioning", v)}
            placeholder="Ex: offre premium, entree de gamme... (les prix ne seront jamais devoiles en conversation)"
            rows={2}
          />
        </div>
      )}

      {/* Etape 3 - Preuves & objections */}
      {formStep === 3 && (
        <div className="space-y-4">
          <ListField
            label="Preuves & resultats (optionnel)"
            helper="Resultats clients, chiffres, references. Cree de la confiance dans la conversation."
            items={form.proofPoints}
            onAdd={() => addListItem("proofPoints")}
            onChange={(i, v) => updateListItem("proofPoints", i, v)}
            onRemove={(i) => removeListItem("proofPoints", i)}
            placeholder="Ex: +30 clients accompagnes en 2025"
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-text-muted">
              Objections frequentes <span className="text-danger">*</span>
            </label>
            <p className="mb-2 text-xs text-text-muted">
              Les objections que tes prospects soulevent souvent, et comment y repondre. Au moins une est requise.
            </p>
            <div className="space-y-3">
              {form.objections.map((item, i) => (
                <div key={i} className="rounded-md border border-border bg-panel-raised p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-text-dim">Objection {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeObjection(i)}
                      className="text-text-dim hover:text-danger"
                      aria-label="Supprimer"
                    >
                      &#x2715;
                    </button>
                  </div>
                  <input
                    value={item.objection}
                    onChange={(e) => updateObjection(i, "objection", e.target.value)}
                    className="mb-2 w-full rounded-md border border-border-strong bg-panel px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                    placeholder={`Objection. Ex: "C'est trop cher"`}
                  />
                  <textarea
                    value={item.reponse}
                    onChange={(e) => updateObjection(i, "reponse", e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-border-strong bg-panel px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                    placeholder="Ta reponse a cette objection."
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addObjection}
              className="mt-2 text-xs font-medium text-accent hover:text-accent/80"
            >
              + Ajouter une objection
            </button>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-muted">FAQ (optionnel)</label>
            <p className="mb-2 text-xs text-text-muted">
              Questions que les prospects posent souvent, avec ta reponse.
            </p>
            <div className="space-y-3">
              {form.faq.map((item, i) => (
                <div key={i} className="rounded-md border border-border bg-panel-raised p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-text-dim">Question {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeFaq(i)}
                      className="text-text-dim hover:text-danger"
                      aria-label="Supprimer"
                    >
                      &#x2715;
                    </button>
                  </div>
                  <input
                    value={item.question}
                    onChange={(e) => updateFaq(i, "question", e.target.value)}
                    className="mb-2 w-full rounded-md border border-border-strong bg-panel px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                    placeholder="La question du prospect."
                  />
                  <textarea
                    value={item.reponse}
                    onChange={(e) => updateFaq(i, "reponse", e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-border-strong bg-panel px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                    placeholder="Ta reponse."
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addFaq}
              className="mt-2 text-xs font-medium text-accent hover:text-accent/80"
            >
              + Ajouter une question
            </button>
          </div>
        </div>
      )}

      {/* Etape 4 - Style & voix */}
      {formStep === 4 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-muted">Ton de l&apos;agent</label>
              <select
                value={form.tutoiement ? "tu" : "vous"}
                onChange={(e) => updateField("tutoiement", e.target.value === "tu")}
                className="w-full rounded-md border border-border-strong bg-panel-raised px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              >
                <option value="tu">Tutoiement</option>
                <option value="vous">Vouvoiement</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-muted">Style de conversation</label>
              <select
                value={form.styleDecontracte ? "decontracte" : "formel"}
                onChange={(e) => updateField("styleDecontracte", e.target.value === "decontracte")}
                className="w-full rounded-md border border-border-strong bg-panel-raised px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              >
                <option value="decontracte">Decontracte (ex: &quot;t&apos;as ?&quot;)</option>
                <option value="formel">Formel (ex: &quot;as-tu ?&quot;)</option>
              </select>
            </div>
          </div>
          <ListField
            label="Exemples de ta facon de t'exprimer (optionnel)"
            helper="Quelques phrases types pour que l'IA reprenne ton style."
            items={form.styleExamples}
            onAdd={() => addListItem("styleExamples")}
            onChange={(i, v) => updateListItem("styleExamples", i, v)}
            onRemove={(i) => removeListItem("styleExamples", i)}
            placeholder="Ex: ah ok ca marche"
          />
        </div>
      )}

      {/* Etape 5 - Qualification & garde-fous */}
      {formStep === 5 && (
        <div className="space-y-4">
          <ListField
            label="Criteres de qualification"
            helper="Ce que le prospect doit valider pour etre qualifie."
            items={form.qualificationCriteria}
            onAdd={() => addListItem("qualificationCriteria")}
            onChange={(i, v) => updateListItem("qualificationCriteria", i, v)}
            onRemove={(i) => removeListItem("qualificationCriteria", i)}
            placeholder="Ex: Travaille deja dans la vente"
          />
          <ListField
            label="Criteres de disqualification"
            helper="Si le prospect correspond a l'un de ces points, on arrete poliment."
            items={form.disqualificationCriteria}
            onAdd={() => addListItem("disqualificationCriteria")}
            onChange={(i, v) => updateListItem("disqualificationCriteria", i, v)}
            onRemove={(i) => removeListItem("disqualificationCriteria", i)}
            placeholder="Ex: Etudiant sans activite"
          />
          <ListField
            label="A ne jamais dire ni promettre (optionnel)"
            helper="Garde-fous : choses que l'agent ne doit jamais affirmer ou promettre."
            items={form.neverSay}
            onAdd={() => addListItem("neverSay")}
            onChange={(i, v) => updateListItem("neverSay", i, v)}
            onRemove={(i) => removeListItem("neverSay", i)}
            placeholder="Ex: ne jamais promettre un resultat garanti"
          />
          <TextAreaField
            label="Instructions supplementaires (optionnel)"
            value={form.additionalInstructions}
            onChange={(v) => updateField("additionalInstructions", v)}
            placeholder="Regles ou contexte que l'IA doit absolument connaitre."
            rows={3}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => (formStep === 1 ? setStep("choice") : setFormStep(formStep - 1))}
          className="rounded-md border border-border-strong px-4 py-2 text-sm text-text-muted hover:bg-panel-raised hover:text-foreground"
        >
          {formStep === 1 ? "Retour" : "Precedent"}
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border-strong px-4 py-2 text-sm text-text-muted hover:bg-panel-raised hover:text-foreground"
          >
            Annuler
          </button>
          {formStep < 5 ? (
            <button
              type="button"
              disabled={!canGoNext()}
              onClick={() => setFormStep(formStep + 1)}
              className="rounded-md border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
            >
              Suivant
            </button>
          ) : (
            <button
              type="button"
              disabled={!step1Valid || !step2Valid || !step3Valid}
              onClick={handleGenerate}
              className="rounded-md border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
            >
              Generer le prompt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-muted">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border-strong bg-panel-raised px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        placeholder={placeholder}
      />
    </div>
  );
}

function TextAreaField({
  label,
  required,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-muted">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded-md border border-border-strong bg-panel-raised px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        placeholder={placeholder}
      />
    </div>
  );
}

function ListField({
  label,
  helper,
  items,
  onAdd,
  onChange,
  onRemove,
  placeholder,
}: {
  label: string;
  helper: string;
  items: string[];
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-muted">{label}</label>
      <p className="mb-2 text-xs text-text-muted">{helper}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item}
              onChange={(e) => onChange(i, e.target.value)}
              className="w-full rounded-md border border-border-strong bg-panel-raised px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="shrink-0 rounded-md border border-border px-2.5 text-sm text-text-dim hover:bg-panel-raised hover:text-text-muted"
              aria-label="Supprimer"
            >
              &#x2715;
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 text-xs font-medium text-accent hover:text-accent/80"
      >
        + Ajouter
      </button>
    </div>
  );
}
