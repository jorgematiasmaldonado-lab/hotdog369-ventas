import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { route, body, str, ApiError } from "@/lib/api";
import { SESSION_COOKIE, SESSION_HOURS, signToken } from "@/lib/session-token";
import { audit } from "@/lib/audit";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 5;

export const POST = route(async (req) => {
  const b = await body(req);
  const username = str(b.username, "usuario", { max: 60 })!.toLowerCase();
  const pin = str(b.pin, "PIN", { max: 20 })!;

  const [u] = await sql`SELECT id, pin_hash, active, locked_until, failed_attempts, session_version FROM users WHERE lower(username) = ${username}`;
  const fail = () => new ApiError(401, "Usuario o PIN incorrectos.");
  if (!u || !u.active) {
    await bcrypt.compare(pin, "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva"); // tiempo constante
    throw fail();
  }
  if (u.locked_until && new Date(u.locked_until) > new Date()) {
    throw new ApiError(429, `Demasiados intentos. Probá de nuevo en unos minutos.`);
  }
  if (!(await bcrypt.compare(pin, u.pin_hash))) {
    const attempts = u.failed_attempts + 1;
    await sql`UPDATE users SET failed_attempts = ${attempts >= MAX_ATTEMPTS ? 0 : attempts},
      locked_until = ${attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null} WHERE id = ${u.id}`;
    if (attempts >= MAX_ATTEMPTS) await audit(sql, u.id, "bloqueo", "usuario", u.id, undefined, undefined, "Bloqueado por intentos fallidos");
    throw fail();
  }
  await sql`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ${u.id}`;
  await audit(sql, u.id, "login", "usuario", u.id);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signToken({ uid: u.id, sv: u.session_version }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return res;
});
