import { checkSecret } from "@/lib/crash-test/apiAuth";
import { SECURITY_BANK } from "@/lib/crash-test/securityBank";

export async function GET(req: Request): Promise<Response> {
  const secret = req.headers.get("x-crash-test-secret");
  if (!checkSecret(secret, process.env.CRASH_TEST_API_SECRET)) {
    return Response.json({ error: "Non autorise" }, { status: 401 });
  }
  return Response.json({ scenarios: SECURITY_BANK });
}
