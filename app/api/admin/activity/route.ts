import { requireKoyalAdminSession } from "@/lib/koyal-admin";
import { supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireKoyalAdminSession(request);
    if (!user) return Response.json({ error: "Admin verification is required." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    const url = new URL(request.url);
    const start = url.searchParams.get("start") || "";
    const end = url.searchParams.get("end") || "";
    const action = url.searchParams.get("action") || "";
    const validDate = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!validDate(start) || !validDate(end) || (start && end && start > end)) {
      return Response.json({ error: "Choose a valid date range." }, { status: 400 });
    }
    const filters = [
      "select=id,admin_email,action,details,created_at",
      "order=created_at.desc",
      "limit=100",
      start ? `created_at=gte.${encodeURIComponent(new Date(`${start}T00:00:00+05:30`).toISOString())}` : "",
      end ? `created_at=lt.${encodeURIComponent(new Date(new Date(`${end}T00:00:00+05:30`).getTime() + 86400000).toISOString())}` : "",
      action ? `action=ilike.*${encodeURIComponent(action)}*` : "",
    ].filter(Boolean);
    const logs = await supabaseRequest(`koyal_admin_activity_logs?${filters.join("&")}`);
    return Response.json({ logs: logs || [], readOnly: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not load the immutable admin activity log." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
