import { requireKoyalAdminSession, writeAdminLog } from "@/lib/koyal-admin";
import { supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

const PLANS = new Set(["Let It", "Care", "Elite", "Supreme"]);
const BUILT_IN_CODES = new Set(["letitfree26", "carefree26", "elitefree26", "supremefree26", "cadet0117", "welcomebonus01"]);

export async function GET(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403 });
    const [coupons, redemptions] = await Promise.all([
      supabaseRequest("koyal_admin_coupons?select=code,plan_name,max_redemptions,redemption_count,expires_at,is_active,created_by,created_at&order=created_at.desc&limit=500"),
      supabaseRequest("koyal_coupon_redemptions?select=id,user_id,coupon_code,plan_name,redeemed_at,expires_at&order=redeemed_at.desc&limit=500"),
    ]);
    return Response.json({ coupons: coupons || [], redemptions: redemptions || [], readOnlyHistory: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown database error";
    console.error("KOYAL admin coupons failed:", detail);
    return Response.json({ error: "Could not load coupon records.", details: detail.slice(0, 400) }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim().toLowerCase() : "";
    const plan = typeof body.plan === "string" ? body.plan : "";
    const maxRedemptions = body.maxRedemptions === "" || body.maxRedemptions === null || body.maxRedemptions === undefined
      ? null : Number(body.maxRedemptions);
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (!/^[a-z0-9][a-z0-9_-]{3,39}$/.test(code)) return Response.json({ error: "Use 4–40 characters: lowercase letters, numbers, _ or -." }, { status: 400 });
    if (BUILT_IN_CODES.has(code)) return Response.json({ error: "That code is reserved for an existing KOYAL coupon." }, { status: 409 });
    if (!PLANS.has(plan)) return Response.json({ error: "Choose a valid subscription plan." }, { status: 400 });
    if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 1000000)) return Response.json({ error: "Redemption limit must be a whole number from 1 to 1,000,000." }, { status: 400 });
    if (body.expiresAt && (!expiresAt || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now())) return Response.json({ error: "Expiry must be a future date and time." }, { status: 400 });

    await supabaseRequest("koyal_admin_coupons", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ code, plan_name: plan, max_redemptions: maxRedemptions, expires_at: expiresAt?.toISOString() || null, is_active: true, created_by: admin.email || "admin" }),
    });
    await writeAdminLog(admin, "coupon_created", { code, plan, maxRedemptions, expiresAt: expiresAt?.toISOString() || null });
    return Response.json({ success: true, code }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/duplicate|unique/i.test(message)) return Response.json({ error: "That coupon code already exists." }, { status: 409 });
    console.error("KOYAL admin coupon creation failed:", message);
    return Response.json({ error: "Could not create the coupon. Confirm the migration has been run." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim().toLowerCase() : "";
    if (!code || typeof body.isActive !== "boolean") return Response.json({ error: "A coupon code and active status are required." }, { status: 400 });
    const rows = await supabaseRequest(`koyal_admin_coupons?code=eq.${encodeURIComponent(code)}&select=code&limit=1`) as Array<{ code: string }>;
    if (!rows?.length) return Response.json({ error: "Coupon not found." }, { status: 404 });
    await supabaseRequest(`koyal_admin_coupons?code=eq.${encodeURIComponent(code)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ is_active: body.isActive }),
    });
    await writeAdminLog(admin, body.isActive ? "coupon_enabled" : "coupon_disabled", { code });
    return Response.json({ success: true });
  } catch (error) {
    console.error("KOYAL admin coupon update failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not update coupon status." }, { status: 503 });
  }
}
