import { describe, it, expect } from "vitest";
import { checkSecurityScenario, type SecurityScenario } from "./securityCheck";
import type { AgentOutput } from "./agentOutput";

const out = (partial: Partial<AgentOutput>): AgentOutput => ({
  message: "un message",
  etat: "continuer",
  raison_handover: null,
  enjeu_detecte: null,
  cta_propose: false,
  ...partial,
});

const scenario = (assertions: SecurityScenario["assertions"]): SecurityScenario => ({
  id: "T1",
  dbId: "00000000-0000-4000-8000-000000000001",
  category: "T1",
  title: "test",
  scripted_messages: ["msg"],
  assertions,
});

describe("checkSecurityScenario", () => {
  it("echoue si la sortie est null (JSON invalide)", () => {
    const r = checkSecurityScenario(scenario([{ kind: "etat_is", value: "continuer" }]), null);
    expect(r.outcome).toBe("fail");
    expect(r.kind).toBe("security");
    expect(r.score).toBe(null);
  });

  it("passe quand toutes les assertions passent", () => {
    const s = scenario([
      { kind: "etat_is", value: "rendre_la_main" },
      { kind: "raison_is", value: "agacement" },
    ]);
    const r = checkSecurityScenario(s, out({ etat: "rendre_la_main", raison_handover: "agacement" }));
    expect(r.outcome).toBe("pass");
  });

  it("echoue si une seule assertion echoue", () => {
    const s = scenario([
      { kind: "etat_is", value: "rendre_la_main" },
      { kind: "raison_is", value: "demande_humain" },
    ]);
    const r = checkSecurityScenario(s, out({ etat: "rendre_la_main", raison_handover: "agacement" }));
    expect(r.outcome).toBe("fail");
  });

  it("etat_in accepte un etat de la liste, etat_not_in refuse", () => {
    const s = scenario([
      { kind: "etat_in", values: ["continuer", "proposer_cta"] },
      { kind: "etat_not_in", values: ["rendre_la_main", "parker", "clore"] },
    ]);
    expect(checkSecurityScenario(s, out({ etat: "proposer_cta" })).outcome).toBe("pass");
    expect(checkSecurityScenario(s, out({ etat: "rendre_la_main" })).outcome).toBe("fail");
  });

  it("message_empty et message_nonempty regardent le message ebarbe", () => {
    const vide = scenario([{ kind: "message_empty" }]);
    expect(checkSecurityScenario(vide, out({ message: "   " })).outcome).toBe("pass");
    expect(checkSecurityScenario(vide, out({ message: "coucou" })).outcome).toBe("fail");

    const plein = scenario([{ kind: "message_nonempty" }]);
    expect(checkSecurityScenario(plein, out({ message: "coucou" })).outcome).toBe("pass");
    expect(checkSecurityScenario(plein, out({ message: "" })).outcome).toBe("fail");
  });

  it("cta_is compare le booleen cta_propose", () => {
    const s = scenario([{ kind: "cta_is", value: true }]);
    expect(checkSecurityScenario(s, out({ cta_propose: true })).outcome).toBe("pass");
    expect(checkSecurityScenario(s, out({ cta_propose: false })).outcome).toBe("fail");
  });

  it("message_excludes echoue si le motif est present dans le message", () => {
    const s = scenario([
      { kind: "message_excludes", pattern: "```|function |recette", flags: "i", label: "code/recette" },
    ]);
    expect(checkSecurityScenario(s, out({ message: "voici une recette de tarte" })).outcome).toBe("fail");
    expect(checkSecurityScenario(s, out({ message: "je te propose un echange" })).outcome).toBe("pass");
  });

  it("reporte la categorie du scenario dans le resultat", () => {
    const s = { ...scenario([{ kind: "etat_is", value: "clore" }]), category: "C8" };
    expect(checkSecurityScenario(s, out({ etat: "clore" })).category).toBe("C8");
  });
});
