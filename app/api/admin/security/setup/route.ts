import { hashAdminAnswer, getAdminSecurity, getKoyalAdminUser, reauthenticateKoyalAdmin, writeAdminLog } from "@/lib/koyal-admin";
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
    if (existing) return Response.json({ error: "Admin security questions have already been configured. They cannot be reset from this screen." }, { status: 409 });

    const answers = body.answers;
    if (!Array.isArray(answers) || answers.length !== 5) {
      return Response.json({ error: "Provide three answers for each of the five security questions." }, { status: 400 });
    }
    const answerHashes = [];
    for (const group of answers) {
      if (!Array.isArray(group) || group.length !== 3 || group.some((answer) => typeof answer !== "string" || answer.trim().length < 2 || answer.trim().length > 120)) {
        return Response.json({ error: "Each question needs exactly three answers between 2 and 120 characters." }, { status: 400 });
      }
      const normalized = group.map((answer: string) => answer.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US"));
      if (new Set(normalized).size !== 3) {
        return Response.json({ error: "The three accepted answers for each question must be different." }, { status: 400 });
      }
      answerHashes.push(group.map((answer: string) => hashAdminAnswer(answer)));
    }

    await supabaseRequest("koyal_admin_security", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: user.id, answer_hashes: answerHashes }),
    });
    await writeAdminLog(user, "admin_security_questions_configured");
    return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/duplicate|unique/i.test(message)) return Response.json({ error: "Admin security questions have already been configured." }, { status: 409 });
    console.error("KOYAL admin security setup failed:", message);
    return Response.json({ error: "Could not save admin security answers. Confirm the admin security migration has been applied." }, { status: 500 });
  }
}
