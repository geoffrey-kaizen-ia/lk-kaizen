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
