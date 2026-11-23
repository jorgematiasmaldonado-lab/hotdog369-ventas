import { sql } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const GET = route(async () => {
  await requireUser("config.gestionar");
  return sql`SELECT * FROM modules ORDER BY sort`;
});
