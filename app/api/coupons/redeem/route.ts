import { getActiveSubscription, getAuthenticatedUser, supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

const COUPONS: Record<string, "Let It" | "Care" | "Elite" | "Supreme"> = {
  letitfree26: "Let It",
  carefree26: "Care",
  elitefree26: "Elite",
  supremefree26: "Supreme",
};

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Please log in before redeeming a coupon." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim().toLowerCase() : "";
    const plan = COUPONS[code];
    if (!plan) return Response.json({ error: "That coupon code is not valid." }, { status: 400 });

    const existing = await supabaseRequest(
      `koyal_coupon_redemptions?select=id&user_id=eq.${encodeURIComponent(user.id)}&coupon_code=eq.${encodeURIComponent(code)}&limit=1`,
    ) as Array<{ id: string }>;
    if (existing?.length) return Response.json({ error: "This coupon has already been redeemed by your account." }, { status: 409 });

    const activeCoupons = await supabaseRequest(
      `koyal_coupon_redemptions?select=expires_at&user_id=eq.${encodeURIComponent(user.id)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&order=expires_at.desc&limit=1`,
    ) as Array<{ expires_at: string }>;
    const paid = await getActiveSubscription(user.id);
    const paidExpiry = paid.expiresAt ? Date.parse(paid.expiresAt) : 0;
    const couponExpiry = activeCoupons?.[0]?.expires_at ? Date.parse(activeCoupons[0].expires_at) : 0;
    const startAt = Math.max(Date.now(), paidExpiry, couponExpiry);
    const expiresAt = new Date(startAt + 30 * 24 * 60 * 60 * 1000).toISOString();

    await supabaseRequest("koyal_coupon_redemptions", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: user.id, coupon_code: code, plan_name: plan, redeemed_at: new Date().toISOString(), expires_at: expiresAt }),
    });

    return Response.json({ success: true, plan, expiresAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/duplicate|unique/i.test(message)) {
      return Response.json({ error: "This coupon has already been redeemed by your account." }, { status: 409 });
    }
    console.error("KOYAL coupon redemption failed:", message);
    return Response.json({ error: "Coupon redemption is temporarily unavailable. Please try again later." }, { status: 500 });
  }
}
