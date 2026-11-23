import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Estado de la app: versión publicada y prueba de la base (consultas en paralelo + transacción).
export async function GET() {
  const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7);
  const t0 = Date.now();
  const withTimeout = <T,>(p: Promise<T>) =>
    Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("la base no respondió en 8 s")), 8000))]);
  try {
    await withTimeout(Promise.all([sql`SELECT 1`, sql`SELECT 2`, sql`SELECT 3`]));
    await withTimeout(sql.begin(async (tx) => { await tx`SELECT 1`; await tx`SELECT 2`; }));
    return NextResponse.json({ ok: true, commit, db_ms: Date.now() - t0 });
  } catch (e) {
    return NextResponse.json({ ok: false, commit, error: (e as Error).message.replace(/postgres(ql)?:\/\/\S+/g, "***") }, { status: 500 });
  }
}
