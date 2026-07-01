import { describe, it, expect } from "vitest";
import { checkSecret } from "./apiAuth";

describe("checkSecret", () => {
  it("accepte un secret identique", () => {
    expect(checkSecret("abc123", "abc123")).toBe(true);
  });

  it("refuse un secret different de meme longueur", () => {
    expect(checkSecret("abc123", "abc999")).toBe(false);
  });

  it("refuse si les longueurs different", () => {
    expect(checkSecret("abc", "abc123")).toBe(false);
  });

  it("refuse un secret fourni vide ou absent", () => {
    expect(checkSecret(null, "abc123")).toBe(false);
    expect(checkSecret("", "abc123")).toBe(false);
  });

  it("refuse si le secret serveur n'est pas configure", () => {
    expect(checkSecret("abc123", undefined)).toBe(false);
    expect(checkSecret("abc123", "")).toBe(false);
  });
});
