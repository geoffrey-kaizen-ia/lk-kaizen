import { describe, it, expect } from "vitest";
import { createAnthropicCaller } from "./anthropicAgent";

describe("createAnthropicCaller", () => {
  it("renvoie une fonction callAgent sans contacter l'API a la construction", () => {
    const caller = createAnthropicCaller("sk-cle-de-test");
    expect(typeof caller).toBe("function");
  });
});
