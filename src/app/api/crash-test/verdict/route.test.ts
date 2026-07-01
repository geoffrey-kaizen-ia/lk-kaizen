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
    const res = await POST(req({ results: [], extra: 1 }, SECRET));
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
