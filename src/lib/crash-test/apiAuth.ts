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
