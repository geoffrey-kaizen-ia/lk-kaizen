"use client";

import { useState, useTransition } from "react";
import { updateCadenceSettings, updateDailyReport } from "./actions";
import {
  DELAY_PRESETS,
  DELAY_MODES,
  isDelayMode,
  ALLOWED_TIMEZONES,
  SOCLE_MAX_INVITE_LIMIT,
  SOCLE_MAX_MESSAGE_LIMIT,
  type DelayMode,
} from "./delayPresets";
import RangeSlider from "./RangeSlider";

const DELAY_LABELS: Record<DelayMode, { label: string; desc: string }> = {
  rapide: {
    label: "Rapide",
    desc: "À réserver aux comptes bien établis.",
  },
  normal: {
    label: "Normal",
    desc: "Délai humanisé standard, recommandé pour la plupart des comptes.",
  },
  lent: {
    label: "Lent",
    desc: "Réponses plus espacées, recommandé pour les comptes récents ou en rodage.",
  },
};

// Jours ISO 1=lundi .. 7=dimanche
const DAYS = [
  { value: 1, label: "L" },
  { value: 2, label: "M" },
  { value: 3, label: "M" },
  { value: 4, label: "J" },
  { value: 5, label: "V" },
  { value: 6, label: "S" },
  { value: 7, label: "D" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function SettingsClient({
  dailyInviteLimit,
  dailyMessageLimit,
  responseDelayMode,
  activeHoursStart,
  activeHoursEnd,
  activeDays,
  timezone,
  dailyReport,
}: {
  dailyInviteLimit: number;
  dailyMessageLimit: number;
  responseDelayMode: string;
  activeHoursStart: number;
  activeHoursEnd: number;
  activeDays: number[];
  timezone: string;
  dailyReport: boolean;
}) {
  const [inviteLimit, setInviteLimit] = useState(Math.min(dailyInviteLimit, SOCLE_MAX_INVITE_LIMIT));
  const [messageLimit, setMessageLimit] = useState(Math.min(dailyMessageLimit, SOCLE_MAX_MESSAGE_LIMIT));
  const [delayMode, setDelayMode] = useState<DelayMode>(
    isDelayMode(responseDelayMode) ? responseDelayMode : "normal"
  );
  const [hoursStart, setHoursStart] = useState(activeHoursStart);
  const [hoursEnd, setHoursEnd] = useState(activeHoursEnd);
  const [days, setDays] = useState<number[]>(activeDays);
  const [tz, setTz] = useState(timezone);

  const [reportEnabled, setReportEnabled] = useState(dailyReport);
  const [reportError, setReportError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const [reportPending, startReportTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const preset = DELAY_PRESETS[delayMode];

  function toggleDay(value: number) {
    setDays((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    );
  }

  function handleToggleReport() {
    const next = !reportEnabled;
    setReportEnabled(next);
    setReportError(null);
    startReportTransition(async () => {
      const res = await updateDailyReport(next);
      if (res.error) {
        setReportEnabled(!next);
        setReportError(res.error);
      }
    });
  }

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
    <>
    <form action={handleSubmit} className="space-y-6">
      {/* Cadence */}
      <section className="rounded-md border border-border bg-panel p-5">
        <h2 className="font-display text-sm font-semibold text-text-muted">
          Cadence quotidienne
        </h2>
        <p className="mt-1 text-xs text-text-dim">
          Plafonds journaliers pour protéger ton compte LinkedIn. Tu peux baisser ces
          valeurs, jamais dépasser le plafond socle.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <RangeSlider
            label="Invitations envoyées / jour"
            name="daily_invite_limit"
            value={inviteLimit}
            min={1}
            max={SOCLE_MAX_INVITE_LIMIT}
            onChange={setInviteLimit}
            valueSuffix="/ jour"
            hint={`Plafond socle : ${SOCLE_MAX_INVITE_LIMIT} / jour`}
          />
          <RangeSlider
            label="Messages de conversation / jour"
            name="daily_message_limit"
            value={messageLimit}
            min={1}
            max={SOCLE_MAX_MESSAGE_LIMIT}
            onChange={setMessageLimit}
            valueSuffix="/ jour"
            hint={`Plafond socle : ${SOCLE_MAX_MESSAGE_LIMIT} / jour`}
          />
        </div>
      </section>

      {/* Delai de reponse */}
      <section className="rounded-md border border-border bg-panel p-5">
        <h2 className="font-display text-sm font-semibold text-text-muted">
          Délai de réponse
        </h2>
        <p className="mt-1 text-xs text-text-dim">
          Temps d&apos;attente avant l&apos;envoi automatique d&apos;une réponse, pour
          rester crédible.
        </p>

        <div className="mt-4 space-y-2">
          {DELAY_MODES.map((mode) => (
            <label
              key={mode}
              className={`flex cursor-pointer items-start justify-between gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                delayMode === mode
                  ? "border-accent/30 bg-accent/10"
                  : "border-border bg-panel-raised hover:border-border-strong"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="response_delay_mode"
                  value={mode}
                  checked={delayMode === mode}
                  onChange={() => setDelayMode(mode)}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium text-foreground">
                    {DELAY_LABELS[mode].label}
                  </span>
                  <p className="text-xs text-text-dim">{DELAY_LABELS[mode].desc}</p>
                </div>
              </div>
              <span className="shrink-0 whitespace-nowrap text-xs font-medium text-accent">
                {DELAY_PRESETS[mode].min}-{DELAY_PRESETS[mode].max} min
              </span>
            </label>
          ))}
        </div>

        <p className="mt-3 text-xs text-text-muted">
          Réponses envoyées entre{" "}
          <span className="font-medium text-foreground">{preset.min}</span> et{" "}
          <span className="font-medium text-foreground">{preset.max}</span> minutes après
          le message du prospect.
        </p>
      </section>

      {/* Creneaux de reponse */}
      <section className="rounded-md border border-border bg-panel p-5">
        <h2 className="font-display text-sm font-semibold text-text-muted">
          Créneaux de réponse
        </h2>
        <p className="mt-1 text-xs text-text-dim">
          Plage horaire et jours pendant lesquels l&apos;IA répond. Hors de ces créneaux,
          les réponses sont mises en file et envoyées au prochain créneau ouvert (pas de
          réponse le week-end si non coché).
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              Heure de début
            </label>
            <select
              name="active_hours_start"
              value={hoursStart}
              onChange={(e) => setHoursStart(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-panel-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}h
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              Heure de fin
            </label>
            <select
              name="active_hours_end"
              value={hoursEnd}
              onChange={(e) => setHoursEnd(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-panel-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}h
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              Fuseau horaire
            </label>
            <select
              name="timezone"
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              className="w-full rounded-md border border-border bg-panel-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
            >
              {ALLOWED_TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <span className="mb-1.5 block text-xs font-medium text-text-muted">
            Jours actifs
          </span>
          <div className="flex gap-2">
            {DAYS.map((day) => {
              const active = days.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium transition-colors ${
                    active
                      ? "border-accent/30 bg-accent/10 text-accent"
                      : "border-border bg-panel-raised text-text-dim hover:border-border-strong"
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          {/* Champs caches pour transmettre les jours selectionnes dans le FormData */}
          {days.map((d) => (
            <input key={d} type="hidden" name="active_days" value={d} />
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && !error && <p className="text-sm text-positive">Réglages enregistrés.</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
      >
        {isPending ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>

    <section className="mt-8 space-y-4 border-t border-border pt-8">
      <h2 className="font-display text-xs font-semibold text-text-dim">
        Notifications
      </h2>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-panel p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Rapport quotidien par e-mail</p>
          <p className="mt-0.5 text-xs text-text-muted">
            Reçois chaque matin un résumé de l&apos;activité LinkedIn de la veille.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={reportEnabled}
          onClick={handleToggleReport}
          disabled={reportPending}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-40 ${
            reportEnabled ? "bg-accent" : "bg-border-strong"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
              reportEnabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      {reportError && (
        <p className="text-xs text-danger">{reportError}</p>
      )}
    </section>
    </>
  );
}
