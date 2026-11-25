import { requireKoyalAdminSession } from "@/lib/koyal-admin";
import { requiredEnv, supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

type PaymentOrder = {
  id: string;
  user_id: string;
  amount_paise: number;
  payment_status: string;
  created_at: string;
  order_type: string;
  plan_name: string | null;
};

const PLAN_PRICES: Record<string, number> = { "Let It": 7000, Care: 12000, Elite: 22000, Supreme: 40000 };

function dateBounds(start: string, end: string) {
  const lower = start ? new Date(`${start}T00:00:00+05:30`).toISOString() : "";
  const upperDate = end ? new Date(new Date(`${end}T00:00:00+05:30`).getTime() + 24 * 60 * 60 * 1000).toISOString() : "";
  return { lower, upperDate };
}

async function getUserCount(): Promise<number | null> {
  try {
    const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
    const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const response = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: { apikey: key, ...(key.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${key}` }) },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => ({}));
    return Number.isFinite(Number(data.total)) ? Number(data.total) : null;
  } catch { return null; }
}

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

    const { lower, upperDate } = dateBounds(start, end);
    const orders = await supabaseRequest(
      "koyal_payment_orders?select=id,user_id,amount_paise,payment_status,created_at,order_type,plan_name&order=created_at.asc&limit=10000",
    ) as PaymentOrder[];
    const now = Date.now();
    const inRange = (order: PaymentOrder) => {
      const timestamp = Date.parse(order.created_at);
      return Number.isFinite(timestamp) && (!lower || timestamp >= Date.parse(lower)) && (!upperDate || timestamp < Date.parse(upperDate));
    };
    const selectedOrders = (orders || []).filter(inRange);
    const paidOrders = selectedOrders.filter(order => order.payment_status === "PAID");
    const pendingPayments = selectedOrders.filter(order => order.payment_status === "PENDING").length;
    const revenuePaise = paidOrders.reduce((sum, order) => sum + (Number(order.amount_paise) || 0), 0);

    const subscriptionExpiry = new Map<string, { expiresAt: number; plan: string }>();
    for (const order of orders || []) {
      if (order.order_type !== "subscription" || order.payment_status !== "PAID" || !order.plan_name || PLAN_PRICES[order.plan_name] !== Number(order.amount_paise)) continue;
      const createdAt = Date.parse(order.created_at);
      if (!Number.isFinite(createdAt)) continue;
      const previous = subscriptionExpiry.get(order.user_id);
      const startAt = Math.max(createdAt, previous?.expiresAt || 0);
      subscriptionExpiry.set(order.user_id, { expiresAt: startAt + 30 * 24 * 60 * 60 * 1000, plan: order.plan_name });
    }

    let couponRows: Array<{ user_id: string; plan_name: string; expires_at: string }> = [];
    try {
      couponRows = await supabaseRequest(
        `koyal_coupon_redemptions?select=user_id,plan_name,expires_at&expires_at=gt.${encodeURIComponent(new Date(now).toISOString())}&limit=10000`,
      ) as Array<{ user_id: string; plan_name: string; expires_at: string }>;
    } catch { couponRows = []; }
    for (const coupon of couponRows || []) {
      const expiry = Date.parse(coupon.expires_at);
      const previous = subscriptionExpiry.get(coupon.user_id);
      if (Number.isFinite(expiry) && expiry > (previous?.expiresAt || 0)) {
        subscriptionExpiry.set(coupon.user_id, { expiresAt: expiry, plan: coupon.plan_name });
      }
    }
    const activeSubscriptions = [...subscriptionExpiry.values()].filter(item => item.expiresAt > now).length;
    const distribution: Record<string, number> = {};
    for (const item of subscriptionExpiry.values()) if (item.expiresAt > now) distribution[item.plan] = (distribution[item.plan] || 0) + 1;

    const revenueByDay = new Map<string, number>();
    const paymentSummary: Record<string, number> = {};
    for (const order of selectedOrders) {
      const status = String(order.payment_status || "UNKNOWN").toUpperCase();
      paymentSummary[status] = (paymentSummary[status] || 0) + 1;
      if (status === "PAID") {
        const day = order.created_at.slice(0, 10);
        revenueByDay.set(day, (revenueByDay.get(day) || 0) + (Number(order.amount_paise) || 0));
      }
    }

    let recentActivity: Array<{ id: string; admin_email: string; action: string; details: Record<string, unknown>; created_at: string }> = [];
    try {
      recentActivity = await supabaseRequest("koyal_admin_activity_logs?select=id,admin_email,action,details,created_at&order=created_at.desc&limit=8") as typeof recentActivity;
    } catch { recentActivity = []; }

    const totalUsers = await getUserCount();
    return Response.json({
      range: { start, end },
      metrics: {
        totalUsers,
        revenuePaise,
        activeSubscriptions,
        pendingPayments,
        totalFeathers: null,
        activePartners: null,
      },
      charts: {
        revenue: [...revenueByDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, amountPaise]) => ({ date, amountPaise })),
        userGrowth: [],
        subscriptionDistribution: Object.entries(distribution).map(([plan, users]) => ({ plan, users })),
        paymentSummary: Object.entries(paymentSummary).map(([status, count]) => ({ status, count })),
      },
      recentActivity,
      services: { database: "connected", authentication: "connected", paymentProvider: "not_checked", aiService: "not_checked" },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL admin overview failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not load the admin overview. Check the admin database permissions and try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
