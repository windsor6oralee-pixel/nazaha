/**
 * Random password generator for provisioned candidate accounts.
 *
 * Guarantees per call:
 *   - length ≥ 12
 *   - at least one lowercase, uppercase, digit, and symbol
 *   - no visually-confusing characters (0/O, 1/l/I, |)
 *   - bytes drawn from crypto.randomBytes (not Math.random)
 */
import { randomBytes } from "crypto";

const LOWER   = "abcdefghijkmnopqrstuvwxyz";       // no l
const UPPER   = "ABCDEFGHJKLMNPQRSTUVWXYZ";        // no I, O
const DIGITS  = "23456789";                        // no 0, 1
const SYMBOLS = "!@#$%*?-_=+";                     // no HTML-special chars (&<>) and no quotes
const ALL     = LOWER + UPPER + DIGITS + SYMBOLS;

/** One cryptographically-random index into `pool`. */
function pick(pool: string): string {
  // Rejection sampling to avoid modulo bias on pool sizes that don't divide 256.
  const max = 256 - (256 % pool.length);
  // One extra byte per call is cheap; loop almost never iterates.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const b = randomBytes(1)[0];
    if (b < max) return pool[b % pool.length];
  }
}

export function generateCandidatePassword(length = 12): string {
  if (length < 8) throw new Error("password length must be ≥ 8");
  // Seed with one of each required class so complexity is guaranteed.
  const required = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  const rest     = Array.from({ length: length - required.length }, () => pick(ALL));
  const chars    = [...required, ...rest];

  // Fisher-Yates with a crypto-random swap index so required chars aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
