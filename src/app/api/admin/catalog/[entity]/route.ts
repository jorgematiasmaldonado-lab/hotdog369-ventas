import { sql } from "@/lib/db";
import { route, body } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { schemaOk } from "@/lib/schema";
import { getCatalog, parseCatalog, CATALOGS } from "@/lib/catalogs";

export const GET = route(async (_req, { params }) => {
  await requireUser("productos.gestionar");
  const { entity } = await params;
  const def = getCatalog(entity, await schemaOk());
  const rows = (await sql.unsafe(`SELECT * FROM ${def.table} ORDER BY ${def.order}`))
    .map((r) => (typeof r.start_time === "string" ? { ...r, start_time: r.start_time.slice(0, 5) } : r));
  // opciones de selects relacionados
  const refs: Record<string, unknown[]> = {};
  for (const f of Object.values(def.fields)) {
    if (f.ref && CATALOGS[f.ref]) refs[f.ref] = await sql.unsafe(`SELECT id, name FROM ${CATALOGS[f.ref].table} ORDER BY ${CATALOGS[f.ref].order}`);
  }
  return { def: { label: def.label, fields: def.fields }, rows, refs };
});

export const POST = route(async (req, { params }) => {
  const user = await requireUser("productos.gestionar");
  const { entity } = await params;
  const def = getCatalog(entity, await schemaOk());
  const data = parseCatalog(def, await body(req));
  return sql.begin(async (tx) => {
    const [row] = await tx`INSERT INTO ${tx(def.table)} ${tx(data)} RETURNING *`;
    if (entity === "products") await tx`INSERT INTO product_price_history (product_id, old_price, new_price, changed_by) VALUES (${row.id}, NULL, ${row.price}, ${user.id})`;
    await audit(tx, user.id, "crear", entity, row.id, undefined, row);
    return row;
  });
});
