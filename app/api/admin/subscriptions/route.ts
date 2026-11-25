import { requireKoyalAdminSession } from "@/lib/koyal-admin";
import { supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

const PLAN_PRICES: Record<string, number> = {
  "Let It": 7000,
  Care: 12000,
  Elite: 22000,
  Supreme: 40000,
};

type PaidRow = {
  id: string;
  user_id: string;
  plan_name: string | null;
  amount_paise: number;
  created_at: string;
  cashfree_order_id?: string | null;
};

type CouponRow = {
  id: string;
  user_id: string;
  plan_name: string;
  coupon_code: string;
  redeemed_at: string;
  expires_at: string;
};

export async function GET(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) {
      return Response.json({ error: "Admin verification is required." }, {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").trim().toLowerCase().slice(0, 120);

    const [paidRows, couponRows] = await Promise.all([
      supabaseRequest(
        "koyal_payment_orders?select=id,user_id,plan_name,amount_paise,created_at,cashfree_order_id&order_type=eq.subscription&payment_status=eq.PAID&order=created_at.asc&limit=2000",
      ) as Promise<PaidRow[]>,
      supabaseRequest(
        "koyal_coupon_redemptions?select=id,user_id,plan_name,coupon_code,redeemed_at,expires_at&order=redeemed_at.asc&limit=2000",
      ) as Promise<CouponRow[]>,
    ]);

    const now = Date.now();
    const paidExpiryByUser = new Map<string, number>();
    const entries: Array<{
      id: string;
      userId: string;
      plan: string;
      source: "Paid" | "Coupon";
      reference: string;
      startedAt: string;
      expiresAt: string;
      status: "Current" | "Expired";
    }> = [];

    for (const row of paidRows || []) {
      if (!row.user_id || !row.plan_name || PLAN_PRICES[row.plan_name] !== Number(row.amount_paise)) continue;
      const createdAt = Date.parse(row.created_at);
      if (!Number.isFinite(createdAt)) continue;
      const previousExpiry = paidExpiryByUser.get(row.user_id) || 0;
      const startAt = Math.max(createdAt, previousExpiry);
      const expiry = startAt + 30 * 24 * 60 * 60 * 1000;
      paidExpiryByUser.set(row.user_id, expiry);
      entries.push({
        id: `paid-${row.id}`,
        userId: row.user_id,
        plan: row.plan_name,
        source: "Paid",
        reference: row.cashfree_order_id || row.id,
        startedAt: new Date(startAt).toISOString(),
        expiresAt: new Date(expiry).toISOString(),
        status: expiry > now ? "Current" : "Expired",
      });
    }

    for (const row of couponRows || []) {
      const expiry = Date.parse(row.expires_at);
      const redeemed = Date.parse(row.redeemed_at);
      if (!row.user_id || !row.plan_name || !Number.isFinite(expiry) || !Number.isFinite(redeemed)) continue;
      entries.push({
        id: `coupon-${row.id}`,
        userId: row.user_id,
        plan: row.plan_name,
        source: "Coupon",
        reference: row.coupon_code,
        startedAt: new Date(expiry - 30 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(expiry).toISOString(),
        status: expiry > now ? "Current" : "Expired",
      });
    }

    const currentExpiryByUser = new Map<string, number>();
    for (const item of entries) {
      const expiry = Date.parse(item.expiresAt);
      if (expiry > now) currentExpiryByUser.set(item.userId, Math.max(currentExpiryByUser.get(item.userId) || 0, expiry));
    }
    for (const item of entries) {
      item.status = Date.parse(item.expiresAt) > now && Date.parse(item.expiresAt) === currentExpiryByUser.get(item.userId)
        ? "Current"
        : "Expired";
    }

    const filtered = entries
      .filter(item => !search || [item.userId, item.plan, item.source, item.reference].join(" ").toLowerCase().includes(search))
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));

    return Response.json({
      subscriptions: filtered.slice(0, 1000),
      totalRecords: entries.length,
      activeUsers: currentExpiryByUser.size,
      readOnly: true,
      truncated: entries.length > 1000,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL admin subscriptions failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not load subscription records. Check the subscription and coupon tables." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
