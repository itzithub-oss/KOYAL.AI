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
  if (typeof user.id !== "string") return null;

  // Supabase bans stop sign-in and refresh, but an already-issued access token
  // can remain valid until expiry. Check the Auth admin record so KOYAL API
  // routes reject a banned account immediately as well.
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const adminResponse = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    headers: { apikey: serviceKey, ...(serviceKey.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${serviceKey}` }) },
    cache: "no-store",
  });
  if (!adminResponse.ok) return null;
  const adminUser = await adminResponse.json().catch(() => ({}));
  const bannedUntil = typeof adminUser.banned_until === "string" ? Date.parse(adminUser.banned_until) : NaN;
  if (Number.isFinite(bannedUntil) && bannedUntil > Date.now()) return null;

  return user as { id: string; email?: string; user_metadata?: Record<string, unknown> };
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
  // Keep retries safe: only pending or already-paid orders may enter the credit flow.
  // An already-paid order must still call the idempotent RPC so a previous RPC failure
  // can be recovered without another customer payment.
  const updatedOrders = await supabaseRequest(
    `koyal_payment_orders?cashfree_order_id=eq.${encodeURIComponent(orderId)}&payment_status=in.(PENDING,PAID)`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ payment_status: "PAID" }),
    },
  ) as Array<{ id: string }>;
  if (!updatedOrders?.length) {
    throw new Error("Payment order could not be confirmed as paid.");
  }

  const credited = await supabaseRequest("rpc/credit_koyal_feathers", {
    method: "POST",
    body: JSON.stringify({
      p_user_id: order.user_id,
      p_cashfree_order_id: orderId,
      p_quantity: order.feather_quantity,
      p_amount_paise: order.amount_paise,
    }),
  });

  // The SQL function returns false when this order already has a ledger entry.
  // Treat that as success only after confirming the existing ledger matches this order.
  if (credited !== true) {
    const ledgerRows = await supabaseRequest(
      `koyal_feather_ledger?select=cashfree_order_id,user_id,quantity,amount_paise&cashfree_order_id=eq.${encodeURIComponent(orderId)}&limit=1`,
    ) as Array<{ cashfree_order_id: string; user_id: string; quantity: number; amount_paise: number }>;
    const ledger = ledgerRows?.[0];
    if (
      !ledger ||
      ledger.cashfree_order_id !== orderId ||
      ledger.user_id !== order.user_id ||
      ledger.quantity !== order.feather_quantity ||
      ledger.amount_paise !== order.amount_paise
    ) {
      throw new Error("Feather credit could not be confirmed in the payment ledger.");
    }
  }

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

const SUBSCRIPTION_PRICES: Record<string, number> = { "Let It": 7000, Care: 12000, Elite: 22000, Supreme: 40000 };
const SUBSCRIPTION_DAYS = 30;

export async function activatePaidSubscriptionOrder(orderId: string, amountPaise: number, expectedUserId?: string) {
  const rows = await supabaseRequest(
    `koyal_payment_orders?select=user_id,order_type,plan_name,amount_paise,payment_status,created_at&cashfree_order_id=eq.${encodeURIComponent(orderId)}&limit=1`,
  ) as Array<{ user_id: string; order_type: string; plan_name: string | null; amount_paise: number; payment_status: string; created_at: string }>; 
  const order = rows?.[0];
  if (!order || order.order_type !== "subscription" || !order.plan_name || !(order.plan_name in SUBSCRIPTION_PRICES)) {
    throw new Error("Subscription payment order was not found.");
  }
  if (expectedUserId && order.user_id !== expectedUserId) throw new Error("This payment belongs to another account.");
  if (order.amount_paise !== amountPaise || order.amount_paise !== SUBSCRIPTION_PRICES[order.plan_name] || order.payment_status === "CANCELLED") {
    throw new Error("Subscription payment amount or order status did not match.");
  }
  if (order.payment_status !== "PAID") {
    await supabaseRequest(`koyal_payment_orders?cashfree_order_id=eq.${encodeURIComponent(orderId)}&payment_status=eq.PENDING`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ payment_status: "PAID" }),
    });
  }
  return getActiveSubscription(order.user_id);
}

export async function getActiveSubscription(userId: string) {
  const rows = await supabaseRequest(
    `koyal_payment_orders?select=plan_name,amount_paise,created_at&user_id=eq.${encodeURIComponent(userId)}&order_type=eq.subscription&payment_status=eq.PAID&order=created_at.asc`,
  ) as Array<{ plan_name: string | null; amount_paise: number; created_at: string }>; 
  let expiresAt = 0;
  let activePlan = "Just";
  for (const row of rows || []) {
    if (!row.plan_name || !(row.plan_name in SUBSCRIPTION_PRICES) || row.amount_paise !== SUBSCRIPTION_PRICES[row.plan_name]) continue;
    const createdAt = Date.parse(row.created_at);
    if (!Number.isFinite(createdAt)) continue;
    const startAt = Math.max(createdAt, expiresAt);
    expiresAt = startAt + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000;
    activePlan = row.plan_name;
  }
  if (expiresAt <= Date.now()) return { plan: "Just", expiresAt: null };
  return { plan: activePlan, expiresAt: new Date(expiresAt).toISOString() };
}

export async function processPaidOrder(orderId: string, amountPaise: number, expectedUserId?: string) {
  const rows = await supabaseRequest(
    `koyal_payment_orders?select=order_type&cashfree_order_id=eq.${encodeURIComponent(orderId)}&limit=1`,
  ) as Array<{ order_type: string }>; 
  const type = rows?.[0]?.order_type;
  if (type === "feathers") {
    const result = await creditPaidFeatherOrder(orderId, amountPaise, expectedUserId);
    return { type: "feathers" as const, quantity: result.quantity };
  }
  if (type === "subscription") {
    const subscription = await activatePaidSubscriptionOrder(orderId, amountPaise, expectedUserId);
    return { type: "subscription" as const, ...subscription };
  }
  throw new Error("Unknown payment order type.");
}