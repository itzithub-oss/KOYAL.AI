import { createHmac, timingSafeEqual } from "node:crypto";

export const CASHFREE_API_VERSION = "2025-01-01";

export function cashfreeBaseUrl() {
  return process.env.CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

export function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

export function supabaseHeaders() {
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: key,
    // New sb_secret keys are API keys, not JWTs: never send them as Bearer tokens.
    ...(key.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${key}` }),
    "Content-Type": "application/json",
  };
}

export async function getAuthenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user.id === "string" ? user as { id: string; email?: string; user_metadata?: Record<string, unknown> } : null;
}

export async function supabaseRequest(path: string, init: RequestInit = {}) {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...supabaseHeaders(), ...(init.headers || {}) },
    cache: "no-store",
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Database request failed (${response.status}): ${body.slice(0, 500)}`);
  }
  return body ? JSON.parse(body) : null;
}

export async function fetchCashfreeOrder(orderId: string) {
  const response = await fetch(`${cashfreeBaseUrl()}/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      "x-client-id": requiredEnv("CASHFREE_APP_ID"),
      "x-client-secret": requiredEnv("CASHFREE_SECRET_KEY"),
      "x-api-version": CASHFREE_API_VERSION,
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Cashfree order lookup failed (${response.status}).`);
  return data as { order_id: string; order_status: string; order_amount: number; order_currency: string };
}

export async function creditPaidFeatherOrder(orderId: string, amountPaise: number, expectedUserId?: string) {
  const rows = await supabaseRequest(
    `koyal_payment_orders?select=id,user_id,feather_quantity,amount_paise,payment_status&cashfree_order_id=eq.${encodeURIComponent(orderId)}&limit=1`,
  ) as Array<{ id: string; user_id: string; feather_quantity: number; amount_paise: number; payment_status: string }>;
  const order = rows?.[0];
  if (!order) throw new Error("Payment order was not found.");
  if (expectedUserId && order.user_id !== expectedUserId) throw new Error("This payment belongs to another account.");
  if (order.amount_paise !== amountPaise || order.payment_status === "CANCELLED") {
    throw new Error("Payment amount or order status did not match.");
  }
  await supabaseRequest(`koyal_payment_orders?cashfree_order_id=eq.${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ payment_status: "PAID" }),
  });
  await supabaseRequest("rpc/credit_koyal_feathers", {
    method: "POST",
    body: JSON.stringify({
      p_user_id: order.user_id,
      p_cashfree_order_id: orderId,
      p_quantity: order.feather_quantity,
      p_amount_paise: order.amount_paise,
    }),
  });
  return { userId: order.user_id, quantity: order.feather_quantity };
}

export function verifyCashfreeWebhook(rawBody: string, timestamp: string, signature: string) {
  const expected = createHmac("sha256", requiredEnv("CASHFREE_SECRET_KEY"))
    .update(timestamp + rawBody)
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
