// Contrat de sortie de l'agent de conversation (methode B).
// Source : docs/meta-prompt-conversation-geoffrey.md, cable dans promptTemplate.ts.

export type Etat =
  | "continuer"
  | "proposer_cta"
  | "rendre_la_main"
  | "parker"
  | "clore";

export type RaisonHandover =
  | "demande_humain"
  | "agacement"
  | "mise_en_cause_ia"
  | "hors_scope"
  | "coordonner_cta"
  | "doute";

export type AgentOutput = {
  message: string;
  etat: Etat;
  raison_handover: RaisonHandover | null;
  enjeu_detecte: string | null;
  cta_propose: boolean;
};

const ETATS: readonly Etat[] = [
  "continuer",
  "proposer_cta",
  "rendre_la_main",
  "parker",
  "clore",
];

const RAISONS: readonly RaisonHandover[] = [
  "demande_humain",
  "agacement",
  "mise_en_cause_ia",
  "hors_scope",
  "coordonner_cta",
  "doute",
];

// Isole l'objet JSON dans un texte qui peut porter un preambule ou des
// balises de code, comme le fait parfois le modele malgre la consigne.
function isolateJson(raw: string): string {
  const noFence = raw.replace(/```json/gi, "").replace(/```/g, "");
  const start = noFence.indexOf("{");
  const end = noFence.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return noFence.trim();
  return noFence.slice(start, end + 1);
}

// Traite les null textuels ("null") comme de vrais null.
function normalizeNullable(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value === "null" || value.trim() === "") return null;
  return value;
}

export function parseAgentOutput(raw: string): AgentOutput | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(isolateJson(raw));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const o = parsed as Record<string, unknown>;

  const etat = o.etat;
  if (typeof etat !== "string" || !ETATS.includes(etat as Etat)) return null;

  const rawRaison = normalizeNullable(o.raison_handover);
  const raison_handover =
    rawRaison !== null && RAISONS.includes(rawRaison as RaisonHandover)
      ? (rawRaison as RaisonHandover)
      : null;

  return {
    message: typeof o.message === "string" ? o.message : "",
    etat: etat as Etat,
    raison_handover,
    enjeu_detecte: normalizeNullable(o.enjeu_detecte),
    cta_propose: o.cta_propose === true,
  };
}
