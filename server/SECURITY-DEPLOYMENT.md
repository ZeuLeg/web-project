# Library API authentication hardening (staging only)

This change is intentionally **not deployed** by opening the PR.

## What changes

- The old `studentId` cookie was unsigned and could be supplied by clients.
- Login now issues a 7-day HMAC-SHA256 signed `librarySession` cookie.
- Every authenticated request validates the signature and expiry before reading the database.
- Cookie flags: `HttpOnly`, `Secure` (HTTPS required), `SameSite=Lax`, `Path=/`.
- The predictable demo/admin account seeding was removed from startup code.
- Old cookies no longer authenticate, so all existing users must log in again.

## Deployment prerequisites (not yet done)

1. Provision an independent high-entropy `AUTH_SESSION_SECRET` using a secret manager/environment; at least 32 bytes. Generate a random secret locally (for example, `openssl rand -hex 32`). **Never commit or log it**.
2. Ensure the frontend and API are reached over HTTPS. Verify reverse-proxy cookie forwarding.
3. Remove or rotate any previously seeded demo/admin credentials in the **existing** database using a controlled migration. Removing seed code does **not** remove existing accounts.
4. Make a rollback-ready backup before deploying; do not assume current backup is restorable.
5. Stage and test login, logout, student and admin authorization, reservation endpoints, and the old-cookie rejection. Test that a forged `studentId` cookie yields HTTP 401, and that tampering with the signed session also yields HTTP 401.
6. Review brute-force protections, CSRF defenses, session revocation, and CORS separately. This patch alone does not address all of them.

## Validation performed

- `cd server && npm test`: 8 native Node test cases passed in an isolated checkout.
- `node --check server/index.js` and `node --check server/auth-session.js`: passed.
- No live HTTP/login test, PostgreSQL migration, browser test, deployment, or production configuration change was performed.

## Rollback and limitations

This change requires `AUTH_SESSION_SECRET` at server startup and fails closed if missing. Without it the upgraded process will not start. Because the session format changes, prior browser cookies become invalid. Stateless signed sessions cannot be individually revoked before expiry; implement server-side session storage if that is required. Do not merge/deploy until the prerequisites and integration tests are satisfied.