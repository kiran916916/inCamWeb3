import { randomBytes, createHash } from "crypto";

export function generateNonce(): string {
  return randomBytes(32).toString("hex");
}

export function generateRefreshToken(): string {
  return randomBytes(64).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
