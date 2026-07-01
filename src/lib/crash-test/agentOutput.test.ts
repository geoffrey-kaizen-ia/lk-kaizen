import { describe, it, expect } from "vitest";
import { parseAgentOutput } from "./agentOutput";

describe("parseAgentOutput", () => {
  it("parse un JSON propre et normalise les champs", () => {
    const raw = JSON.stringify({
      message: "Salut",
      etat: "continuer",
      raison_handover: null,
      enjeu_detecte: "curiosite",
      cta_propose: false,
    });
    expect(parseAgentOutput(raw)).toEqual({
      message: "Salut",
      etat: "continuer",
      raison_handover: null,
      enjeu_detecte: "curiosite",
      cta_propose: false,
    });
  });

  it("retire un preambule et des balises de code avant le JSON", () => {
    const raw =
      'Voici ma reponse:\n```json\n{"message":"","etat":"rendre_la_main","raison_handover":"agacement","enjeu_detecte":null,"cta_propose":false}\n```';
    const out = parseAgentOutput(raw);
    expect(out?.etat).toBe("rendre_la_main");
    expect(out?.raison_handover).toBe("agacement");
  });

  it('traite la chaine "null" du modele comme un vrai null', () => {
    const raw =
      '{"message":"ok","etat":"continuer","raison_handover":"null","enjeu_detecte":"null","cta_propose":false}';
    const out = parseAgentOutput(raw);
    expect(out?.raison_handover).toBe(null);
    expect(out?.enjeu_detecte).toBe(null);
  });

  it("renvoie null si le JSON est invalide", () => {
    expect(parseAgentOutput("pas du json du tout")).toBe(null);
  });

  it("renvoie null si l'etat est absent ou hors enum", () => {
    expect(parseAgentOutput('{"message":"x","cta_propose":false}')).toBe(null);
    expect(parseAgentOutput('{"message":"x","etat":"bidon","cta_propose":false}')).toBe(null);
  });

  it("ramene une raison_handover inconnue a null sans rejeter la sortie", () => {
    const raw =
      '{"message":"x","etat":"continuer","raison_handover":"inconnue","enjeu_detecte":null,"cta_propose":false}';
    const out = parseAgentOutput(raw);
    expect(out?.raison_handover).toBe(null);
  });

  it("force cta_propose a un booleen strict", () => {
    const raw =
      '{"message":"x","etat":"continuer","raison_handover":null,"enjeu_detecte":null,"cta_propose":"true"}';
    expect(parseAgentOutput(raw)?.cta_propose).toBe(false);
  });
});
