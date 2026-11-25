import { getActiveSubscription, getAuthenticatedUser, supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Please log in to check your subscription." }, { status: 401 });

    const [paid, couponRows, manualRows] = await Promise.all([
      getActiveSubscription(user.id),
      supabaseRequest(
        `koyal_coupon_redemptions?select=plan_name,expires_at&user_id=eq.${encodeURIComponent(user.id)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&order=expires_at.desc&limit=1`,
      ) as Promise<Array<{ plan_name: string; expires_at: string }>>,
      supabaseRequest(
        `koyal_admin_manual_subscriptions?select=plan_name,expires_at&user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&order=created_at.desc&limit=1`,
      ) as Promise<Array<{ plan_name: string; expires_at: string }>>,
    ]);

    const coupon = couponRows?.[0];
    const manual = manualRows?.[0];
    const paidExpiry = paid.expiresAt ? Date.parse(paid.expiresAt) : 0;
    const couponExpiry = coupon?.expires_at ? Date.parse(coupon.expires_at) : 0;
    const active = manual
      ? { plan: manual.plan_name, expiresAt: manual.expires_at }
      : coupon && couponExpiry > paidExpiry
        ? { plan: coupon.plan_name, expiresAt: coupon.expires_at }
        : paid;

    return Response.json(active, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL subscription lookup:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not load your subscription status." }, { status: 500 });
  }
}
