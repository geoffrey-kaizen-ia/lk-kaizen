"use client";

import { useState } from "react";
import { testFirstMessage } from "./actions";

export default function TestFirstMessageModal({
  agent,
  agentTypeLabel,
  onClose,
}: {
  agent: { id: string; name: string | null; prompt_content: string | null };
  agentTypeLabel: string;
  onClose: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [headline, setHeadline] = useState("");
  const [profileSummary, setProfileSummary] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!agent.prompt_content) {
      setError("Cet agent n'a pas de prompt configure.");
      return;
    }
    setError(null);
    setLoading(true);
    setReply(null);

    const result = await testFirstMessage({
      promptContent: agent.prompt_content,
      firstName,
      headline,
      profileSummary,
    });

    if (result.error || !result.reply) {
      setError(result.error ?? "Reponse vide");
    } else {
      setReply(result.reply);
    }
    setLoading(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold uppercase tracking-widest text-foreground">
              Tester {agent.name ?? "l'agent"}
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Agent {agentTypeLabel} : il envoie un seul message automatique, pas de discussion.
              Simulation : rien n&apos;est enregistre, vos vrais prospects ne sont pas affectes.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-foreground"
            aria-label="Fermer"
          >
            &#x2715;
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <p className="mb-3 text-sm text-text-muted">
            Decris le profil du prospect simule. L&apos;agent va generer le message qu&apos;il lui
            enverrait dans ces conditions.
          </p>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Prenom</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex: Camille"
                className="w-full rounded-md border border-border-strong bg-panel-raised px-2.5 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Headline / poste
              </label>
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Ex: Avocate en droit des affaires chez Dupont & Associes"
                className="w-full rounded-md border border-border-strong bg-panel-raised px-2.5 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Resume du profil
              </label>
              <textarea
                value={profileSummary}
                onChange={(e) => setProfileSummary(e.target.value)}
                rows={5}
                placeholder={`Ex:\nNom: Camille Martin\nPoste: Avocate en droit des affaires\nEntreprise: Dupont & Associes\nLocalisation: Lyon\n\nPublications recentes:\n- A partage un article sur la mediation en entreprise`}
                className="w-full rounded-md border border-border-strong bg-panel-raised px-2.5 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="mt-4 w-full rounded-md border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
          >
            {loading ? "Generation..." : "Generer le message"}
          </button>

          {error && (
            <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {reply && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-medium text-text-muted">Message genere</p>
              <div className="rounded-2xl rounded-bl-sm border border-border bg-panel-raised px-4 py-2.5">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {reply}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
