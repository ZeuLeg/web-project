import { test } from "node:test";
import assert from "node:assert/strict";
import { SESSION_TTL_MS, assertSessionSecret, signSessionCookie, verifySessionCookie } from "../auth-session.js";

const SECRET = "a".repeat(64);
const NOW = 1_800_000_000_000;
const STUDENT = "900000123";

test("signed session round-trips", () => {
  const token = signSessionCookie(STUDENT, SECRET, NOW);
  assert.equal(verifySessionCookie(token, SECRET, NOW + 1000), STUDENT);
});

test("unsiged student ID is rejected", () => {
  assert.equal(verifySessionCookie(STUDENT, SECRET, NOW), null);
});

test("tampered user ID, issue time and signature are rejected", () => {
  const token = signSessionCookie(STUDENT, SECRET, NOW);
  const parts = token.split(".");
  assert.equal(verifySessionCookie(token.replace(STUDENT, "900000999"), SECRET, NOW), null);
  assert.equal(verifySessionCookie([parts[0], String(NOW - 1), parts[2]].join("."), SECRET, NOW), null);
  const alternateSignature = (parts[2][0] === "a" ? "b" : "a") + parts[2].slice(1);
  assert.equal(verifySessionCookie([parts[0], parts[1], alternateSignature].join("."), SECRET, NOW), null);
});

test("another secret cannot verify a token", () => {
  const token = signSessionCookie(STUDENT, SECRET, NOW);
  assert.equal(verifySessionCookie(token, "b".repeat(64), NOW), null);
});

test("expired and future-issued sessions are rejected", () => {
  const token = signSessionCookie(STUDENT, SECRET, NOW);
  assert.equal(verifySessionCookie(token, SECRET, NOW + SESSION_TTL_MS - 1), STUDENT);
  assert.equal(verifySessionCookie(token, SECRET, NOW + SESSION_TTL_MS), null);
  assert.equal(verifySessionCookie(token, SECRET, NOW - 1), null);
});

test("invalid cookie shapes are rejected", () => {
  for (const token of ["", "a.b.c", "foo", "%E0%A4%A", "x".repeat(200), "900000123.0." + "a".repeat(64), "900000123.01." + "a".repeat(64)]) {
    assert.equal(verifySessionCookie(token, SECRET, NOW), null);
  }
});

test("missing and short secrets fail closed", () => {
  assert.throws(() => assertSessionSecret("short"));
  assert.throws(() => signSessionCookie(STUDENT, undefined, NOW));
  assert.equal(verifySessionCookie(signSessionCookie(STUDENT, SECRET, NOW), undefined, NOW), null);
});

test("malformed user IDs cannot be signed", () => {
  for (const id of ["90000012", "9000001234", "abcdefghi", "../users", "900000123.1"]) {
    assert.throws(() => signSessionCookie(id, SECRET, NOW));
  }
});