export type TestStatus = "untested" | "testing" | "validated" | "failed";

export type ScenarioResult = {
  kind: "security" | "quality";
  outcome: "pass" | "fail" | "error";
  category: string;
  score: number | null;
};

export type Verdict = {
  passed: boolean;
  hardFails: string[];
  qualityMean: number | null;
  qualityFloorBreached: string[];
};
