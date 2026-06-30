import { describe, it, expect } from "vitest";
import { canAssign } from "./gate";

describe("canAssign", () => {
  it("autorise un agent validé", () => {
    expect(canAssign("validated")).toBe(true);
  });

  it("refuse un agent non testé, en cours ou échoué", () => {
    expect(canAssign("untested")).toBe(false);
    expect(canAssign("testing")).toBe(false);
    expect(canAssign("failed")).toBe(false);
  });
});
