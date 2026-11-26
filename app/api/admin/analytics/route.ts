import { requireKoyalAdminSession } from "@/lib/koyal-admin";
import { requiredEnv, supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

type Order = { id: string; user_id: string; amount_paise: number; payment_status: string; created_at: string; order_type: string; plan_name: string | null; feather_quantity: number | null };
type AuthUser = { id: string; created_at?: string | null };
const PLAN_PRICES: Record<string, number> = { "Let It": 7000, Care: 12000, Elite: 22000, Supreme: 40000 };

function dateBounds(start: string, end: string) {
  const lower = start ? new Date(`${start}T00:00:00+05:30`).getTime() : 0;
  const upper = end ? new Date(`${end}T00:00:00+05:30`).getTime() + 86400000 : Number.POSITIVE_INFINITY;
  return { lower, upper };
}

async function getAuthUsers() {
  const base = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${base}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: { apikey: key, ...(key.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${key}` }) },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Supabase Auth user listing failed.");
  const data = await response.json().catch(() => ({}));
  return { users: (Array.isArray(data.users) ? data.users : []) as AuthUser[], total: Number.isFinite(Number(data.total)) ? Number(data.total) : null };
}

export async function GET(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403 });
    const params = new URL(request.url).searchParams;
    const start = params.get("start") || "";
    const end = params.get("end") || "";
    const valid = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!valid(start) || !valid(end) || (start && end && start > end)) return Response.json({ error: "Choose a valid date range." }, { status: 400 });
    const { lower, upper } = dateBounds(start, end);
    const [auth, orders, walletsResult, partnersResult, couponsResult] = await Promise.all([
      getAuthUsers(),
      supabaseRequest("koyal_payment_orders?select=id,user_id,amount_paise,payment_status,created_at,order_type,plan_name,feather_quantity&order=created_at.asc&limit=10000") as Promise<Order[]>,
      supabaseRequest("koyal_feather_wallets?select=user_id,balance&limit=10000")
        .then(value => ({ rows: value as Array<{ user_id: string; balance: number }>, error: null as string | null }))
        .catch(error => ({ rows: [] as Array<{ user_id: string; balance: number }>, error: error instanceof Error ? error.message : "Wallet query failed" })),
      supabaseRequest("koyal_partner_directory?select=id,status&limit=10000")
        .then(value => ({ rows: value as Array<{ id: string; status: string }>, error: null as string | null }))
        .catch(error => ({ rows: [] as Array<{ id: string; status: string }>, error: error instanceof Error ? error.message : "Partner query failed" })),
      supabaseRequest(`koyal_coupon_redemptions?select=user_id,plan_name,expires_at&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=10000`)
        .then(value => ({ rows: value as Array<{ user_id: string; plan_name: string; expires_at: string }>, error: null as string | null }))
        .catch(error => ({ rows: [] as Array<{ user_id: string; plan_name: string; expires_at: string }>, error: error instanceof Error ? error.message : "Coupon query failed" })),
    ]);
    const wallets = walletsResult.rows;
    const partnerRows = partnersResult.rows;
    const couponRows = couponsResult.rows;
    const inRange = (date: string) => {
      const time = Date.parse(date);
      return Number.isFinite(time) && time >= lower && time < upper;
    };
    const selected = (orders || []).filter(order => inRange(order.created_at));
    const paid = selected.filter(order => String(order.payment_status).toUpperCase() === "PAID");
    const revenuePaise = paid.reduce((sum, order) => sum + (Number(order.amount_paise) || 0), 0);
    const revenueByDay = new Map<string, number>();
    const planRevenue: Record<string, number> = {};
    const paymentSummary: Record<string, number> = {};
    let feathersPurchased = 0;
    for (const order of selected) {
      const status = String(order.payment_status || "UNKNOWN").toUpperCase();
      paymentSummary[status] = (paymentSummary[status] || 0) + 1;
      if (status !== "PAID") continue;
      const day = order.created_at.slice(0, 10);
      revenueByDay.set(day, (revenueByDay.get(day) || 0) + (Number(order.amount_paise) || 0));
      if (order.order_type === "subscription" && order.plan_name) planRevenue[order.plan_name] = (planRevenue[order.plan_name] || 0) + (Number(order.amount_paise) || 0);
      if (order.order_type === "feathers") feathersPurchased += Number(order.feather_quantity) || 0;
    }
    const localDay = (value: string) => new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const userGrowth = new Map<string, number>();
    for (const user of auth.users) {
      if (user.created_at && inRange(user.created_at)) {
        const day = localDay(user.created_at);
        userGrowth.set(day, (userGrowth.get(day) || 0) + 1);
      }
    }
    const subscriptionExpiry = new Map<string, { expiresAt: number; plan: string }>();
    for (const order of orders || []) {
      if (order.order_type !== "subscription" || String(order.payment_status).toUpperCase() !== "PAID" || !order.plan_name || PLAN_PRICES[order.plan_name] !== Number(order.amount_paise)) continue;
      const createdAt = Date.parse(order.created_at);
      if (!Number.isFinite(createdAt)) continue;
      const previous = subscriptionExpiry.get(order.user_id);
      const startAt = Math.max(createdAt, previous?.expiresAt || 0);
      subscriptionExpiry.set(order.user_id, { expiresAt: startAt + 30 * 24 * 60 * 60 * 1000, plan: order.plan_name });
    }
    for (const coupon of couponRows || []) {
      const expiry = Date.parse(coupon.expires_at);
      const previous = subscriptionExpiry.get(coupon.user_id);
      if (Number.isFinite(expiry) && expiry > (previous?.expiresAt || 0)) subscriptionExpiry.set(coupon.user_id, { expiresAt: expiry, plan: coupon.plan_name });
    }
    const activeSubscriptionRows = [...subscriptionExpiry.values()].filter(item => item.expiresAt > Date.now());
    const subscriptionDistribution: Record<string, number> = {};
    for (const item of activeSubscriptionRows) subscriptionDistribution[item.plan] = (subscriptionDistribution[item.plan] || 0) + 1;
    const partnerCount = (partnerRows || []).filter(row => row.status === "active").length;
    return Response.json({
      range: { start, end },
      metrics: {
        totalUsers: auth.total,
        newUsersInRetrievedSample: [...userGrowth.values()].reduce((sum, count) => sum + count, 0),
        revenuePaise,
        paidOrders: paid.length,
        activeSubscriptions: activeSubscriptionRows.length,
        pendingPayments: selected.filter(order => String(order.payment_status).toUpperCase() === "PENDING").length,
        totalFeathers: (wallets || []).reduce((sum, wallet) => sum + (Number(wallet.balance) || 0), 0),
        feathersPurchased,
        activePartners: partnerCount,
      },
      charts: {
        revenue: [...revenueByDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, amountPaise]) => ({ date, amountPaise })),
        userGrowth: [...userGrowth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, users]) => ({ date, users })),
        planRevenue: Object.entries(planRevenue).map(([plan, amountPaise]) => ({ plan, amountPaise })),
        paymentSummary: Object.entries(paymentSummary).map(([status, count]) => ({ status, count })),
        subscriptionDistribution: Object.entries(subscriptionDistribution).map(([plan, users]) => ({ plan, users })),
      },
      coverage: {
        authUsersRetrieved: auth.users.length,
        authUserSampleLimit: 1000,
        ordersRetrieved: (orders || []).length,
        orderSampleLimit: 10000,
        walletsRetrieved: wallets.length,
        walletSampleLimit: 10000,
        partnerDirectoryAvailable: !partnersResult.error,
        couponRedemptionsAvailable: !couponsResult.error,
        walletDataAvailable: !walletsResult.error,
        warnings: [
          partnersResult.error ? "Partner directory unavailable; run migration 202611250004_koyal_partner_directory.sql and verify service-role access." : null,
          couponsResult.error ? "Coupon redemption data unavailable." : null,
          walletsResult.error ? "Feather wallet data unavailable." : null,
        ].filter(Boolean),
        usageAnalytics: "not_available_without_event_tracking"
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL admin analytics failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not load analytics. Confirm the partner directory migration and Supabase permissions." }, { status: 503 });
  }
}
