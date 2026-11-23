import { route, body, str, ApiError } from "@/lib/api";
import { requireUser, can } from "@/lib/auth";
import { getSale, editSale, type SaleInput } from "@/lib/sales";

export const GET = route(async (_req, { params }) => {
  const user = await requireUser("ventas.crear", "ventas.ver_todas");
  const { id } = await params;
  const s = await getSale(id);
  if (!s) throw new ApiError(404, "La venta no existe.");
  if (!can(user, "ventas.ver_todas") && s.user_id !== user.id) throw new ApiError(403, "No tenés permiso.");
  return s;
});

export const PUT = route(async (req, { params }) => {
  const user = await requireUser("ventas.editar");
  const { id } = await params;
  const b = await body<SaleInput & { reason: string }>(req);
  const reason = str(b.reason, "motivo de la edición", { max: 300 })!;
  return editSale(user, id, b, reason);
});
