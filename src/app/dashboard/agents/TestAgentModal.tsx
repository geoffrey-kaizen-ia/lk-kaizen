"use client";

import { useState, useRef, useEffect } from "react";
import { testAgentReply } from "./actions";

type ChatMessage = {
  id: string;
  from: "agent" | "prospect";
  content: string;
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

    const historique = messages
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
    } else {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), from: "agent", content: result.reply! },
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
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.from === "agent" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    m.from === "agent"
                      ? "rounded-br-sm border border-accent/30 bg-accent/10 text-foreground"
                      : "rounded-bl-sm border border-border bg-panel-raised text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {m.content}
                  </p>
                </div>
              </div>
            ))}
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
