import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Estado de la app: versión publicada y prueba de consultas en paralelo contra la base.
export async function GET() {
  const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7);
  const t0 = Date.now();
  try {
    await Promise.all([sql`SELECT 1`, sql`SELECT 2`, sql`SELECT 3`]);
    return NextResponse.json({ ok: true, commit, db_ms: Date.now() - t0 });
  } catch (e) {
    return NextResponse.json({ ok: false, commit, error: (e as Error).message.replace(/postgres(ql)?:\/\/\S+/g, "***") }, { status: 500 });
  }
}
