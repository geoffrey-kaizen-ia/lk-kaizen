import type { ScenarioResult, Verdict } from "./types";
import { QUALITY_MEAN_THRESHOLD, QUALITY_FLOOR, QUALITY_MODE } from "./constants";

export function computeVerdict(
  results: ScenarioResult[],
  mode: "shadow" | "blocking" = QUALITY_MODE
): Verdict {
  const hardFails = results
    .filter((r) => r.kind === "security" && r.outcome === "fail")
    .map((r) => r.category);

  const qualityScores: number[] = results
    .filter((r): r is ScenarioResult & { score: number } =>
      r.kind === "quality" && r.score !== null
    )
    .map((r) => r.score);

  const qualityMean =
    qualityScores.length === 0
      ? null
      : qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;

  const qualityFloorBreached = qualityScores.length === 0
    ? []
    : results
        .filter((r): r is ScenarioResult & { score: number } =>
          r.kind === "quality" && r.score !== null && r.score < QUALITY_FLOOR
        )
        .map((r) => r.category);

  let passed = hardFails.length === 0;

  if (mode === "blocking" && qualityMean !== null) {
    passed =
      passed &&
      qualityMean >= QUALITY_MEAN_THRESHOLD &&
      qualityFloorBreached.length === 0;
  }

  return { passed, hardFails, qualityMean, qualityFloorBreached };
}
