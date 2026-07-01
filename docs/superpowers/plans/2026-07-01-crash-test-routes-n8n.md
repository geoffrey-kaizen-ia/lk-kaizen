# Crash test — Plan 4 : Routes API pour n8n + déclencheurs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer le calcul du crash test à n8n via des routes API protégées, et brancher les déclencheurs (auto à la création d'un agent, bouton manuel de re-test), pour que n8n orchestre la boucle et écrive le verdict avec `service_role`, sans jamais que le dashboard écrive lui-même le verdict.

**Architecture:** Le dashboard ne fait que deux choses. (1) DÉCLENCHER : après création d'un agent, ou sur clic du bouton re-test, une server action appelle un webhook n8n (fire and forget, comme `connectLinkedin`). (2) CALCULER : trois routes API que n8n appelle, protégées par un secret partagé comparé en temps constant. `GET /api/crash-test/bank` liste les scénarios, `POST /api/crash-test/run-scenario` joue un scénario contre un agent (appel Anthropic réel via le runner du Plan 3) et renvoie le résultat plus le transcript, `POST /api/crash-test/verdict` calcule le verdict à partir des résultats. n8n orchestre la boucle, écrit `lk_test_runs` / `lk_test_results` et met à jour `lk_agents.test_status` avec `service_role` (hors de ce repo). Le contrat n8n est documenté ici mais construit par Anthony côté n8n.

**Tech Stack:** Next.js 15 (App Router, route handlers), TypeScript strict, Vitest, Zod (nouveau), `@anthropic-ai/sdk` (déjà là).

## Global Constraints

- Pas de double tiret ni de tiret long dans le code, les commentaires ou l'UI (verbatim CLAUDE.md).
- TypeScript strict. Composants serveur par défaut.
- Sécurité API (`.claude/rules/security-supabase.md`) : secret comparé avec `crypto.timingSafeEqual`, jamais `===`. Validation Zod `.strict()` sur chaque entrée, whitelist explicite, pas de passthrough. Secrets uniquement via `process.env`, jamais en dur.
- Jamais de `service_role` dans ce repo. Les routes tournent avec la clé Anthropic serveur et le secret partagé, elles n'écrivent RIEN en base. Toute écriture DB du verdict est le job de n8n.
- On réutilise sans les modifier : `SECURITY_BANK` (`securityBank.ts`), `runScenario` (`runner.ts`), `createAnthropicCaller` (`anthropicAgent.ts`), `computeVerdict` (`verdict.ts`), types (`types.ts`, `securityCheck.ts`).
- Déclenchement par webhook n8n calqué sur `connectLinkedin` (`src/app/dashboard/actions.ts`) : `fetch(process.env.N8N_..._URL, { method: POST, body JSON })`, en tolérant l'échec sans casser l'action appelante.

## Variables d'environnement (à poser par Anthony, hors repo)

- `ANTHROPIC_API_KEY` : clé serveur Anthropic (déjà notée comme dette pour le mode test existant).
- `CRASH_TEST_API_SECRET` : secret partagé entre n8n et les routes du dashboard.
- `N8N_CRASH_TEST_URL` : URL du webhook n8n déclenché à la création d'un agent et au re-test manuel.

---

### Task 0: Installer Zod

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Installer**

Run: `npm install zod`
Expected: `zod` ajouté à `dependencies`, pas d'erreur.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: ajout de zod pour la validation des entrees API (crash test)"
```

---

### Task 1: Garde de secret partagé (comparaison temps constant)

**Files:**
- Create: `src/lib/crash-test/apiAuth.ts`
- Test: `src/lib/crash-test/apiAuth.test.ts`

**Interfaces:**
- Consumes: `node:crypto`.
- Produces: `checkSecret(provided: string | null, expected: string | undefined): boolean`.

Règle : renvoie `false` si l'un des deux est vide ou si les longueurs diffèrent (avant `timingSafeEqual`, qui exige des buffers de même taille), sinon compare en temps constant.

- [ ] **Step 1: Écrire les tests qui échouent**

Create `src/lib/crash-test/apiAuth.test.ts`:

```ts
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
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npm test -- apiAuth`
Expected: FAIL.

- [ ] **Step 3: Écrire l'implémentation**

Create `src/lib/crash-test/apiAuth.ts`:

```ts
import { timingSafeEqual } from "node:crypto";

// Compare le secret fourni au secret serveur en temps constant.
// timingSafeEqual exige des buffers de meme longueur : on filtre avant.
export function checkSecret(
  provided: string | null,
  expected: string | undefined,
): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npm test -- apiAuth`
Expected: PASS, 5 tests verts.

- [ ] **Step 5: Commit**

```bash
git add src/lib/crash-test/apiAuth.ts src/lib/crash-test/apiAuth.test.ts
git commit -m "feat: garde de secret partage pour les routes crash test (timing-safe)"
```

---

### Task 2: Route GET /api/crash-test/bank

**Files:**
- Create: `src/app/api/crash-test/bank/route.ts`
- Test: `src/app/api/crash-test/bank/route.test.ts`

**Interfaces:**
- Consumes: `checkSecret` (Task 1), `SECURITY_BANK` (`securityBank.ts`).
- Produces: handler `GET(req: Request): Response`. 401 si secret invalide, sinon 200 avec `{ scenarios: SecurityScenario[] }`.

- [ ] **Step 1: Écrire les tests qui échouent**

Create `src/app/api/crash-test/bank/route.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";

const SECRET = "secret-de-test";

beforeEach(() => {
  process.env.CRASH_TEST_API_SECRET = SECRET;
});

function req(secret?: string): Request {
  const headers = new Headers();
  if (secret) headers.set("x-crash-test-secret", secret);
  return new Request("http://localhost/api/crash-test/bank", { headers });
}

describe("GET /api/crash-test/bank", () => {
  it("refuse sans le bon secret", async () => {
    const res = await GET(req("mauvais"));
    expect(res.status).toBe(401);
  });

  it("renvoie la banque avec le bon secret", async () => {
    const res = await GET(req(SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.scenarios)).toBe(true);
    expect(body.scenarios.length).toBeGreaterThan(0);
    expect(body.scenarios[0]).toHaveProperty("id");
    expect(body.scenarios[0]).toHaveProperty("assertions");
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npm test -- bank`
Expected: FAIL.

- [ ] **Step 3: Écrire l'implémentation**

Create `src/app/api/crash-test/bank/route.ts`:

```ts
import { checkSecret } from "@/lib/crash-test/apiAuth";
import { SECURITY_BANK } from "@/lib/crash-test/securityBank";

export async function GET(req: Request): Promise<Response> {
  const secret = req.headers.get("x-crash-test-secret");
  if (!checkSecret(secret, process.env.CRASH_TEST_API_SECRET)) {
    return Response.json({ error: "Non autorise" }, { status: 401 });
  }
  return Response.json({ scenarios: SECURITY_BANK });
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npm test -- bank`
Expected: PASS, 2 tests verts.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/crash-test/bank/route.ts src/app/api/crash-test/bank/route.test.ts
git commit -m "feat: route GET bank du crash test (liste des scenarios, secret-gated)"
```

---

### Task 3: Route POST /api/crash-test/verdict

**Files:**
- Create: `src/app/api/crash-test/verdict/route.ts`
- Test: `src/app/api/crash-test/verdict/route.test.ts`

**Interfaces:**
- Consumes: `checkSecret` (Task 1), `computeVerdict` (`verdict.ts`), `zod`.
- Produces: handler `POST(req: Request): Response`. 401 secret, 400 corps invalide, sinon 200 avec le `Verdict`.

Schéma Zod strict du corps : `{ results: Array<{ kind: "security"|"quality", outcome: "pass"|"fail"|"error", category: string, score: number | null }> }`.

- [ ] **Step 1: Écrire les tests qui échouent**

Create `src/app/api/crash-test/verdict/route.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";

const SECRET = "secret-de-test";
beforeEach(() => {
  process.env.CRASH_TEST_API_SECRET = SECRET;
});

function req(body: unknown, secret?: string): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (secret) headers.set("x-crash-test-secret", secret);
  return new Request("http://localhost/api/crash-test/verdict", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/crash-test/verdict", () => {
  it("refuse sans le bon secret", async () => {
    const res = await POST(req({ results: [] }, "mauvais"));
    expect(res.status).toBe(401);
  });

  it("refuse un corps qui ne respecte pas le schema", async () => {
    const res = await POST(req({ resultats: [] }, SECRET));
    expect(res.status).toBe(400);
  });

  it("refuse un champ en trop (strict)", async () => {
    const res = await POST(
      req({ results: [], extra: 1 }, SECRET),
    );
    expect(res.status).toBe(400);
  });

  it("calcule le verdict, hard fail si un scenario securite echoue", async () => {
    const res = await POST(
      req(
        {
          results: [
            { kind: "security", outcome: "fail", category: "A1", score: null },
            { kind: "quality", outcome: "pass", category: "D1", score: 8 },
          ],
        },
        SECRET,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.passed).toBe(false);
    expect(body.hardFails).toEqual(["A1"]);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npm test -- verdict/route`
Expected: FAIL.

- [ ] **Step 3: Écrire l'implémentation**

Create `src/app/api/crash-test/verdict/route.ts`:

```ts
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
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npm test -- verdict/route`
Expected: PASS, 4 tests verts.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/crash-test/verdict/route.ts src/app/api/crash-test/verdict/route.test.ts
git commit -m "feat: route POST verdict du crash test (zod strict, secret-gated)"
```

---

### Task 4: Route POST /api/crash-test/run-scenario

**Files:**
- Create: `src/app/api/crash-test/run-scenario/route.ts`
- Test: `src/app/api/crash-test/run-scenario/route.test.ts`

**Interfaces:**
- Consumes: `checkSecret` (Task 1), `SECURITY_BANK` (`securityBank.ts`), `runScenario` (`runner.ts`), `createAnthropicCaller` (`anthropicAgent.ts`), `zod`.
- Produces: handler `POST(req: Request): Response` et `export const maxDuration = 60`. 401 secret, 400 corps invalide, 404 scénario inconnu, 500 si `ANTHROPIC_API_KEY` absente, sinon 200 avec `{ result, transcript }`.

Schéma Zod strict : `{ prompt_content: string, scenario_id: string }`. Les tests couvrent les gardes (auth, validation, scénario inconnu, clé absente) sans appeler Anthropic. Le chemin nominal qui appelle Anthropic est vérifié en intégration, pas en test unitaire.

- [ ] **Step 1: Écrire les tests qui échouent**

Create `src/app/api/crash-test/run-scenario/route.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";

const SECRET = "secret-de-test";
beforeEach(() => {
  process.env.CRASH_TEST_API_SECRET = SECRET;
  delete process.env.ANTHROPIC_API_KEY;
});

function req(body: unknown, secret?: string): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (secret) headers.set("x-crash-test-secret", secret);
  return new Request("http://localhost/api/crash-test/run-scenario", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/crash-test/run-scenario, gardes", () => {
  it("refuse sans le bon secret", async () => {
    const res = await POST(req({ prompt_content: "x", scenario_id: "A1" }, "mauvais"));
    expect(res.status).toBe(401);
  });

  it("refuse un corps invalide (champ manquant)", async () => {
    const res = await POST(req({ scenario_id: "A1" }, SECRET));
    expect(res.status).toBe(400);
  });

  it("refuse un champ en trop (strict)", async () => {
    const res = await POST(req({ prompt_content: "x", scenario_id: "A1", extra: 1 }, SECRET));
    expect(res.status).toBe(400);
  });

  it("renvoie 404 pour un scenario inconnu", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const res = await POST(req({ prompt_content: "x", scenario_id: "ZZZ" }, SECRET));
    expect(res.status).toBe(404);
  });

  it("renvoie 500 si la cle Anthropic n'est pas configuree", async () => {
    const res = await POST(req({ prompt_content: "x", scenario_id: "A1" }, SECRET));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npm test -- run-scenario`
Expected: FAIL.

- [ ] **Step 3: Écrire l'implémentation**

Create `src/app/api/crash-test/run-scenario/route.ts`:

```ts
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
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npm test -- run-scenario`
Expected: PASS, 5 tests verts.

- [ ] **Step 5: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/crash-test/run-scenario/route.ts src/app/api/crash-test/run-scenario/route.test.ts
git commit -m "feat: route POST run-scenario du crash test (joue 1 scenario, secret-gated)"
```

---

### Task 5: Déclencheurs (auto à la création + action de re-test)

**Files:**
- Modify: `src/app/dashboard/agents/actions.ts` (`createAgent`, + nouvelle action `relaunchCrashTest`)

**Interfaces:**
- Consumes: `process.env.N8N_CRASH_TEST_URL`.
- Produces: `createAgent` déclenche le crash test du nouvel agent ; `relaunchCrashTest(agentId: string): Promise<{ error: string | null }>`.

Règle : le déclenchement est fire and forget, il ne doit jamais faire échouer la création ni le clic (webhook injoignable = on ignore).

- [ ] **Step 1: Ajouter le helper de déclenchement et récupérer l'id à la création**

Dans `src/app/dashboard/agents/actions.ts`, ajouter près du haut du fichier ce helper :

```ts
// Previent n8n qu'un agent doit passer le crash test. Fire and forget :
// une panne du webhook ne doit jamais casser l'action appelante.
async function triggerCrashTest(agentId: string, trigger: "create" | "manual") {
  const url = process.env.N8N_CRASH_TEST_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId, trigger }),
      cache: "no-store",
    });
  } catch {
    // ignore : le crash test pourra etre relance manuellement
  }
}
```

Puis, dans `createAgent`, remplacer le bloc d'insertion (`const { error } = await supabase.from("lk_agents").insert({ ... });` jusqu'au `return`) par une version qui récupère l'id et déclenche le test :

```ts
  const { data: created, error } = await supabase
    .from("lk_agents")
    .insert({
      account_id: accountId,
      name: formData.get("name") as string,
      objectif: (formData.get("objectif") as string) || null,
      prompt_content: (formData.get("prompt_content") as string) || null,
      knowledge_base: knowledgeBase,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  if (created) await triggerCrashTest(created.id, "create");
  revalidatePath("/dashboard/agents");
  return { error: null };
```

- [ ] **Step 2: Ajouter l'action de re-test manuel**

Toujours dans `actions.ts`, ajouter :

```ts
export async function relaunchCrashTest(agentId: string) {
  const supabase = await createClient();
  const accountId = await getAccountId();
  if (!accountId) return { error: "Compte non configure" };

  // Verifie que l'agent appartient bien au client connecte avant de declencher.
  const { data: agent } = await supabase
    .from("lk_agents")
    .select("id")
    .eq("id", agentId)
    .eq("account_id", accountId)
    .maybeSingle();

  if (!agent) return { error: "Agent introuvable" };

  await triggerCrashTest(agentId, "manual");
  revalidatePath("/dashboard/agents");
  return { error: null };
}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/agents/actions.ts
git commit -m "feat: declencheurs crash test (auto a la creation + action de re-test)"
```

---

### Task 6: Bouton de re-test sur la carte agent

**Files:**
- Modify: `src/app/dashboard/agents/AgentsClient.tsx`

**Interfaces:**
- Consumes: `relaunchCrashTest` (Task 5), `test_status` (déjà affiché par le badge du Plan 1).
- Produces: un bouton "Relancer le crash test" par agent.

- [ ] **Step 1: Câbler le bouton**

Dans `src/app/dashboard/agents/AgentsClient.tsx`, importer l'action (ajouter à l'import existant depuis `./actions`) :

```tsx
import { relaunchCrashTest } from "./actions";
```

Ajouter un handler dans le composant (près des autres handlers d'action) :

```tsx
async function handleRelaunchTest(agentId: string) {
  await relaunchCrashTest(agentId);
}
```

Puis, à côté du `TestStatusBadge` déjà rendu sur chaque carte (Plan 1), ajouter le bouton :

```tsx
<button
  type="button"
  onClick={() => handleRelaunchTest(agent.id)}
  className="text-xs text-muted-foreground underline hover:text-foreground"
>
  Relancer le crash test
</button>
```

Adapter les classes aux conventions réellement présentes dans le fichier si elles diffèrent.

- [ ] **Step 2: Vérifier la compilation et la suite complète**

Run: `npx tsc --noEmit && npm test`
Expected: exit 0, tous les tests verts.

- [ ] **Step 3: Vérification visuelle**

Run: `npm run dev`, ouvrir `/dashboard/agents`.
Expected: chaque carte agent montre le badge de statut et un bouton "Relancer le crash test". Le clic ne casse rien même si `N8N_CRASH_TEST_URL` n'est pas encore configurée (fire and forget).

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/agents/AgentsClient.tsx
git commit -m "feat: bouton relancer le crash test sur les cartes agents"
```

---

## Contrat n8n (à construire par Anthony côté n8n, hors repo)

Le workflow n8n est déclenché par le webhook `N8N_CRASH_TEST_URL` avec `{ agent_id, trigger }`. Il porte le `service_role` (légitime chez n8n). Étapes :

1. **Charger l'agent** : lire `lk_agents` (`prompt_content`, `account_id`) pour `agent_id`.
2. **Marquer testing** : `update lk_agents set test_status = 'testing' where id = agent_id`.
3. **Créer le run** : insérer `lk_test_runs` (`agent_id`, `account_id`, `status='running'`, `trigger`), garder `run_id`.
4. **Charger la banque** : `GET /api/crash-test/bank` avec l'en-tête `x-crash-test-secret: CRASH_TEST_API_SECRET`.
5. **Boucle scénarios** : pour chaque scénario, `POST /api/crash-test/run-scenario` avec `{ prompt_content, scenario_id }` et le secret. Insérer la réponse dans `lk_test_results` (`run_id`, `scenario_id`, `outcome`, `score`, `transcript`), idempotent sur `(run_id, scenario_id)` (upsert on conflict do nothing) pour permettre la reprise.
6. **Verdict** : `POST /api/crash-test/verdict` avec `{ results }` (les `result` collectés). Écrire le `verdict` dans `lk_test_runs`, `status = passed ? 'passed' : 'failed'`, `finished_at = now()`.
7. **Finaliser l'agent** : `update lk_agents set test_status = verdict.passed ? 'validated' : 'failed', last_test_run_id = run_id`.
8. **Gestion d'erreur** : si un `run-scenario` échoue techniquement (timeout, 500 Anthropic), retry avec backoff ; si ça persiste, `lk_test_runs.status = 'error'` et NE PAS changer `test_status` de l'agent (il garde son état précédent), l'UI proposera de réessayer.

Le `scenario_id` reçu par n8n vient de l'`id` des scénarios renvoyés par `/bank` (ex `A1`, `C4`).

---

## Self-review (couverture spec)

- Route `start` de la spec : portée par n8n (créer run + marquer testing), le repo fournit `/bank` pour charger les scénarios. ✅ (Task 2 + contrat n8n étapes 2-4)
- Route `scenario` (jouer 1 scénario, idempotent) : le calcul est `/run-scenario` (Task 4), l'idempotence `(run_id, scenario_id)` est portée par n8n + la contrainte UNIQUE existante. ✅
- Route `finalize` (verdict + maj statut) : calcul `/verdict` (Task 3), écriture par n8n. ✅ (contrat n8n étapes 6-7)
- Déclenchement auto à la création + bouton manuel (spec §5) : Task 5 + Task 6. ✅
- Sécurité API : secret timing-safe (Task 1), Zod strict (Tasks 3-4), aucun `service_role` dans le repo, verdict écrit par n8n (infalsifiable côté client). ✅
- Transcript stocké pour la vue admin (spec §3) : renvoyé par `/run-scenario`, écrit par n8n. ✅

## Hors périmètre de ce plan (plans suivants)

- **Le workflow n8n lui-même** : construit par Anthony, contrat ci-dessus.
- **Re-test global admin** (socle change, tous les agents) : un déclencheur qui boucle sur les agents côté n8n. Plan admin.
- **Vue admin transcripts** et **rapport client détaillé** : plans UI dédiés.
- **Volet qualité** (LLM-prospect + juge, catégories D-H) et **B commercial** : plan juge.
- **Rate limiting** des routes : gardé simple ici (secret partagé, n8n seul appelant en séquentiel) ; à ajouter si les routes sont exposées plus largement.
- **Régénération de prompt comme déclencheur** : à brancher dans le futur compilateur de prompt quand la régénération existera comme action distincte.
```
