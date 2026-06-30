import type { TestStatus } from "./types";

// Un agent ne peut etre assigne a un role de prod que s'il a reussi le crash test.
export function canAssign(testStatus: TestStatus): boolean {
  return testStatus === "validated";
}
