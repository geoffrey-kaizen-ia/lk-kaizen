"use client";

import { useState } from "react";
import { testFirstMessage, scrapeLinkedInProfile } from "./actions";

type ParsedReply = {
  message: string;
  accroche: string | null;
  profil_insuffisant: boolean;
} | null;

function parseReply(raw: string): ParsedReply {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(cleaned) as ParsedReply;
  } catch {
    return null;
  }
}

export default function TestFirstMessageModal({
  agent,
  agentTypeLabel,
  onClose,
}: {
  agent: { id: string; name: string | null; prompt_content: string | null };
  agentTypeLabel: string;
  onClose: () => void;
}) {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [headline, setHeadline] = useState("");
  const [about, setAbout] = useState("");

  const [rawReply, setRawReply] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedReply>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScrape() {
    if (!linkedinUrl.trim()) return;
    setScraping(true);
    setScrapeError(null);
    const result = await scrapeLinkedInProfile(linkedinUrl.trim());
    if (result.error) {
      setScrapeError(result.error);
    } else {
      if (result.firstName) setFirstName(result.firstName);
      if (result.headline) setHeadline(result.headline);
      if (result.about) setAbout(result.about);
    }
    setScraping(false);
  }

  async function handleGenerate() {
    if (!agent.prompt_content) {
      setError("Cet agent n'a pas de prompt configuré.");
      return;
    }
    if (!firstName.trim() && !headline.trim()) {
      setError("Renseigne au moins le prenom ou le headline du prospect.");
      return;
    }
    setError(null);
    setLoading(true);
    setRawReply(null);
    setParsed(null);

    const result = await testFirstMessage({
      promptContent: agent.prompt_content,
      firstName: firstName.trim(),
      headline: headline.trim(),
      about: about.trim(),
    });

    if (result.error || !result.reply) {
      setError(result.error ?? "Réponse vide");
    } else {
      setRawReply(result.reply);
      setParsed(parseReply(result.reply));
    }
    setLoading(false);
  }

  const inputClass =
    "w-full rounded-md border border-border-strong bg-panel-raised px-2.5 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none";
  const labelClass = "mb-1 block text-xs font-medium text-text-muted";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              Tester {agent.name ?? "l&apos;agent"}
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Agent {agentTypeLabel}. Simulation : rien n&apos;est envoyé.
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
          {/* Chargement depuis un vrai profil LinkedIn */}
          <div className="mb-4 rounded-md border border-border bg-panel-raised px-3 py-3">
            <p className="mb-2 text-xs font-medium text-text-muted">Charger un vrai profil</p>
            <div className="flex gap-2">
              <input
                value={linkedinUrl}
                onChange={(e) => {
                  setLinkedinUrl(e.target.value);
                  setScrapeError(null);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") handleScrape(); }}
                placeholder="https://linkedin.com/in/prenom-nom"
                className="flex-1 rounded-md border border-border-strong bg-panel px-2.5 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={handleScrape}
                disabled={scraping || !linkedinUrl.trim()}
                className="shrink-0 rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
              >
                {scraping ? "..." : "Charger"}
              </button>
            </div>
            {scrapeError && (
              <p className="mt-1.5 text-xs text-danger">{scrapeError}</p>
            )}
          </div>

          <p className="mb-3 text-sm text-text-muted">
            Ou renseigne le profil manuellement. Seul le prenom ou le headline est requis.
          </p>

          <div className="space-y-3">
            <div>
              <label className={labelClass}>Prenom</label>
              <input
                id="test-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex: Camille"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Headline / poste</label>
              <input
                id="test-headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Ex: Avocate en droit des affaires chez Dupont & Associes"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                À propos{" "}
                <span className="text-text-muted/60">(optionnel)</span>
              </label>
              <textarea
                id="test-about"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                rows={3}
                placeholder="Ex: J'accompagne les PME dans leurs contentieux contractuels depuis 10 ans..."
                className={inputClass}
              />
            </div>
          </div>

          <button
            type="button"
            id="test-generate-btn"
            onClick={handleGenerate}
            disabled={loading}
            className="mt-4 w-full rounded-md border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
          >
            {loading ? "Génération en cours..." : "Générer le message"}
          </button>

          {error && (
            <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {rawReply && (
            <div className="mt-4 space-y-2">
              {parsed ? (
                parsed.profil_insuffisant ? (
                  <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3">
                    <p className="text-sm font-medium text-warning">Profil insuffisant</p>
                    <p className="mt-1 text-xs text-text-muted">
                      Ajoute un headline ou un a-propos pour que l&apos;agent puisse construire une
                      accroche.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-medium text-text-muted">Message généré</p>
                    <div className="rounded-2xl rounded-bl-sm border border-border bg-panel-raised px-4 py-2.5">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {parsed.message}
                      </p>
                    </div>
                    {parsed.accroche && (
                      <p className="text-xs text-text-muted">
                        Accroche :{" "}
                        <span className="font-medium text-foreground">{parsed.accroche}</span>
                      </p>
                    )}
                  </>
                )
              ) : (
                // JSON invalide : afficher le brut directement comme message
                <>
                  <p className="text-xs font-medium text-text-muted">Message généré</p>
                  <div className="rounded-2xl rounded-bl-sm border border-border bg-panel-raised px-4 py-2.5">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {rawReply}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
