import { getActiveSubscription, getAuthenticatedUser, supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

type AnnouncementRow = {
  id: string;
  title: string;
  message: string;
  priority: "normal" | "urgent";
  audience_type: "all" | "plan";
  audience_value: string | null;
  scheduled_at: string | null;
  created_at: string;
};

const validPlans = ["Just", "Let It", "Care", "Elite", "Supreme"];

export async function GET(request: Request) {
  try {
    const now = new Date();
    const user = await getAuthenticatedUser(request);
    let userPlan = "Just";

    if (user) {
      const [paid, couponRows, manualRows] = await Promise.all([
        getActiveSubscription(user.id),
        supabaseRequest(
          `koyal_coupon_redemptions?select=plan_name,expires_at&user_id=eq.${encodeURIComponent(user.id)}&expires_at=gt.${encodeURIComponent(now.toISOString())}&order=expires_at.desc&limit=1`,
        ) as Promise<Array<{ plan_name: string; expires_at: string }>>,
        supabaseRequest(
          `koyal_admin_manual_subscriptions?select=plan_name,expires_at&user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&expires_at=gt.${encodeURIComponent(now.toISOString())}&order=created_at.desc&limit=1`,
        ) as Promise<Array<{ plan_name: string; expires_at: string }>>,
      ]);
      const coupon = couponRows?.[0];
      const manual = manualRows?.[0];
      const paidExpiry = paid.expiresAt ? Date.parse(paid.expiresAt) : 0;
      const couponExpiry = coupon?.expires_at ? Date.parse(coupon.expires_at) : 0;
      const activePlan = manual
        ? manual.plan_name
        : coupon && couponExpiry > paidExpiry
          ? coupon.plan_name
          : paid.plan;
      if (validPlans.includes(activePlan)) userPlan = activePlan;
    }

    const rows = await supabaseRequest(
      "koyal_admin_announcements?select=id,title,message,priority,audience_type,audience_value,scheduled_at,created_at&is_active=eq.true&order=created_at.desc&limit=300",
    ) as AnnouncementRow[];

    const announcements = (rows || []).filter((item) => {
      if (item.scheduled_at && Date.parse(item.scheduled_at) > now.getTime()) return false;
      if (item.audience_type === "all") return true;
      return Boolean(user && item.audience_type === "plan" && item.audience_value === userPlan);
    });

    return Response.json(
      { announcements },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("KOYAL public announcement feed failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Announcement feed is temporarily unavailable." }, { status: 503 });
  }
}
