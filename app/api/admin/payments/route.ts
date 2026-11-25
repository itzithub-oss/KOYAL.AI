import { requireKoyalAdminSession } from "@/lib/koyal-admin";
import { supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    const url = new URL(request.url);
    const status = (url.searchParams.get("status") || "").trim().toUpperCase();
    const search = (url.searchParams.get("search") || "").trim().slice(0, 120);
    const allowed = new Set(["", "PAID", "PENDING", "FAILED", "CANCELLED", "REFUNDED"]);
    if (!allowed.has(status)) return Response.json({ error: "Invalid payment status filter." }, { status: 400 });
    const rows = await supabaseRequest(
      "koyal_payment_orders?select=id,user_id,cashfree_order_id,amount_paise,payment_status,created_at,order_type,plan_name,feather_quantity&order=created_at.desc&limit=500",
    ) as Array<{ id: string; user_id: string; cashfree_order_id?: string; amount_paise: number; payment_status: string; created_at: string; order_type: string; plan_name: string | null; feather_quantity?: number | null }>;
    const filtered = (rows || []).filter(row => {
      const state = String(row.payment_status || "").toUpperCase();
      const matchesStatus = !status || state === status;
      const haystack = [row.cashfree_order_id, row.user_id, row.id, row.plan_name, row.order_type].join(" ").toLowerCase();
      return matchesStatus && (!search || haystack.includes(search.toLowerCase()));
    });
    return Response.json({ payments: filtered, readOnly: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL admin payments failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not load payment records. Check the payment table and try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
