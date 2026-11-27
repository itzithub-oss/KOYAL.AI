import { randomUUID } from "node:crypto";
import { getAuthenticatedUser, requiredEnv, supabaseRequest, cashfreeBaseUrl, CASHFREE_API_VERSION } from "@/lib/cashfree-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let reservedDiscountOrderId = "";
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Please log in before buying feathers." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const requestedPlan = typeof body.planName === "string" ? body.planName : "";
    const planPrices: Record<string, number> = { "Let It": 70, Care: 120, Elite: 220, Supreme: 400 };
    const isSubscription = Object.prototype.hasOwnProperty.call(planPrices, requestedPlan);
    const quantity = Number(body.featherQuantity);
    if (!isSubscription && body.planName !== undefined) {
      return Response.json({ error: "Choose a valid KOYAL subscription plan." }, { status: 400 });
    }
    const phone = String(body.phone || user.user_metadata?.phone || "").replace(/\D/g, "");
    if (!isSubscription && (!Number.isSafeInteger(quantity) || quantity < 2 || quantity > 100000)) {
      return Response.json({ error: "Choose between 2 and 100,000 feathers." }, { status: 400 });
    }
    if (phone.length !== 10) {
      return Response.json({ error: "Enter a valid 10-digit Indian mobile number for Cashfree checkout." }, { status: 400 });
    }

    const originalAmountPaise = isSubscription ? planPrices[requestedPlan] * 100 : quantity * 50;
    let amountPaise = originalAmountPaise;
    let discountPercent = 0;
    const orderId = `koyal_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const couponCode = typeof body.couponCode === "string" ? body.couponCode.trim().toLowerCase() : "";
    if (couponCode) {
      try {
        const discount = await supabaseRequest("rpc/reserve_koyal_discount_coupon", {
          method: "POST",
          body: JSON.stringify({
            p_user_id: user.id,
            p_code: couponCode,
            p_order_id: orderId,
            p_purchase_type: isSubscription ? "subscription" : "feathers",
            p_original_amount_paise: originalAmountPaise,
          }),
        }) as { discountPercent?: number; amountPaise?: number };
        reservedDiscountOrderId = orderId;
        discountPercent = Number(discount.discountPercent) || 0;
        amountPaise = Number(discount.amountPaise) || 0;
        if (discountPercent < 1 || discountPercent > 99 || amountPaise < 100 || amountPaise >= originalAmountPaise) {
          throw new Error("This discount coupon returned an invalid discount amount.");
        }
      } catch (error) {
        if (reservedDiscountOrderId) {
          await supabaseRequest("rpc/release_koyal_discount_coupon", { method: "POST", body: JSON.stringify({ p_order_id: reservedDiscountOrderId }) }).catch(() => null);
          reservedDiscountOrderId = "";
        }
        const detail = error instanceof Error ? error.message : "";
        return Response.json({ error: detail.includes("Database request failed") ? detail.slice(0, 300) : detail || "That discount coupon could not be applied." }, { status: 400 });
      }
    }
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
        order_note: isSubscription ? `KOYAL AI ${requestedPlan} plan - 30 days` : `KOYAL AI feather purchase - ${quantity} feathers`,
      }),
      cache: "no-store",
    });
    const payment = await cashfreeResponse.json().catch(() => ({}));
    if (!cashfreeResponse.ok || !payment.payment_session_id) {
      if (reservedDiscountOrderId) {
        await supabaseRequest("rpc/release_koyal_discount_coupon", { method: "POST", body: JSON.stringify({ p_order_id: reservedDiscountOrderId }) }).catch(() => null);
        reservedDiscountOrderId = "";
      }
      const providerCode = typeof payment.code === "string" ? payment.code : "";
      const providerMessage = typeof payment.message === "string" ? payment.message : "";
      const providerType = typeof payment.type === "string" ? payment.type : "";
      // Log only Cashfree's non-secret error metadata; never log credentials or customer details.
      console.error("KOYAL Cashfree order rejected:", JSON.stringify({
        httpStatus: cashfreeResponse.status,
        code: providerCode,
        type: providerType,
        message: providerMessage.slice(0, 300),
      }));
      const detail = [providerCode, providerMessage || providerType].filter(Boolean).join(": ");
      return Response.json({
        error: detail
          ? `Cashfree rejected the order (${cashfreeResponse.status}): ${detail}`
          : `Cashfree rejected the order (HTTP ${cashfreeResponse.status}). Check the Cashfree credentials and merchant configuration.`,
      }, { status: 502 });
    }

    try {
      await supabaseRequest("koyal_payment_orders", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          user_id: user.id,
          cashfree_order_id: orderId,
          order_type: isSubscription ? "subscription" : "feathers",
          plan_name: isSubscription ? requestedPlan : null,
          feather_quantity: isSubscription ? null : quantity,
          amount_paise: amountPaise,
          payment_session_id: payment.payment_session_id,
          payment_status: "PENDING",
        }),
      });
    } catch (error) {
      if (reservedDiscountOrderId) {
        await supabaseRequest("rpc/release_koyal_discount_coupon", { method: "POST", body: JSON.stringify({ p_order_id: reservedDiscountOrderId }) }).catch(() => null);
        reservedDiscountOrderId = "";
      }
      throw error;
    }
    reservedDiscountOrderId = "";
    return Response.json({ orderId, paymentSessionId: payment.payment_session_id, amountPaise, originalAmountPaise, discountPercent, planName: isSubscription ? requestedPlan : null, mode: process.env.CASHFREE_ENV === "production" ? "production" : "sandbox" });
  } catch (error) {
    if (reservedDiscountOrderId) {
      await supabaseRequest("rpc/release_koyal_discount_coupon", { method: "POST", body: JSON.stringify({ p_order_id: reservedDiscountOrderId }) }).catch(() => null);
    }
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("KOYAL create payment order:", message);
    if (message.startsWith("Missing server environment variable:")) {
      return Response.json({ error: "Payment setup is incomplete on the server. Please check the required Cashfree and Supabase environment variables in Vercel." }, { status: 500 });
    }
    return Response.json({ error: "Could not create the payment order. Please try again." }, { status: 500 });
  }
}
