import { hashAdminAnswer, getAdminSecurity, getKoyalAdminUser, reauthenticateKoyalAdmin, writeAdminLog, createKoyalAdminSession } from "@/lib/koyal-admin";
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
    if (existing?.answer_hashes?.length === 5) {
      return Response.json({ error: "Admin security is already configured. Contact the administrator recovery process to change it." }, { status: 409 });
    }

    const answers = body.answers;
    if (!Array.isArray(answers) || answers.length !== 5 ||
        answers.some((value: unknown) => typeof value !== "string" || value.trim().length < 2 || value.length > 120)) {
      return Response.json({ error: "Provide one valid answer for each of the five security questions." }, { status: 400 });
    }
    const normalizedAnswers = answers.map((value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US"));
    if (new Set(normalizedAnswers).size !== 5) {
      return Response.json({ error: "Each security question must have a distinct answer." }, { status: 400 });
    }
    const answerHashes = answers.map((answer: string) => hashAdminAnswer(answer));
    const payload = { answer_hashes: answerHashes, failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() };

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
    await writeAdminLog(user, "admin_security_questions_configured");
    return Response.json({ success: true, expiresAt: session.expiresAt }, {
      headers: { "Cache-Control": "no-store", "Set-Cookie": session.cookie },
    });
  } catch (error) {
    console.error("KOYAL admin security setup failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not complete admin security setup. Confirm the latest admin security migrations have been applied." }, { status: 500 });
  }
}
