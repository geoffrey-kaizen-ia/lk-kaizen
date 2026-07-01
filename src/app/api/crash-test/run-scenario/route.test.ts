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
