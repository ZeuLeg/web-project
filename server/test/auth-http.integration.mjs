// Isolated manual integration suite. Never run against production.
// Requires a fresh local PostgreSQL test instance at 127.0.0.1:15434/securitytest
// and the candidate API at 127.0.0.1:13090. Tests insert synthetic users.
import assert from "node:assert/strict";
import pg from "pg";
import argon2 from "argon2";
import { signSessionCookie, SESSION_TTL_MS } from "../auth-session.js";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl?.includes("127.0.0.1:15434/securitytest")) {
  throw new Error("Refusing to run outside isolated test DB");
}
const base = "http://127.0.0.1:13090";
const pool = new pg.Pool({ connectionString: dbUrl });
let checks = 0;
function pass(label) { checks++; console.log("PASS", label); }
async function http(path, method = "GET", cookie = "", body) {
  return fetch(base + path, {
    method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
}
async function expectStatus(label, path, expected, method="GET", cookie="", body) {
  const response = await http(path, method, cookie, body);
  assert.equal(response.status, expected, label);
  pass(label);
  return response;
}

try {
  const ids = ["910000001","910000002"];
  const old = await pool.query("SELECT COUNT(*)::int AS n FROM users WHERE student_id = ANY($1)", [["900000001","900000002"]]);
  assert.equal(old.rows[0].n, 0);
  pass("known demo accounts not auto-seeded in isolated database");

  for (const [i, role] of ["student", "admin"].entries()) {
    const hash = await argon2.hash("TestOnlyPass123");
    await pool.query("INSERT INTO users (tc_id,student_id,password_hash,role) VALUES ($1,$2,$3,$4) ON CONFLICT (student_id) DO UPDATE SET password_hash=EXCLUDED.password_hash, role=EXCLUDED.role", ["3000000000"+(i+1),ids[i],hash,role]);
  }
  await expectStatus("no auth /auth/me rejected", "/api/auth/me", 401);
  await expectStatus("no auth admin dashboard rejected", "/api/admin/dashboard", 401);
  await expectStatus("no auth admin mutation rejected", "/api/admin/books", 401, "POST", "", {title:"Secret Book",author:"Secret Author",category:"yazilim"});
  await expectStatus("legacy forged ID rejected", "/api/auth/me", 401,"GET","studentId=910000002");
  await expectStatus("legacy forged ID admin rejected", "/api/admin/dashboard", 401,"GET","studentId=910000002");
  await expectStatus("login wrong password rejected", "/api/login", 401, "POST", "", {studentId:ids[0],password:"IncorrectPass1"});

  const login=await expectStatus("student login succeeds", "/api/login",200,"POST","",{studentId:ids[0],password:"TestOnlyPass123"});
  const setCookie=login.headers.get("set-cookie")||"";
  assert.match(setCookie,/librarySession=/);
  assert.match(setCookie,/HttpOnly/i);
  assert.match(setCookie,/Secure/i);
  assert.match(setCookie,/SameSite=Lax/i);
  pass("signed cookie has Secure HttpOnly SameSite flags");
  const studentCookie=setCookie.split(";")[0];
  await expectStatus("signed student session accepted", "/api/auth/me",200,"GET",studentCookie);
  await expectStatus("student denied admin data", "/api/admin/members",403,"GET",studentCookie);
  await expectStatus("student denied admin write", "/api/admin/books",403,"POST",studentCookie,{title:"Nothing",author:"Nothing",category:"yazilim"});

  const altered = studentCookie.replace(ids[0],ids[1]);
  await expectStatus("tampered session denied", "/api/auth/me",401,"GET",altered);
  const expired=signSessionCookie(ids[0],process.env.AUTH_SESSION_SECRET,Date.now()-SESSION_TTL_MS-1000);
  await expectStatus("expired session denied", "/api/auth/me",401,"GET","librarySession="+expired);

  const adminLogin=await expectStatus("admin login succeeds", "/api/login",200,"POST","",{studentId:ids[1],password:"TestOnlyPass123"});
  const adminCookie=(adminLogin.headers.get("set-cookie")||"").split(";")[0];
  await expectStatus("admin dashboard accessible to admin", "/api/admin/dashboard",200,"GET",adminCookie);
  await expectStatus("admin members accessible to admin", "/api/admin/members",200,"GET",adminCookie);
  await expectStatus("admin mutation allowed in isolated DB", "/api/admin/books",201,"POST",adminCookie,{title:"Security Test Book "+Date.now(),author:"Security Test Author",category:"yazilim"});
  const logout=await expectStatus("logout clears cookie", "/api/logout",200,"POST",studentCookie);
  assert.match(logout.headers.get("set-cookie")||"",/librarySession=/);
  pass("logout returns cookie expiration");
  console.log("RESULT",checks,"isolated HTTP checks passed");
} finally { await pool.end(); }
