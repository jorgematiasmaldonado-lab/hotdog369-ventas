import { sql } from "@/lib/db";
import { route, body, id, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getCatalog, parseCatalog } from "@/lib/catalogs";

export const PUT = route(async (req, { params }) => {
  const user = await requireUser("productos.gestionar");
  const p = await params;
  const def = getCatalog(p.entity);
  const rid = id(p);
  const data = parseCatalog(def, await body(req), true);
  if (!Object.keys(data).length) throw new ApiError(400, "No hay cambios.");
  return sql.begin(async (tx) => {
    const [before] = await tx`SELECT * FROM ${tx(def.table)} WHERE id = ${rid} FOR UPDATE`;
    if (!before) throw new ApiError(404, "No existe.");
    const [row] = await tx`UPDATE ${tx(def.table)} SET ${tx(data)} WHERE id = ${rid} RETURNING *`;
    if (p.entity === "products" && before.price !== row.price)
      await tx`INSERT INTO product_price_history (product_id, old_price, new_price, changed_by) VALUES (${rid}, ${before.price}, ${row.price}, ${user.id})`;
    await audit(tx, user.id, "editar", p.entity, rid, before, row);
    return row;
  });
});

// Elimina; si el registro ya se usó (ventas, etc.) lo desactiva para conservar el historial
export const DELETE = route(async (_req, { params }) => {
  const user = await requireUser("productos.gestionar");
  const p = await params;
  const def = getCatalog(p.entity);
  const rid = id(p);
  const [before] = await sql`SELECT * FROM ${sql(def.table)} WHERE id = ${rid}`;
  if (!before) throw new ApiError(404, "No existe.");
  try {
    await sql.begin(async (tx) => {
      if (p.entity === "products") await tx`DELETE FROM product_price_history WHERE product_id = ${rid}`;
      await tx`DELETE FROM ${tx(def.table)} WHERE id = ${rid}`;
      await audit(tx, user.id, "eliminar", p.entity, rid, before);
    });
    return { deleted: true };
  } catch (e) {
    if ((e as { code?: string }).code !== "23503") throw e;
    await sql`UPDATE ${sql(def.table)} SET active = false WHERE id = ${rid}`;
    await audit(sql, user.id, "desactivar", p.entity, rid, before, { ...before, active: false }, "En uso: se desactivó en lugar de eliminar");
    return { deleted: false, deactivated: true };
  }
});
