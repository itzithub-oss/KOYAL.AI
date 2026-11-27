import { fetchCashfreeOrder, getAuthenticatedUser, processPaidOrder, supabaseRequest } from "@/lib/cashfree-server";
import { consumeKoyalRateLimit } from "@/lib/koyal-rate-limit";

export const runtime = "nodejs";

function requestIp(request: Request) {
  return (request.headers.get("x-real-ip") || request.headers.get("x-vercel-forwarded-for") || "unknown")
    .split(",")[0].trim().slice(0, 100) || "unknown";
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Please log in again to verify this payment." }, { status: 401 });

    const contentLength = Number(request.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > 2048) {
      return Response.json({ error: "Payment verification request is too large." }, { status: 413 });
    }

    const ip = requestIp(request);
    const [ipAllowed, accountAllowed] = await Promise.all([
      consumeKoyalRateLimit(`payment-verify:ip:${ip}`, 40, 60),
      consumeKoyalRateLimit(`payment-verify:user:${user.id}`, 20, 60),
    ]);
    if (!ipAllowed || !accountAllowed) {
      return Response.json(
        { error: "Too many payment verification requests. Please wait before trying again.", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Invalid payment verification request." }, { status: 400 });
    }
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    if (!/^koyal_[a-zA-Z0-9_-]{8,80}$/.test(orderId)) {
      return Response.json({ error: "Invalid payment order." }, { status: 400 });
    }

    const cashfreeOrder = await fetchCashfreeOrder(orderId);
    if (cashfreeOrder.order_id !== orderId || cashfreeOrder.order_currency !== "INR") {
      return Response.json({ status: cashfreeOrder.order_status || "PENDING", credited: false }, { headers: { "Cache-Control": "no-store" } });
    }
    if (cashfreeOrder.order_status !== "PAID") {
      if (["FAILED", "CANCELLED", "EXPIRED", "TERMINATED"].includes(String(cashfreeOrder.order_status || "").toUpperCase())) {
        await supabaseRequest("rpc/release_koyal_discount_coupon", {
          method: "POST",
          body: JSON.stringify({ p_order_id: orderId }),
        });
      }
      return Response.json({ status: cashfreeOrder.order_status || "PENDING", credited: false }, { headers: { "Cache-Control": "no-store" } });
    }
    const result = await processPaidOrder(orderId, Math.round(cashfreeOrder.order_amount * 100), user.id);
    // This is idempotent: it marks a discount reservation redeemed only after
    // the corresponding paid order has been fulfilled successfully.
    await supabaseRequest("rpc/confirm_koyal_discount_coupon", {
      method: "POST",
      body: JSON.stringify({ p_order_id: orderId, p_user_id: user.id }),
    });
    if (result.type === "subscription") {
      return Response.json({ status: "PAID", credited: true, plan: result.plan, expiresAt: result.expiresAt }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ status: "PAID", credited: true, quantity: result.quantity }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL verify payment:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Payment verification could not be completed. Please retry." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
