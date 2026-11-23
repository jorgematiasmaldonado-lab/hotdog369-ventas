import { redirect } from "next/navigation";
import { getUser, can } from "@/lib/auth";

// Inicio según el rol: quien vende va a la caja; quien mira, al panel
export default async function Home() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (can(user, "ventas.crear")) redirect("/vender");
  if (can(user, "dashboard.ver")) redirect("/dashboard");
  if (can(user, "ventas.ver_todas")) redirect("/ventas");
  redirect("/acerca");
}
