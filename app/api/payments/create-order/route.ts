import { randomUUID } from "node:crypto";
import { getAuthenticatedUser, requiredEnv, supabaseRequest, cashfreeBaseUrl, CASHFREE_API_VERSION } from "@/lib/cashfree-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Please log in before buying feathers." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const quantity = Number(body.featherQuantity);
    const phone = String(body.phone || user.user_metadata?.phone || "").replace(/[^\d]/g, "");
    if (!Number.isSafeInteger(quantity) || quantity < 2 || quantity > 100000) {
      return Response.json({ error: "Choose between 2 and 100,000 feathers." }, { status: 400 });
    }
    if (phone.length < 10 || phone.length > 15) {
      return Response.json({ error: "Enter a valid phone number for Cashfree checkout." }, { status: 400 });
    }

    const amountPaise = quantity * 50;
    const orderId = `koyal_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const appUrl = new URL(request.url).origin;
    const cashfreeResponse = await fetch(`${cashfreeBaseUrl()}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": requiredEnv("CASHFREE_APP_ID"),
        "x-client-secret": requiredEnv("CASHFREE_SECRET_KEY"),
        "x-api-version": CASHFREE_API_VERSION,
        "x-idempotency-key": randomUUID(),
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amountPaise / 100,
        order_currency: "INR",
        customer_details: {
          customer_id: user.id,
          customer_phone: phone,
          ...(user.email ? { customer_email: user.email } : {}),
        },
        order_meta: {
          return_url: `${appUrl}/payments/return?order_id={order_id}`,
        },
        order_note: `KOYAL AI feather purchase - ${quantity} feathers`,
      }),
      cache: "no-store",
    });
    const payment = await cashfreeResponse.json().catch(() => ({}));
    if (!cashfreeResponse.ok || !payment.payment_session_id) {
      return Response.json({ error: "Cashfree could not start checkout. Please try again." }, { status: 502 });
    }

    await supabaseRequest("koyal_payment_orders", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: user.id,
        cashfree_order_id: orderId,
        order_type: "FEATHERS",
        plan_name: null,
        feather_quantity: quantity,
        amount_paise: amountPaise,
        payment_session_id: payment.payment_session_id,
        payment_status: "PENDING",
      }),
    });
    return Response.json({ orderId, paymentSessionId: payment.payment_session_id, amountPaise, mode: process.env.CASHFREE_ENV === "production" ? "production" : "sandbox" });
  } catch (error) {
    console.error("KOYAL create payment order:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not create the payment order. Please try again." }, { status: 500 });
  }
}
