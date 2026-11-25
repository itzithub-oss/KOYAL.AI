import { requireKoyalAdminSession } from "@/lib/koyal-admin";
import { requiredEnv, supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

type AuthUser = {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

export async function GET(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403, headers: { "Cache-Control": "no-store" } });

    const search = (new URL(request.url).searchParams.get("search") || "").trim().toLowerCase().slice(0, 120);
    const baseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
    const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authResponse = await fetch(`${baseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: { apikey: serviceKey, ...(serviceKey.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${serviceKey}` }) },
      cache: "no-store",
    });
    if (!authResponse.ok) throw new Error("Supabase Auth user listing failed.");
    const authData = await authResponse.json().catch(() => ({}));
    const authUsers = (Array.isArray(authData.users) ? authData.users : []) as AuthUser[];
    const matched = authUsers.filter(user => {
      const name = String(user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name || "");
      return !search || [user.id, user.email, name].some(value => String(value || "").toLowerCase().includes(search));
    }).slice(0, 250);

    const ids = matched.map(user => user.id);
    let balances: Array<{ user_id: string; balance: number }> = [];
    if (ids.length) {
      balances = await supabaseRequest(
        `koyal_feather_wallets?select=user_id,balance&user_id=in.(${ids.map(id => encodeURIComponent(id)).join(",")})&limit=1000`,
      ) as Array<{ user_id: string; balance: number }>;
    }
    const balanceByUser = new Map((balances || []).map(row => [row.user_id, Number(row.balance) || 0]));
    const users = matched.map(user => ({
      id: user.id,
      email: user.email || "",
      name: String(user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name || ""),
      createdAt: user.created_at || null,
      lastSignInAt: user.last_sign_in_at || null,
      bannedUntil: user.banned_until || null,
      feathers: balanceByUser.get(user.id) ?? null,
    }));
    return Response.json({ users, totalMatched: users.length, totalRegistered: Number(authData.total) || authUsers.length, limit: 250 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL admin users failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not load user accounts. Check Supabase Auth and wallet permissions." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
