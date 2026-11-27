import { fetchCashfreeOrder, processPaidOrder, supabaseRequest, verifyCashfreeWebhook } from "@/lib/cashfree-server";
import { readLimitedRequest } from "@/lib/koyal-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    let boundedRequest: Request;
    try { boundedRequest = await readLimitedRequest(request, 256 * 1024); }
    catch { return Response.json({ error: "Webhook payload is too large." }, { status: 413 }); }
    const rawBody = await boundedRequest.text();
    const signature = request.headers.get("x-webhook-signature") || "";
    const timestamp = request.headers.get("x-webhook-timestamp") || "";
    if (!signature || !timestamp || !verifyCashfreeWebhook(rawBody, timestamp, signature)) {
      return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
    }
    const event = JSON.parse(rawBody);
    const orderId = event?.data?.order?.order_id || event?.data?.order_id;
    const paymentId = event?.data?.payment?.cf_payment_id || event?.data?.cf_payment_id || "unknown";
    if (typeof orderId !== "string") return Response.json({ received: true });
    const eventId = `${event.type || "EVENT"}:${orderId}:${paymentId}`;
    await supabaseRequest("koyal_payment_events?on_conflict=event_id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ event_id: eventId, event_type: String(event.type || "UNKNOWN") }),
    });
    const cashfreeOrder = await fetchCashfreeOrder(orderId);
    if (cashfreeOrder.order_status === "PAID" && cashfreeOrder.order_currency === "INR") {
      await processPaidOrder(orderId, Math.round(cashfreeOrder.order_amount * 100));
      const orderRows = await supabaseRequest(
        `koyal_payment_orders?select=user_id&cashfree_order_id=eq.${encodeURIComponent(orderId)}&limit=1`,
      ) as Array<{ user_id: string }>;
      if (orderRows?.[0]?.user_id) {
        await supabaseRequest("rpc/confirm_koyal_discount_coupon", {
          method: "POST",
          body: JSON.stringify({ p_order_id: orderId, p_user_id: orderRows[0].user_id }),
        });
      }
    } else if (["FAILED", "CANCELLED", "EXPIRED", "TERMINATED"].includes(String(cashfreeOrder.order_status || "").toUpperCase())) {
      await supabaseRequest("rpc/release_koyal_discount_coupon", {
        method: "POST",
        body: JSON.stringify({ p_order_id: orderId }),
      });
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("KOYAL Cashfree webhook:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
