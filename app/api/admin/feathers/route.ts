import { requireKoyalAdminSession, writeAdminLog } from "@/lib/koyal-admin";
import { supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403 });
    const search = (new URL(request.url).searchParams.get("search") || "").trim().slice(0, 120);
    const walletFilter = search ? `&user_id=eq.${encodeURIComponent(search)}` : "";
    const [wallets, adjustments] = await Promise.all([
      supabaseRequest(`koyal_feather_wallets?select=user_id,balance&order=balance.desc&limit=500${walletFilter}`),
      supabaseRequest(`koyal_admin_feather_adjustments?select=id,user_id,quantity,balance_before,balance_after,reason,admin_email,created_at&order=created_at.desc&limit=500${walletFilter}`),
    ]);
    return Response.json({ wallets: wallets || [], adjustments: adjustments || [], readOnlyHistory: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL admin feathers failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not load Feather records. Run the admin Feather migration first." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const direction = body.direction === "deduct" ? -1 : body.direction === "add" ? 1 : 0;
    const quantity = Number(body.quantity);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) return Response.json({ error: "Enter a valid user account ID." }, { status: 400 });
    if (!direction || !Number.isInteger(quantity) || quantity < 1 || quantity > 100000) return Response.json({ error: "Enter a whole Feather amount between 1 and 100,000." }, { status: 400 });
    if (reason.length < 3 || reason.length > 300) return Response.json({ error: "Enter a reason between 3 and 300 characters." }, { status: 400 });

    const result = await supabaseRequest("rpc/admin_adjust_koyal_feathers", {
      method: "POST",
      body: JSON.stringify({ p_user_id: userId, p_quantity: direction * quantity, p_reason: reason, p_admin_user_id: admin.id, p_admin_email: admin.email || "koyalaiindia@gmail.com" }),
    }) as { balanceBefore: number; balanceAfter: number };
    await writeAdminLog(admin, direction > 0 ? "feathers_added" : "feathers_deducted", { userId, quantity, balanceBefore: result.balanceBefore, balanceAfter: result.balanceAfter, reason });
    return Response.json({ success: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL admin Feather adjustment failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Feather adjustment failed. Check the user ID, available balance and migration status." }, { status: 503 });
  }
}
