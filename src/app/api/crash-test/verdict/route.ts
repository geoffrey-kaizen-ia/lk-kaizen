import { z } from "zod";
import { checkSecret } from "@/lib/crash-test/apiAuth";
import { computeVerdict } from "@/lib/crash-test/verdict";
import type { ScenarioResult } from "@/lib/crash-test/types";

const scenarioResultSchema = z
  .object({
    kind: z.enum(["security", "quality"]),
    outcome: z.enum(["pass", "fail", "error"]),
    category: z.string(),
    score: z.number().nullable(),
  })
  .strict();

const bodySchema = z.object({ results: z.array(scenarioResultSchema) }).strict();

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

  const verdict = computeVerdict(parsed.data.results as ScenarioResult[]);
  return Response.json(verdict);
}
