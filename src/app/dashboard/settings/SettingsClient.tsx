"use client";

import { useState, useTransition } from "react";
import { updateCadenceSettings } from "./actions";

const SOCLE_MAX_INVITE_LIMIT = 25;
const SOCLE_MAX_MESSAGE_LIMIT = 40;

const DELAY_OPTIONS = [
  {
    value: "rapide",
    label: "Rapide",
    desc: "Reponses dans les premieres minutes. A reserver aux comptes bien etablis.",
  },
  {
    value: "normal",
    label: "Normal",
    desc: "Delai humanise standard, recommande pour la plupart des comptes.",
  },
  {
    value: "lent",
    label: "Lent",
    desc: "Reponses plus espacees, recommande pour les comptes recents ou en warm-up.",
  },
];

export default function SettingsClient({
  dailyInviteLimit,
  dailyMessageLimit,
  responseDelayMode,
}: {
  dailyInviteLimit: number;
  dailyMessageLimit: number;
  responseDelayMode: string;
}) {
  const [inviteLimit, setInviteLimit] = useState(dailyInviteLimit);
  const [messageLimit, setMessageLimit] = useState(dailyMessageLimit);
  const [delayMode, setDelayMode] = useState(responseDelayMode);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(formData: FormData) {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await updateCadenceSettings(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* Cadence */}
      <section className="rounded-md border border-border bg-panel p-5">
        <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-text-muted">
          Cadence quotidienne
        </h2>
        <p className="mt-1 text-xs text-text-dim">
          Plafonds journaliers pour proteger ton compte LinkedIn. Tu peux baisser ces
          valeurs, jamais depasser le plafond socle.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              Invitations acceptees / jour
            </label>
            <input
              type="number"
              name="daily_invite_limit"
              min={1}
              max={SOCLE_MAX_INVITE_LIMIT}
              value={inviteLimit}
              onChange={(e) => setInviteLimit(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-panel-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
            />
            <p className="mt-1 text-[10px] text-text-dim">
              Plafond socle : {SOCLE_MAX_INVITE_LIMIT} / jour
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              Messages de conversation / jour
            </label>
            <input
              type="number"
              name="daily_message_limit"
              min={1}
              max={SOCLE_MAX_MESSAGE_LIMIT}
              value={messageLimit}
              onChange={(e) => setMessageLimit(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-panel-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
            />
            <p className="mt-1 text-[10px] text-text-dim">
              Plafond socle : {SOCLE_MAX_MESSAGE_LIMIT} / jour
            </p>
          </div>
        </div>
      </section>

      {/* Delai de reponse */}
      <section className="rounded-md border border-border bg-panel p-5">
        <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-text-muted">
          Delai de reponse
        </h2>
        <p className="mt-1 text-xs text-text-dim">
          Temps d&apos;attente avant l&apos;envoi automatique d&apos;une reponse, pour
          rester credible.
        </p>

        <div className="mt-4 space-y-2">
          {DELAY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                delayMode === opt.value
                  ? "border-accent/30 bg-accent/10"
                  : "border-border bg-panel-raised hover:border-border-strong"
              }`}
            >
              <input
                type="radio"
                name="response_delay_mode"
                value={opt.value}
                checked={delayMode === opt.value}
                onChange={() => setDelayMode(opt.value)}
                className="mt-0.5"
              />
              <div>
                <span className="text-sm font-medium text-foreground">{opt.label}</span>
                <p className="text-xs text-text-dim">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}
      {saved && !error && (
        <p className="text-sm text-positive">Reglages enregistres.</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
      >
        {isPending ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}
