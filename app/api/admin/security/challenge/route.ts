import { randomInt } from "node:crypto";
import { ADMIN_QUESTIONS, getAdminSecurity, getKoyalAdminUser, reauthenticateKoyalAdmin, writeAdminLog } from "@/lib/koyal-admin";
import { supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getKoyalAdminUser(request);
    if (!user) return Response.json({ error: "This account is not authorized for KOYAL AI administration." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    if (!await reauthenticateKoyalAdmin(body.password)) {
      await writeAdminLog(user, "admin_password_rejected");
      return Response.json({ error: "The administrator password could not be verified." }, { status: 401 });
    }

    const security = await getAdminSecurity(user.id);
    if (!security) return Response.json({ setupRequired: true }, { headers: { "Cache-Control": "no-store" } });
    if (security.locked_until && Date.parse(security.locked_until) > Date.now()) {
      return Response.json({ error: "Admin verification is temporarily locked. Please try again later." }, { status: 429 });
    }

    const questionIndexes = [randomInt(ADMIN_QUESTIONS.length)];
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const rows = await supabaseRequest("koyal_admin_challenges", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ user_id: user.id, question_indexes: questionIndexes, expires_at: expiresAt }),
    }) as Array<{ id: string }>;
    const challenge = rows?.[0];
    if (!challenge?.id) throw new Error("Could not create the admin verification challenge.");
    return Response.json({
      setupRequired: false,
      challengeId: challenge.id,
      questions: questionIndexes.map((index) => ({ index, question: ADMIN_QUESTIONS[index] })),
      expiresAt,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL admin challenge failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Admin verification is temporarily unavailable. Confirm the admin security migration has been applied." }, { status: 500 });
  }
}
