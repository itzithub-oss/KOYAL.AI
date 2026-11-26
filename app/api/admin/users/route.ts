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


async function readAdminAuthResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.msg === "string" ? data.msg : typeof data.message === "string" ? data.message : "Supabase Auth account operation failed.";
    throw new Error(message);
  }
  return data;
}

function authAdminHeaders(serviceKey: string) {
  return { apikey: serviceKey, ...(serviceKey.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${serviceKey}` }), "Content-Type": "application/json" };
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403, headers: { "Cache-Control": "no-store" } });

    const body = await request.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const action = body.action;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return Response.json({ error: "A valid user ID is required." }, { status: 400 });
    }
    if (action !== "ban" && action !== "unban") return Response.json({ error: "Choose ban or unban." }, { status: 400 });

    const baseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
    const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const headers = authAdminHeaders(serviceKey);
    const lookup = await fetch(`${baseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { headers, cache: "no-store" });
    const target = await readAdminAuthResponse(lookup) as AuthUser;
    if (String(target.email || "").trim().toLowerCase() === "koyalaiindia@gmail.com" || target.id === admin.id) {
      return Response.json({ error: "The primary KOYAL administrator account cannot be banned." }, { status: 403 });
    }

    let banUntil: string | null = null;
    if (action === "ban") {
      const duration = body.duration;
      const allowed = new Set(["1h", "24h", "7d", "30d", "90d", "876000h"]);
      if (typeof duration !== "string" || !allowed.has(duration)) {
        return Response.json({ error: "Select a supported ban duration." }, { status: 400 });
      }
      await readAdminAuthResponse(await fetch(`${baseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: "PUT", headers, body: JSON.stringify({ ban_duration: duration }), cache: "no-store",
      }));
      banUntil = duration === "876000h" ? "permanent" : new Date(Date.now() + (duration === "1h" ? 3_600_000 : duration === "24h" ? 86_400_000 : Number.parseInt(duration, 10) * 86_400_000)).toISOString();
    } else {
      await readAdminAuthResponse(await fetch(`${baseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: "PUT", headers, body: JSON.stringify({ ban_duration: "none" }), cache: "no-store",
      }));
    }

    await writeAdminLog(admin, action === "ban" ? "user_banned" : "user_unbanned", {
      userId, email: target.email || null, duration: action === "ban" ? body.duration : null, banUntil,
    });
    return Response.json({ success: true, userId, bannedUntil: action === "ban" ? banUntil : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL admin user update failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: error instanceof Error ? error.message : "Could not update the user account." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403, headers: { "Cache-Control": "no-store" } });

    const body = await request.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return Response.json({ error: "A valid user ID is required." }, { status: 400 });
    }
    if (confirmation !== "DELETE") return Response.json({ error: "Type DELETE to confirm permanent account removal." }, { status: 400 });

    const baseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
    const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const headers = authAdminHeaders(serviceKey);
    const lookup = await fetch(`${baseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { headers, cache: "no-store" });
    const target = await readAdminAuthResponse(lookup) as AuthUser;
    if (target.id === admin.id || String(target.email || "").trim().toLowerCase() === "koyalaiindia@gmail.com") {
      return Response.json({ error: "The primary KOYAL administrator account cannot be deleted from User Management." }, { status: 403 });
    }

    await writeAdminLog(admin, "user_account_deletion_requested", { userId, email: target.email || null });
    await readAdminAuthResponse(await fetch(`${baseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE", headers, cache: "no-store",
    }));
    return Response.json({ success: true, userId, message: "The Supabase Auth account was permanently deleted. Existing financial and audit history is retained." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL admin user deletion failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: error instanceof Error ? error.message : "Could not permanently delete the user account." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
