import { requireKoyalAdminSession } from "@/lib/koyal-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireKoyalAdminSession(request);
    if (!user) return Response.json({ error: "Admin verification is required." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    const url = new URL(request.url);
    const start = url.searchParams.get("start") || "";
    const end = url.searchParams.get("end") || "";
    const validDate = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!validDate(start) || !validDate(end) || (start && end && start > end)) {
      return Response.json({ error: "Choose a valid date range." }, { status: 400 });
    }

    // Metrics are intentionally null until each production table's schema and
    // source-of-truth rules have been verified; never display invented totals.
    return Response.json({
      range: { start, end },
      metrics: {
        totalUsers: null,
        revenuePaise: null,
        activeSubscriptions: null,
        pendingPayments: null,
        totalFeathers: null,
        activePartners: null,
      },
      charts: { revenue: [], userGrowth: [], subscriptionDistribution: [], paymentSummary: [] },
      recentActivity: [],
      services: { database: "connected", authentication: "connected", paymentProvider: "not_checked", aiService: "not_checked" },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not load the admin overview." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
