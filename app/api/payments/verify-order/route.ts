import { fetchCashfreeOrder, getAuthenticatedUser, processPaidOrder, supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Please log in again to verify this payment." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    if (!/^koyal_[a-zA-Z0-9_-]{8,80}$/.test(orderId)) {
      return Response.json({ error: "Invalid payment order." }, { status: 400 });
    }
    const cashfreeOrder = await fetchCashfreeOrder(orderId);
    if (cashfreeOrder.order_id !== orderId || cashfreeOrder.order_currency !== "INR") {
      return Response.json({ status: cashfreeOrder.order_status || "PENDING", credited: false });
    }
    if (cashfreeOrder.order_status !== "PAID") {
      if (["FAILED", "CANCELLED", "EXPIRED", "TERMINATED"].includes(String(cashfreeOrder.order_status || "").toUpperCase())) {
        await supabaseRequest("rpc/release_koyal_discount_coupon", {
          method: "POST",
          body: JSON.stringify({ p_order_id: orderId }),
        });
      }
      return Response.json({ status: cashfreeOrder.order_status || "PENDING", credited: false });
    }
    const result = await processPaidOrder(orderId, Math.round(cashfreeOrder.order_amount * 100), user.id);
    // This is idempotent: it marks a discount reservation redeemed only after
    // the corresponding paid order has been fulfilled successfully.
    await supabaseRequest("rpc/confirm_koyal_discount_coupon", {
      method: "POST",
      body: JSON.stringify({ p_order_id: orderId, p_user_id: user.id }),
    });
    if (result.type === "subscription") {
      return Response.json({ status: "PAID", credited: true, plan: result.plan, expiresAt: result.expiresAt });
    }
    return Response.json({ status: "PAID", credited: true, quantity: result.quantity });
  } catch (error) {
    console.error("KOYAL verify payment:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Payment verification could not be completed. Please retry." }, { status: 500 });
  }
}
