import { sql } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const GET = route(async (req) => {
  await requireUser("auditoria.ver");
  const u = new URL(req.url);
  const entity = u.searchParams.get("entity");
  const before = Number(u.searchParams.get("before")) || null;
  return sql`
    SELECT a.id, a.at, a.action, a.entity, a.entity_id, a.before, a.after, a.notes, u.name AS user_name
    FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
    WHERE TRUE ${entity ? sql`AND a.entity = ${entity}` : sql``} ${before ? sql`AND a.id < ${before}` : sql``}
    ORDER BY a.id DESC LIMIT 100`;
});
