import { z } from "zod";
import { checkSecret } from "@/lib/crash-test/apiAuth";
import { SECURITY_BANK } from "@/lib/crash-test/securityBank";
import { runScenario } from "@/lib/crash-test/runner";
import { createAnthropicCaller } from "@/lib/crash-test/anthropicAgent";

// Un scenario de securite peut faire plusieurs tours (ex C3), on laisse
// de la marge au-dela du defaut serverless.
export const maxDuration = 60;

const bodySchema = z
  .object({ prompt_content: z.string(), scenario_id: z.string() })
  .strict();

export async function POST(req: Request): Promise<Response> {
  const secret = req.headers.get("x-crash-test-secret");
  if (!checkSecret(secret, process.env.CRASH_TEST_API_SECRET)) {
    return Response.json({ error: "Non autorise" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Corps invalide" }, { status: 400 });
  }

  const scenario = SECURITY_BANK.find((s) => s.id === parsed.data.scenario_id);
  if (!scenario) {
    return Response.json({ error: "Scenario inconnu" }, { status: 404 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY non configuree" },
      { status: 500 },
    );
  }

  const callAgent = createAnthropicCaller(apiKey);
  const run = await runScenario(parsed.data.prompt_content, scenario, callAgent);
  return Response.json({ result: run.result, transcript: run.transcript });
}
