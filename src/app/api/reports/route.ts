import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { resolveRange } from "@/lib/dates";
import { reports } from "@/lib/reports";

export const GET = route(async (req) => {
  await requireUser("reportes.ver");
  const u = new URL(req.url);
  const { from, to } = resolveRange(u.searchParams.get("range") ?? "mes", u.searchParams.get("from"), u.searchParams.get("to"));
  return reports(from, to);
});
