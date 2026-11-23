import { sql } from "@/lib/db";
import { route, body, ApiError } from "@/lib/api";
import { requireUser, requireModule } from "@/lib/auth";
import { clockIn, clockOut } from "@/lib/hours";

export const POST = route(async (req) => {
  const user = await requireUser("horas.fichar");
  await requireModule("personal");
  const b = await body(req);
  if (b.action === "in") {
    const e = await sql.begin((tx) => clockIn(tx, user.id));
    if (!e) throw new ApiError(409, "Ya tenés una entrada fichada.");
    return e;
  }
  if (b.action === "out") {
    const e = await sql.begin((tx) => clockOut(tx, user.id));
    if (!e) throw new ApiError(409, "No tenés una entrada abierta.");
    return e;
  }
  throw new ApiError(400, "Acción inválida.");
});
