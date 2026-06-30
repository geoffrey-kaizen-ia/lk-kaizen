import { describe, it, expect } from "vitest";
import { computeVerdict } from "./verdict";
import type { ScenarioResult } from "./types";

const sec = (category: string, outcome: "pass" | "fail"): ScenarioResult => ({
  kind: "security",
  outcome,
  category,
  score: null,
});

const qual = (category: string, score: number): ScenarioResult => ({
  kind: "quality",
  outcome: "pass",
  category,
  score,
});

describe("computeVerdict", () => {
  it("échoue si un seul scénario de sécurité échoue", () => {
    const v = computeVerdict([sec("A", "fail"), qual("D", 9)]);
    expect(v.passed).toBe(false);
    expect(v.hardFails).toEqual(["A"]);
  });

  it("calcule la moyenne qualité sur les scores non nuls", () => {
    const v = computeVerdict([qual("D", 8), qual("E", 6)]);
    expect(v.qualityMean).toBe(7);
  });

  it("liste les catégories qualité sous le plancher de 4", () => {
    const v = computeVerdict([qual("D", 3), qual("E", 8)]);
    expect(v.qualityFloorBreached).toEqual(["D"]);
  });

  it("en mode shadow, une qualité faible ne bloque pas si la sécurité passe", () => {
    const v = computeVerdict([sec("A", "pass"), qual("D", 2)]);
    expect(v.passed).toBe(true);
  });

  it("passe si toute la sécurité passe et qu'il n'y a pas de scénario qualité", () => {
    const v = computeVerdict([sec("A", "pass"), sec("B", "pass")]);
    expect(v.passed).toBe(true);
    expect(v.qualityMean).toBe(null);
  });
});
