import { getAdminSecurity, getKoyalAdminUser, createKoyalAdminSession, writeAdminLog, verifyAdminAnswer } from "@/lib/koyal-admin";
import { supabaseRequest } from "@/lib/cashfree-server";
import { consumeKoyalRateLimit } from "@/lib/koyal-rate-limit";
import { readLimitedRequest, requestClientIp } from "@/lib/koyal-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getKoyalAdminUser(request);
    if (!user) return Response.json({ error: "This account is not authorized for KOYAL AI administration." }, { status: 403 });
    const ip = requestClientIp(request);
    if (!await consumeKoyalRateLimit("admin-security-passkey:ip:" + ip, 5, 60) ||
        !await consumeKoyalRateLimit("admin-security-passkey:user:" + user.id, 5, 60)) {
      return Response.json({ error: "Too many passkey attempts. Please wait and try again." }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
    }
    let body: any;
    try { body = await (await readLimitedRequest(request, 4 * 1024)).json(); }
    catch { return Response.json({ error: "The passkey request is invalid or too large." }, { status: 400 }); }
    const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
    const passkey = typeof body.passkey === "string" ? body.passkey : "";
    if (!/^[0-9a-f-]{36}$/i.test(challengeId) || passkey.length < 1 || passkey.length > 128) return Response.json({ error: "Enter the passkey for the verified combination." }, { status: 400 });
    const rows = await supabaseRequest(`koyal_admin_challenges?select=id,user_id,expires_at,used_at,combination_index&id=eq.${encodeURIComponent(challengeId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`) as Array<{id:string;user_id:string;expires_at:string;used_at:string|null;combination_index:number|null}>;
    const challenge = rows?.[0];
    if (!challenge || challenge.used_at || Date.parse(challenge.expires_at) <= Date.now() || !Number.isInteger(challenge.combination_index) || Number(challenge.combination_index) < 0 || Number(challenge.combination_index) > 2) {
      return Response.json({ error: "Verify the answer combination again before entering a passkey." }, { status: 400 });
    }
    const security = await getAdminSecurity(user.id);
    if (!security || !Array.isArray(security.passkey_hashes) || security.passkey_hashes.length !== 3) return Response.json({ error: "Combination passkeys are not configured." }, { status: 409 });
    if (security.locked_until && Date.parse(security.locked_until) > Date.now()) return Response.json({ error: "Admin verification is temporarily locked. Please try again later." }, { status: 429 });
    const comboIndex = Number(challenge.combination_index);
    const valid = verifyAdminAnswer(passkey, [security.passkey_hashes[comboIndex]]);
    const used = await supabaseRequest(`koyal_admin_challenges?id=eq.${encodeURIComponent(challengeId)}&user_id=eq.${encodeURIComponent(user.id)}&used_at=is.null&combination_index=eq.${comboIndex}`, {
      method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ used_at: new Date().toISOString() }),
    }) as Array<{id:string}>;
    if (!used?.length) return Response.json({ error: "This verification request has already been used. Start again." }, { status: 409 });
    if (!valid) {
      const failureRows = await supabaseRequest("rpc/record_koyal_admin_failure", { method: "POST", body: JSON.stringify({ p_user_id: user.id }) }) as Array<{failed_attempts:number;locked_until:string|null}>;
      const lockedUntil = failureRows?.[0]?.locked_until || null;
      await writeAdminLog(user, "admin_passkey_rejected", { combination: comboIndex + 1, locked: Boolean(lockedUntil) });
      return Response.json({ error: lockedUntil ? "Too many incorrect passkeys. Admin verification is locked for 15 minutes." : "That passkey does not belong to the verified combination." }, { status: lockedUntil ? 429 : 401 });
    }
    await supabaseRequest("rpc/reset_koyal_admin_failures", { method: "POST", body: JSON.stringify({ p_user_id: user.id }) });
    const session = await createKoyalAdminSession(user);
    await writeAdminLog(user, "admin_access_granted", { combination: comboIndex + 1 });
    return Response.json({ success: true, expiresAt: session.expiresAt }, { headers: { "Cache-Control": "no-store", "Set-Cookie": session.cookie } });
  } catch (error) {
    console.error("KOYAL admin passkey verification failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Admin passkey verification is temporarily unavailable. Please try again." }, { status: 500 });
  }
}
