// Source de verite unique partagee entre SettingsClient et actions.
// Ajouter ici toute constante utilisee a la fois dans l'UI et la validation serveur.

export const DELAY_PRESETS = {
  rapide: { min: 5, max: 15 },
  normal: { min: 30, max: 45 },
  lent: { min: 60, max: 120 },
} as const;

export type DelayMode = keyof typeof DELAY_PRESETS;

export const DELAY_MODES = Object.keys(DELAY_PRESETS) as DelayMode[];

export function isDelayMode(value: unknown): value is DelayMode {
  return typeof value === "string" && value in DELAY_PRESETS;
}

// Plafonds socle LinkedIn (ne peuvent pas etre depasses par le client).
export const SOCLE_MAX_INVITE_LIMIT = 25;
export const SOCLE_MAX_MESSAGE_LIMIT = 40;

// Fuseaux proposes dans l'UI et autorises par la validation serveur.
export const ALLOWED_TIMEZONES = [
  "Europe/Paris",
  "Europe/London",
  "Europe/Lisbon",
  "America/New_York",
  "America/Los_Angeles",
] as const;
