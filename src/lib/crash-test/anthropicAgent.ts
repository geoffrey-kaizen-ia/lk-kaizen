import Anthropic from "@anthropic-ai/sdk";
import type { CallAgent } from "./runner";

// Meme modele que le mode test existant du dashboard (actions.ts).
const CRASH_TEST_MODEL = "claude-sonnet-4-6";

// Temperature abaissee (0.4 contre 0.8 en prod) pour stabiliser les
// verifications de securite binaires jouees en une seule passe. Revocable.
const CRASH_TEST_TEMPERATURE = 0.4;

// Construit un callAgent reel branche sur le SDK Anthropic. La cle est
// passee explicitement par l'appelant (process.env cote serveur), jamais lue ici.
export function createAnthropicCaller(apiKey: string): CallAgent {
  const anthropic = new Anthropic({ apiKey });
  return async (system, userMessage) => {
    const response = await anthropic.messages.create({
      model: CRASH_TEST_MODEL,
      max_tokens: 700,
      temperature: CRASH_TEST_TEMPERATURE,
      system,
      messages: [{ role: "user", content: userMessage }],
    });
    const block = response.content[0];
    return block?.type === "text" ? block.text.trim() : "";
  };
}
