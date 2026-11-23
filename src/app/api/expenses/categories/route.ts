import { sql } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const GET = route(async () => {
  await requireUser("gastos.ver", "gastos.gestionar");
  return sql`SELECT id, name FROM expense_categories WHERE active ORDER BY sort, name`;
});
