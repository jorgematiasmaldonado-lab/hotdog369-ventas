import { sql } from "@/lib/db";
import { route, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { readBackup, restoreBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Restaura un respaldo: reemplaza TODOS los datos actuales. Exige escribir RESTAURAR.
export const POST = route(async (req) => {
  const user = await requireUser("respaldo.gestionar");
  if (req.headers.get("x-confirmar") !== "RESTAURAR") throw new ApiError(400, "Falta la confirmación.");
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) throw new ApiError(400, "No se recibió ningún archivo.");
  if (buf.length > 4_000_000) throw new ApiError(413, "El archivo es demasiado grande (máx. 4 MB comprimido).");
  const data = readBackup(buf);
  const counts = await restoreBackup(data);
  await audit(sql, user.id, "restaurar", "base", null, undefined, { respaldo_del: data.created_at, ventas: counts.sales ?? 0 });
  return { ok: true, created_at: data.created_at, counts };
});
