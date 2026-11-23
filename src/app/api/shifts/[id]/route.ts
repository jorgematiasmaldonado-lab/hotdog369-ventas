import { route, id, ApiError } from "@/lib/api";
import { requireUser, can } from "@/lib/auth";
import { shiftSummary } from "@/lib/shifts";

export const GET = route(async (_req, { params }) => {
  const user = await requireUser("turnos.operar", "turnos.ver_todos");
  const summary = await shiftSummary(id(await params));
  if (!summary) throw new ApiError(404, "El turno no existe.");
  if (!can(user, "turnos.ver_todos") && summary.shift.user_id !== user.id) throw new ApiError(403, "No tenés permiso para ver este turno.");
  return summary;
});
