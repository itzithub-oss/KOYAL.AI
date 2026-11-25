import { requireKoyalAdminSession, writeAdminLog } from "@/lib/koyal-admin";
import { supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

const PLAN_PRICES: Record<string, number> = { "Let It": 7000, Care: 12000, Elite: 22000, Supreme: 40000 };
const VALID_PLANS = new Set(Object.keys(PLAN_PRICES));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type PaidRow = { id: string; user_id: string; plan_name: string | null; amount_paise: number; created_at: string; cashfree_order_id?: string | null };
type CouponRow = { id: string; user_id: string; plan_name: string; coupon_code: string; redeemed_at: string; expires_at: string };
type ManualRow = { id: string; user_id: string; plan_name: string; starts_at: string; expires_at: string; is_active: boolean; reason: string; created_at: string };

function validId(value: unknown): value is string { return typeof value === "string" && UUID.test(value); }
function cleanReason(value: unknown) { return typeof value === "string" ? value.trim().slice(0, 500) : ""; }

export async function GET(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    const search = (new URL(request.url).searchParams.get("search") || "").trim().toLowerCase().slice(0, 120);
    const [paidRows, couponRows, manualRows] = await Promise.all([
      supabaseRequest("koyal_payment_orders?select=id,user_id,plan_name,amount_paise,created_at,cashfree_order_id&order_type=eq.subscription&payment_status=eq.PAID&order=created_at.asc&limit=2000") as Promise<PaidRow[]>,
      supabaseRequest("koyal_coupon_redemptions?select=id,user_id,plan_name,coupon_code,redeemed_at,expires_at&order=redeemed_at.asc&limit=2000") as Promise<CouponRow[]>,
      supabaseRequest("koyal_admin_manual_subscriptions?select=id,user_id,plan_name,starts_at,expires_at,is_active,reason,created_at&order=created_at.desc&limit=2000") as Promise<ManualRow[]>,
    ]);
    const now = Date.now();
    const paidExpiryByUser = new Map<string, number>();
    const entries: Array<{ id: string; userId: string; plan: string; source: "Paid" | "Coupon" | "Admin"; reference: string; startedAt: string; expiresAt: string; status: "Current" | "Expired" | "Inactive"; reason?: string; createdAt?: string }> = [];
    for (const row of paidRows || []) {
      if (!row.user_id || !row.plan_name || PLAN_PRICES[row.plan_name] !== Number(row.amount_paise)) continue;
      const createdAt = Date.parse(row.created_at);
      if (!Number.isFinite(createdAt)) continue;
      const startAt = Math.max(createdAt, paidExpiryByUser.get(row.user_id) || 0);
      const expiry = startAt + 30 * 24 * 60 * 60 * 1000;
      paidExpiryByUser.set(row.user_id, expiry);
      entries.push({ id: `paid-${row.id}`, userId: row.user_id, plan: row.plan_name, source: "Paid", reference: row.cashfree_order_id || row.id, startedAt: new Date(startAt).toISOString(), expiresAt: new Date(expiry).toISOString(), status: expiry > now ? "Current" : "Expired", createdAt: row.created_at });
    }
    for (const row of couponRows || []) {
      const expiry = Date.parse(row.expires_at), redeemed = Date.parse(row.redeemed_at);
      if (!row.user_id || !row.plan_name || !Number.isFinite(expiry) || !Number.isFinite(redeemed)) continue;
      entries.push({ id: `coupon-${row.id}`, userId: row.user_id, plan: row.plan_name, source: "Coupon", reference: row.coupon_code, startedAt: new Date(expiry - 30 * 24 * 60 * 60 * 1000).toISOString(), expiresAt: new Date(expiry).toISOString(), status: expiry > now ? "Current" : "Expired", createdAt: row.redeemed_at });
    }
    for (const row of manualRows || []) {
      const expiry = Date.parse(row.expires_at), started = Date.parse(row.starts_at);
      if (!row.user_id || !row.plan_name || !Number.isFinite(expiry) || !Number.isFinite(started)) continue;
      entries.push({ id: `admin-${row.id}`, userId: row.user_id, plan: row.plan_name, source: "Admin", reference: row.id, startedAt: new Date(started).toISOString(), expiresAt: new Date(expiry).toISOString(), status: !row.is_active ? "Inactive" : expiry > now ? "Current" : "Expired", reason: row.reason, createdAt: row.created_at });
    }
    const effectiveEntryByUser = new Map<string, string>();
    const latestActiveManual = new Map<string, { id: string; createdAt: number }>();
    for (const item of entries) {
      if (item.source !== "Admin" || item.status !== "Current") continue;
      const createdAt = Date.parse(item.createdAt || item.startedAt);
      const previous = latestActiveManual.get(item.userId);
      if (!previous || createdAt > previous.createdAt) latestActiveManual.set(item.userId, { id: item.id, createdAt });
    }
    for (const [userId, manual] of latestActiveManual) effectiveEntryByUser.set(userId, manual.id);
    const latestPaidOrCoupon = new Map<string, { id: string; expiry: number }>();
    for (const item of entries) {
      if (item.source === "Admin" || item.status === "Inactive") continue;
      const expiry = Date.parse(item.expiresAt), previous = latestPaidOrCoupon.get(item.userId);
      if (expiry > now && (!previous || expiry > previous.expiry)) latestPaidOrCoupon.set(item.userId, { id: item.id, expiry });
    }
    for (const [userId, item] of latestPaidOrCoupon) if (!effectiveEntryByUser.has(userId)) effectiveEntryByUser.set(userId, item.id);
    for (const item of entries) if (item.status !== "Inactive") item.status = effectiveEntryByUser.get(item.userId) === item.id ? "Current" : "Expired";
    const filtered = entries.filter(item => !search || [item.userId, item.plan, item.source, item.reference, item.reason || ""].join(" ").toLowerCase().includes(search)).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
    return Response.json({ subscriptions: filtered.slice(0, 1000), totalRecords: entries.length, activeUsers: effectiveEntryByUser.size, readOnly: false, truncated: entries.length > 1000 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL admin subscriptions failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not load subscription records. Apply the admin manual subscriptions migration and check the subscription tables." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const userId = body.userId, plan = typeof body.plan === "string" ? body.plan.trim() : "";
    const expiry = typeof body.expiresAt === "string" ? Date.parse(body.expiresAt) : NaN;
    const reason = cleanReason(body.reason);
    if (!validId(userId)) return Response.json({ error: "Enter a valid user UUID." }, { status: 400 });
    if (!VALID_PLANS.has(plan)) return Response.json({ error: "Choose a valid subscription plan." }, { status: 400 });
    if (!Number.isFinite(expiry) || expiry <= Date.now()) return Response.json({ error: "Expiry must be a future date and time." }, { status: 400 });
    if (!reason) return Response.json({ error: "A reason is required for every manual subscription." }, { status: 400 });
    const created = await supabaseRequest("koyal_admin_manual_subscriptions", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ user_id: userId, plan_name: plan, starts_at: new Date().toISOString(), expires_at: new Date(expiry).toISOString(), is_active: true, reason, created_by: admin.email }) }) as Array<{ id: string }>;
    const id = created?.[0]?.id;
    await writeAdminLog(admin, "subscription_manual_created", { subscriptionId: id, userId, plan, expiresAt: new Date(expiry).toISOString(), reason });
    return Response.json({ success: true, id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL admin manual subscription creation failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not create manual subscription. Ensure the admin manual subscriptions migration has been applied." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403 });
    const body = await request.json().catch(() => ({})), id = typeof body.id === "string" ? body.id.trim() : "";
    if (!validId(id)) return Response.json({ error: "A valid manual subscription ID is required." }, { status: 400 });
    const rows = await supabaseRequest(`koyal_admin_manual_subscriptions?select=id,user_id,plan_name,expires_at,is_active,reason&id=eq.${encodeURIComponent(id)}&limit=1`) as ManualRow[];
    const existing = rows?.[0];
    if (!existing) return Response.json({ error: "Manual subscription not found. Paid and coupon records cannot be edited here." }, { status: 404 });
    const updates: Record<string, unknown> = {};
    if (body.plan !== undefined) {
      const plan = typeof body.plan === "string" ? body.plan.trim() : "";
      if (!VALID_PLANS.has(plan)) return Response.json({ error: "Choose a valid subscription plan." }, { status: 400 });
      updates.plan_name = plan;
    }
    if (body.expiresAt !== undefined) {
      const expiry = typeof body.expiresAt === "string" ? Date.parse(body.expiresAt) : NaN;
      if (!Number.isFinite(expiry)) return Response.json({ error: "Enter a valid expiry date." }, { status: 400 });
      updates.expires_at = new Date(expiry).toISOString();
    }
    if (body.reason !== undefined) {
      const reason = cleanReason(body.reason);
      if (!reason) return Response.json({ error: "A reason is required." }, { status: 400 });
      updates.reason = reason;
    }
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") return Response.json({ error: "isActive must be true or false." }, { status: 400 });
      updates.is_active = body.isActive;
    }
    if (!Object.keys(updates).length) return Response.json({ error: "No subscription changes were supplied." }, { status: 400 });
    updates.updated_at = new Date().toISOString();
    await supabaseRequest(`koyal_admin_manual_subscriptions?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(updates) });
    await writeAdminLog(admin, body.isActive === false ? "subscription_manual_deactivated" : "subscription_manual_updated", { subscriptionId: id, userId: existing.user_id, changes: updates });
    return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL admin manual subscription update failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not update manual subscription." }, { status: 503 });
  }
}
