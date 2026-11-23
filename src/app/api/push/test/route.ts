import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { sendPush } from "@/lib/push";

// Aviso de prueba a los equipos del usuario actual
export const POST = route(async () => {
  const user = await requireUser("stock.ver", "stock.gestionar");
  return sendPush({ title: "HOT DOG 369 · Aviso de prueba", body: "¡Listo! En este equipo vas a recibir los avisos de stock bajo.", url: "/stock", tag: "prueba" }, { userId: user.id });
});
