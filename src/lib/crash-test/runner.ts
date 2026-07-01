import { parseAgentOutput, type AgentOutput } from "./agentOutput";
import { checkSecurityScenario, type SecurityScenario } from "./securityCheck";
import { computeVerdict } from "./verdict";
import type { ScenarioResult, Verdict } from "./types";

// Appel a l'agent teste, injecte pour garder le runner pur et testable.
export type CallAgent = (system: string, userMessage: string) => Promise<string>;

export type TranscriptTurn = {
  prospect: string;
  agent_raw: string;
  agent_parsed: AgentOutput | null;
};

export type ScenarioRun = {
  scenario_id: string;
  category: string;
  result: ScenarioResult;
  transcript: TranscriptTurn[];
};

export type CrashTestReport = {
  results: ScenarioResult[];
  runs: ScenarioRun[];
  verdict: Verdict;
};

// Reproduit le message utilisateur du node "Claude - Reponse" de production
// (voir testAgentReply, actions.ts). Les infos prospect sont neutres en test.
function buildUserMessage(
  historique: string,
  dernierMessage: string,
  nombreEchanges: number,
): string {
  return `
Historique de la conversation:
${historique}


Dernier message du prospect:
${dernierMessage}

Infos prospect:
Entreprise: (crash test)
Poste: (crash test)
Resume: (crash test)

Nombre de messages envoyes: ${nombreEchanges}`;
}

export async function runScenario(
  promptContent: string,
  scenario: SecurityScenario,
  callAgent: CallAgent,
): Promise<ScenarioRun> {
  const transcript: TranscriptTurn[] = [];
  const historyLines: string[] = [];
  let lastParsed: AgentOutput | null = null;
  let agentMessagesSent = 0;

  for (const prospectMessage of scenario.scripted_messages) {
    const userMessage = buildUserMessage(
      historyLines.join("\n"),
      prospectMessage,
      agentMessagesSent,
    );
    const raw = await callAgent(promptContent, userMessage);
    lastParsed = parseAgentOutput(raw);
    transcript.push({ prospect: prospectMessage, agent_raw: raw, agent_parsed: lastParsed });

    historyLines.push(`Prospect: ${prospectMessage}`);
    if (lastParsed !== null && lastParsed.message.trim().length > 0) {
      historyLines.push(`Moi: ${lastParsed.message}`);
      agentMessagesSent += 1;
    }
  }

  const result = checkSecurityScenario(scenario, lastParsed);
  return { scenario_id: scenario.id, category: scenario.category, result, transcript };
}

export async function runCrashTest(
  promptContent: string,
  scenarios: SecurityScenario[],
  callAgent: CallAgent,
): Promise<CrashTestReport> {
  const runs: ScenarioRun[] = [];
  for (const scenario of scenarios) {
    runs.push(await runScenario(promptContent, scenario, callAgent));
  }
  const results = runs.map((run) => run.result);
  const verdict = computeVerdict(results);
  return { results, runs, verdict };
}
