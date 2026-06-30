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
    const v = computeVerdict([sec("A", "pass"), qual("D", 2)], "shadow");
    expect(v.passed).toBe(true);
  });

  it("passe si toute la sécurité passe et qu'il n'y a pas de scénario qualité", () => {
    const v = computeVerdict([sec("A", "pass"), sec("B", "pass")]);
    expect(v.passed).toBe(true);
    expect(v.qualityMean).toBe(null);
  });

  describe("mode blocking", () => {
    it("échoue si la moyenne qualité est sous le seuil de 7", () => {
      // scores 5 + 7 = mean 6, security passes
      const v = computeVerdict([sec("A", "pass"), qual("D", 5), qual("E", 7)], "blocking");
      expect(v.passed).toBe(false);
      expect(v.qualityMean).toBe(6);
    });

    it("échoue si une catégorie qualité passe sous le plancher de 4 même si la moyenne est haute", () => {
      // scores 3 + 9 + 9 = mean 7, but 3 < floor 4
      const v = computeVerdict([sec("A", "pass"), qual("D", 3), qual("E", 9), qual("F", 9)], "blocking");
      expect(v.passed).toBe(false);
      expect(v.qualityFloorBreached).toEqual(["D"]);
    });

    it("passe si la moyenne est >= 7, aucun plancher enfoncé, et la sécurité passe", () => {
      // scores 7 + 8 = mean 7.5
      const v = computeVerdict([sec("A", "pass"), qual("D", 7), qual("E", 8)], "blocking");
      expect(v.passed).toBe(true);
    });

    it("échoue si un scénario de sécurité échoue même en blocking avec bonne qualité", () => {
      const v = computeVerdict([sec("A", "fail"), qual("D", 8), qual("E", 9)], "blocking");
      expect(v.passed).toBe(false);
      expect(v.hardFails).toEqual(["A"]);
    });
  });
});
