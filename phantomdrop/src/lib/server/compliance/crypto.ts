import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

function keyFromSecret(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

function toB64Url(input: Buffer): string {
  return input.toString("base64url");
}

function fromB64Url(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

export function signPayload(payload: object, secret: string): string {
  const canonical = JSON.stringify(payload);
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

export function verifySignature(payload: object, signature: string, secret: string): boolean {
  const expected = signPayload(payload, secret);
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export function tokenize(value: string, secret: string, prefix: string): string {
  const digest = createHmac("sha256", secret).update(value).digest("hex").slice(0, 24);
  return `${prefix}_${digest}`;
}

export function encryptJson(value: unknown, secret: string): string {
  const iv = randomBytes(12);
  const key = keyFromSecret(secret);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${toB64Url(iv)}.${toB64Url(tag)}.${toB64Url(encrypted)}`;
}

export function decryptJson<T>(payload: string, secret: string): T {
  const [ivB64, tagB64, bodyB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !bodyB64) {
    throw new Error("Malformed encrypted payload");
  }

  const key = keyFromSecret(secret);
  const iv = fromB64Url(ivB64);
  const tag = fromB64Url(tagB64);
  const body = fromB64Url(bodyB64);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(body), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}
