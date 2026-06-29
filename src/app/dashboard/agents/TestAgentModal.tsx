"use client";

import { useState, useRef, useEffect } from "react";
import { testAgentReply } from "./actions";

type AgentEtat =
  | "continuer"
  | "proposer_cta"
  | "rendre_la_main"
  | "parker"
  | "clore";

type ParsedReply = {
  message: string;
  etat: AgentEtat | null;
  raison_handover: string | null;
  enjeu_detecte: string | null;
  cta_propose: boolean;
};

// Parsing defensif de la sortie JSON Mode B : strip d'un eventuel preambule ou
// d'une balise de code, puis JSON.parse. Renvoie null si le JSON est illisible
// (on retombe alors sur l'affichage du texte brut).
function parseReply(raw: string): ParsedReply | null {
  let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  // Si le modele a ajoute du texte autour, on isole le premier objet JSON.
  if (!cleaned.startsWith("{")) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
  }
  try {
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    if (typeof obj.message !== "string") return null;
    return {
      message: obj.message,
      etat: (obj.etat as AgentEtat) ?? null,
      raison_handover:
        typeof obj.raison_handover === "string" && obj.raison_handover !== "null"
          ? obj.raison_handover
          : null,
      enjeu_detecte:
        typeof obj.enjeu_detecte === "string" && obj.enjeu_detecte !== "null"
          ? obj.enjeu_detecte
          : null,
      cta_propose: obj.cta_propose === true,
    };
  } catch {
    return null;
  }
}

const ETAT_LABELS: Record<AgentEtat, string> = {
  continuer: "Continue",
  proposer_cta: "Propose l'invitation",
  rendre_la_main: "Passe la main",
  parker: "Met en pause",
  clore: "Clot la conversation",
};

const RAISON_LABELS: Record<string, string> = {
  demande_humain: "le prospect demande un humain",
  agacement: "agacement du prospect",
  mise_en_cause_ia: "le prospect met en cause l'IA",
  hors_scope: "question hors de portee",
  coordonner_cta: "accord obtenu, a coordonner",
  doute: "cas douteux",
};

type ChatMessage = {
  id: string;
  from: "agent" | "prospect" | "system";
  content: string;
  etat?: AgentEtat | null;
  raison?: string | null;
  enjeu?: string | null;
  ctaProposed?: boolean;
};

export default function TestAgentModal({
  agent,
  onClose,
}: {
  agent: { id: string; name: string | null; prompt_content: string | null };
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entreprise, setEntreprise] = useState("");
  const [poste, setPoste] = useState("");
  const [resume, setResume] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    if (!agent.prompt_content) {
      setError("Cet agent n'a pas de prompt configure.");
      return;
    }

    setError(null);
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      from: "prospect",
      content: text,
    };

    // L'historique n'inclut que les vrais messages echanges (le prospect et les
    // messages reellement envoyes par l'agent), jamais les notes systeme.
    const historique = messages
      .filter((m) => m.from === "agent" || m.from === "prospect")
      .map((m) => `${m.from === "agent" ? "Vous" : "Prospect"}: ${m.content}`)
      .join("\n");
    const nombreEchanges = messages.filter((m) => m.from === "agent").length;

    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setLoading(true);

    const result = await testAgentReply({
      promptContent: agent.prompt_content,
      historique,
      dernierMessage: text,
      nombreEchanges,
      entreprise,
      poste,
      resume,
    });

    if (result.error || !result.reply) {
      setError(result.error ?? "Reponse vide");
      setLoading(false);
      return;
    }

    const parsed = parseReply(result.reply);

    if (!parsed) {
      // JSON illisible : on affiche le brut comme un message agent (filet de securite).
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), from: "agent", content: result.reply! },
      ]);
      setLoading(false);
      return;
    }

    const hasMessage = parsed.message.trim().length > 0;

    if (hasMessage) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          from: "agent",
          content: parsed.message.trim(),
          etat: parsed.etat,
          raison: parsed.raison_handover,
          enjeu: parsed.enjeu_detecte,
          ctaProposed: parsed.cta_propose,
        },
      ]);
    } else {
      // Message vide : handover silencieux ou cloture, rien ne part au prospect.
      const raison = parsed.raison_handover
        ? RAISON_LABELS[parsed.raison_handover] ?? parsed.raison_handover
        : null;
      const note =
        parsed.etat === "clore"
          ? "L'agent clot la conversation, aucun message envoye."
          : `L'agent passe la main en silence, aucun message envoye${raison ? ` (${raison})` : ""}. ${agent.name ?? "Tu"} reprends l'echange.`;
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          from: "system",
          content: note,
          etat: parsed.etat,
          enjeu: parsed.enjeu_detecte,
        },
      ]);
    }
    setLoading(false);
  }

  function handleReset() {
    setMessages([]);
    setError(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold uppercase tracking-widest text-foreground">
              Tester {agent.name ?? "l'agent"}
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Simulation : rien n&apos;est enregistre, vos vrais prospects ne
              sont pas affectes.
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

        {/* Profil prospect simule */}
        <details className="border-b border-border px-5 py-3">
          <summary className="cursor-pointer font-display text-xs uppercase tracking-widest text-text-muted hover:text-foreground">
            Profil du prospect simule (optionnel)
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Entreprise
              </label>
              <input
                value={entreprise}
                onChange={(e) => setEntreprise(e.target.value)}
                placeholder="Ex: Acme SaaS"
                className="w-full rounded-md border border-border-strong bg-panel-raised px-2.5 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Poste
              </label>
              <input
                value={poste}
                onChange={(e) => setPoste(e.target.value)}
                placeholder="Ex: Directeur commercial"
                className="w-full rounded-md border border-border-strong bg-panel-raised px-2.5 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Resume
              </label>
              <input
                value={resume}
                onChange={(e) => setResume(e.target.value)}
                placeholder="Ex: 10 ans d'experience en gestion d'equipe"
                className="w-full rounded-md border border-border-strong bg-panel-raised px-2.5 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        </details>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-text-muted">
              Ecris un message comme si tu etais le prospect, l&apos;agent te
              repondra avec son prompt actuel.
            </p>
          )}
          <div className="space-y-2">
            {messages.map((m) =>
              m.from === "system" ? (
                <div key={m.id} className="flex justify-center">
                  <div className="max-w-[85%] rounded-md border border-border bg-panel-raised px-3 py-2 text-center">
                    <p className="text-xs italic text-text-muted">{m.content}</p>
                    {m.enjeu && (
                      <p className="mt-1 text-[11px] text-text-dim">
                        Enjeu lu : {m.enjeu}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  key={m.id}
                  className={`flex ${m.from === "agent" ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[75%]">
                    <div
                      className={`rounded-2xl px-4 py-2.5 ${
                        m.from === "agent"
                          ? "rounded-br-sm border border-accent/30 bg-accent/10 text-foreground"
                          : "rounded-bl-sm border border-border bg-panel-raised text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {m.content}
                      </p>
                    </div>
                    {m.from === "agent" && m.etat && (
                      <div className="mt-1 flex flex-wrap items-center justify-end gap-1.5">
                        <span className="rounded border border-border-strong bg-panel px-1.5 py-0.5 font-display text-[9px] font-medium uppercase tracking-wider text-text-muted">
                          {ETAT_LABELS[m.etat] ?? m.etat}
                        </span>
                        {m.ctaProposed && (
                          <span className="rounded border border-positive/30 bg-positive/10 px-1.5 py-0.5 font-display text-[9px] font-medium uppercase tracking-wider text-positive">
                            CTA
                          </span>
                        )}
                        {m.raison && (
                          <span className="text-[10px] text-text-dim">
                            {RAISON_LABELS[m.raison] ?? m.raison}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
            {loading && (
              <div className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl rounded-br-sm border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-text-muted">
                  ...
                </div>
              </div>
            )}
          </div>
          <div ref={bottomRef} />
        </div>

        {error && (
          <p className="border-t border-danger/30 bg-danger/10 px-5 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {/* Input */}
        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={messages.length === 0 || loading}
            className="shrink-0 rounded-md border border-border-strong px-3 py-2 text-xs text-text-muted hover:bg-panel-raised hover:text-foreground disabled:opacity-50"
          >
            Reinitialiser
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message du prospect simule..."
            disabled={loading}
            className="flex-1 rounded-md border border-border-strong bg-panel-raised px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-md border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
