import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "librarySession";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STUDENT_ID_PATTERN = /^[0-9]{9}$/;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;

export function assertSessionSecret(secret) {
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("AUTH_SESSION_SECRET must contain at least 32 bytes.");
  }
}

function signatureFor(payload, secret) {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

export function signSessionCookie(studentId, secret, now = Date.now()) {
  assertSessionSecret(secret);
  if (!STUDENT_ID_PATTERN.test(studentId) || !Number.isSafeInteger(now) || now < 0) {
    throw new TypeError("Invalid session subject or issue time.");
  }
  const payload = `${studentId}.${now}`;
  return `${payload}.${signatureFor(payload, secret)}`;
}

export function verifySessionCookie(token, secret, now = Date.now()) {
  if (typeof token !== "string" || token.length > 128 || !Number.isSafeInteger(now)) {
    return null;
  }
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [studentId, issuedAtText, suppliedSignature] = parts;
  if (!STUDENT_ID_PATTERN.test(studentId) ||
      !/^(0|[1-9][0-9]{0,15})$/.test(issuedAtText) ||
      !SIGNATURE_PATTERN.test(suppliedSignature)) {
    return null;
  }
  const issuedAt = Number(issuedAtText);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now ||
      now - issuedAt >= SESSION_TTL_MS) {
    return null;
  }
  const payload = `${studentId}.${issuedAtText}`;
  const expected = Buffer.from(signatureFor(payload, secret), "hex");
  const supplied = Buffer.from(suppliedSignature, "hex");
  return timingSafeEqual(expected, supplied) ? studentId : null;
}