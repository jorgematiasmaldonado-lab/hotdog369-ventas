import { sql } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

// Descarga un respaldo completo (.json.gz) y registra la fecha del último respaldo
export const GET = route(async () => {
  const user = await requireUser("respaldo.gestionar");
  const { file, counts, created_at } = await createBackup();
  await sql`INSERT INTO settings (key, value) VALUES ('last_backup_at', ${sql.json(created_at)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  await audit(sql, user.id, "respaldo", "base", null, undefined, { ventas: counts.sales ?? 0, bytes: file.length });
  const stamp = new Date().toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 16).replace(/[: ]/g, (c) => (c === " " ? "_" : "-"));
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="hotdog369_respaldo_${stamp}.json.gz"`,
      "Cache-Control": "no-store",
    },
  });
});
