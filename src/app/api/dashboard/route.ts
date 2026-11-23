import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { resolveRange } from "@/lib/dates";
import { dashboard } from "@/lib/reports";

export const GET = route(async (req) => {
  await requireUser("dashboard.ver");
  const u = new URL(req.url);
  const { from, to } = resolveRange(u.searchParams.get("range"), u.searchParams.get("from"), u.searchParams.get("to"));
  return dashboard(from, to);
});
