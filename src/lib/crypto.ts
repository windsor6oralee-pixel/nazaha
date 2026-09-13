/**
 * AES-256-GCM encryption for sensitive config values (SMTP password, etc.)
 * Key comes from ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 * Falls back to a dev-only key when not set (never safe for production).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const DEV_KEY = "0".repeat(64); // 32 zero-bytes — dev only

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY ?? DEV_KEY;
  if (hex === DEV_KEY && process.env.NODE_ENV === "production") {
    throw new Error("ENCRYPTION_KEY must be set in production");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(12):tag(16):ciphertext — hex encoded, colon-separated
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decrypt(encoded: string): string {
  const [ivHex, tagHex, ctHex] = encoded.split(":");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(ctHex, "hex")).toString("utf8") + decipher.final("utf8");
}
