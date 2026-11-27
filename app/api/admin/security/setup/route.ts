import { hashAdminAnswer, hashAdminPasskey, getAdminSecurity, getKoyalAdminUser, reauthenticateKoyalAdmin, writeAdminLog, createKoyalAdminSession } from "@/lib/koyal-admin";
import { supabaseRequest } from "@/lib/cashfree-server";
import { consumeKoyalRateLimit } from "@/lib/koyal-rate-limit";
import { readLimitedRequest, requestClientIp } from "@/lib/koyal-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getKoyalAdminUser(request);
    if (!user) return Response.json({ error: "This account is not authorized for KOYAL AI administration." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    const ip = requestClientIp(request);
    if (!await consumeKoyalRateLimit("admin-security-setup:ip:" + ip, 3, 900) ||
        !await consumeKoyalRateLimit("admin-security-setup:user:" + user.id, 3, 900)) {
      return Response.json({ error: "Too many security setup attempts. Please wait 15 minutes." }, { status: 429, headers: { "Retry-After": "900", "Cache-Control": "no-store" } });
    }
    let body: any;
    try { body = await (await readLimitedRequest(request, 8 * 1024)).json(); }
    catch { return Response.json({ error: "The security setup request is invalid or too large." }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
    if (!await reauthenticateKoyalAdmin(body?.password)) {
      await writeAdminLog(user, "admin_security_setup_password_rejected");
      return Response.json({ error: "The administrator password could not be verified." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const existing = await getAdminSecurity(user.id);
    if (existing?.passkey_hashes?.length === 3 && existing.answer_hashes?.length === 3) {
      return Response.json({ error: "Admin security is already configured. Contact the administrator recovery process to change it." }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    const answers = body?.answers;
    const passkeys = body?.passkeys;
    if (!Array.isArray(answers) || answers.length !== 3 || answers.some((combo: unknown) => !Array.isArray(combo) || combo.length !== 5 ||
        combo.some((value: unknown) => typeof value !== "string" || value.trim().length < 2 || value.length > 120))) {
      return Response.json({ error: "Provide all five valid answers in each of the three combinations." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (!Array.isArray(passkeys) || passkeys.length !== 3 || passkeys.some((value: unknown) => typeof value !== "string" || value.trim().length < 12 || value.length > 128)) {
      return Response.json({ error: "Provide three different passkeys, each at least 12 characters." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const normalized = answers.map((combo: string[]) => combo.map(value => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")));
    if (new Set(normalized.map(combo => combo.join("|"))).size !== 3 || new Set(passkeys).size !== 3) {
      return Response.json({ error: "All three answer combinations and all three passkeys must be different." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const answerHashes = answers.map((combo: string[]) => combo.map(answer => hashAdminAnswer(answer)));
    const passkeyHashes = passkeys.map((passkey: string) => hashAdminPasskey(passkey));
    const payload = { answer_hashes: answerHashes, passkey_hashes: passkeyHashes, failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() };
    if (existing) {
      await supabaseRequest(`koyal_admin_security?user_id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(payload) });
    } else {
      await supabaseRequest("koyal_admin_security", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: user.id, ...payload }) });
    }
    const session = await createKoyalAdminSession(user);
    await writeAdminLog(user, "admin_security_combinations_configured");
    return Response.json({ success: true, expiresAt: session.expiresAt }, { headers: { "Cache-Control": "no-store", "Set-Cookie": session.cookie } });
  } catch (error) {
    console.error("KOYAL admin security setup failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not complete admin security setup. Confirm the latest admin security migrations have been applied." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
