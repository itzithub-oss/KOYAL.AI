import { hashAdminAnswer, hashAdminPasskey, getAdminSecurity, getKoyalAdminUser, reauthenticateKoyalAdmin, writeAdminLog, createKoyalAdminSession } from "@/lib/koyal-admin";
import { supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getKoyalAdminUser(request);
    if (!user) return Response.json({ error: "This account is not authorized for KOYAL AI administration." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    if (!await reauthenticateKoyalAdmin(body.password)) {
      await writeAdminLog(user, "admin_security_setup_password_rejected");
      return Response.json({ error: "The administrator password could not be verified." }, { status: 401 });
    }

    const existing = await getAdminSecurity(user.id);
    if (existing?.passkey_hashes?.length === 3) {
      return Response.json({ error: "Admin security is already configured. Contact the administrator recovery process to change it." }, { status: 409 });
    }

    const answers = body.answers;
    const passkeys = body.passkeys;
    if (!Array.isArray(answers) || answers.length !== 3 || answers.some((combo: unknown) => !Array.isArray(combo) || combo.length !== 5)) {
      return Response.json({ error: "Provide all five answers for each of the three combinations." }, { status: 400 });
    }
    if (!Array.isArray(passkeys) || passkeys.length !== 3 || passkeys.some((value: unknown) => typeof value !== "string" || value.trim().length < 12 || value.length > 128)) {
      return Response.json({ error: "Provide three different passkeys, each at least 12 characters." }, { status: 400 });
    }

    const normalizedCombos = answers.map((combo: string[]) => combo.map(value => typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US") : ""));
    if (normalizedCombos.some(combo => combo.some(value => value.length < 2 || value.length > 120)) ||
        new Set(normalizedCombos.map(combo => combo.join("|"))).size !== 3 ||
        new Set(passkeys.map((value: string) => value)).size !== 3) {
      return Response.json({ error: "All answers must be valid, all three answer combinations must differ, and all passkeys must be unique." }, { status: 400 });
    }

    const answerHashes = answers.map((combo: string[]) => combo.map(answer => hashAdminAnswer(answer)));
    const passkeyHashes = passkeys.map((passkey: string) => hashAdminPasskey(passkey));
    const payload = { answer_hashes: answerHashes, passkey_hashes: passkeyHashes, failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() };

    if (existing) {
      await supabaseRequest(`koyal_admin_security?user_id=eq.${encodeURIComponent(user.id)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(payload),
      });
    } else {
      await supabaseRequest("koyal_admin_security", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ user_id: user.id, ...payload }),
      });
    }

    const session = await createKoyalAdminSession(user);
    await writeAdminLog(user, "admin_security_combinations_configured");
    return Response.json({ success: true, expiresAt: session.expiresAt }, {
      headers: { "Cache-Control": "no-store", "Set-Cookie": session.cookie },
    });
  } catch (error) {
    console.error("KOYAL admin security setup failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not complete admin security setup. Confirm the latest admin security migrations have been applied." }, { status: 500 });
  }
}
