import { z } from "zod";
import { checkSecret } from "@/lib/crash-test/apiAuth";
import { SECURITY_BANK } from "@/lib/crash-test/securityBank";
import { runCrashTest } from "@/lib/crash-test/runner";
import { createAnthropicCaller } from "@/lib/crash-test/anthropicAgent";

// Joue les 13 scenarios de securite en une requete. Plusieurs appels LLM en
// serie, on laisse une large marge de temps (necessite un plan Vercel qui
// autorise cette duree ; sinon repli sur /run-scenario un par un via n8n).
export const maxDuration = 300;

const bodySchema = z.object({ prompt_content: z.string() }).strict();

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY non configuree" },
      { status: 500 },
    );
  }

  const callAgent = createAnthropicCaller(apiKey);
  const report = await runCrashTest(parsed.data.prompt_content, SECURITY_BANK, callAgent);

  // Attache le dbId (uuid en base) a chaque resultat, pour que n8n ecrive
  // lk_test_results.scenario_id sans avoir a le retrouver lui-meme.
  const runs = report.runs.map((run) => {
    const scenario = SECURITY_BANK.find((s) => s.id === run.scenario_id);
    return {
      scenario_id: run.scenario_id,
      scenario_db_id: scenario?.dbId ?? null,
      category: run.category,
      outcome: run.result.outcome,
      score: run.result.score,
      transcript: run.transcript,
    };
  });

  return Response.json({ runs, verdict: report.verdict });
}
