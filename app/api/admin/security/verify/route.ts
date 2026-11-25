import { getAdminSecurity, getKoyalAdminUser, createKoyalAdminSession, writeAdminLog, verifyAdminAnswer } from "@/lib/koyal-admin";
import { supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getKoyalAdminUser(request);
    if (!user) return Response.json({ error: "This account is not authorized for KOYAL AI administration." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
    const answers = body.answers;
    if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !Array.isArray(answers) || answers.length !== 1) {
      return Response.json({ error: "Complete the security answer to continue." }, { status: 400 });
    }

    const challengeRows = await supabaseRequest(
      `koyal_admin_challenges?select=id,user_id,question_indexes,expires_at,used_at&id=eq.${encodeURIComponent(challengeId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    ) as Array<{ id: string; user_id: string; question_indexes: number[]; expires_at: string; used_at: string | null }>;
    const challenge = challengeRows?.[0];
    if (!challenge || challenge.used_at || Date.parse(challenge.expires_at) <= Date.now()) {
      return Response.json({ error: "This verification request has expired. Start again." }, { status: 400 });
    }

    const security = await getAdminSecurity(user.id);
    if (!security) return Response.json({ error: "Admin security questions are not configured." }, { status: 409 });
    if (security.locked_until && Date.parse(security.locked_until) > Date.now()) {
      return Response.json({ error: "Admin verification is temporarily locked. Please try again later." }, { status: 429 });
    }

    const supplied = new Map<number, string>();
    for (const item of answers) {
      if (typeof item?.questionIndex !== "number" || typeof item?.answer !== "string") {
        return Response.json({ error: "The security answer is required." }, { status: 400 });
      }
      supplied.set(item.questionIndex, item.answer);
    }
    const validShape = challenge.question_indexes.length === 1 && challenge.question_indexes.every((index) => supplied.has(index)) && supplied.size === 1;
    const validAnswers = validShape && challenge.question_indexes.every((index) => {
      const saved = security.answer_hashes?.[index];
      return Array.isArray(saved) && verifyAdminAnswer(supplied.get(index) || "", saved);
    });

    const used = await supabaseRequest(
      `koyal_admin_challenges?id=eq.${encodeURIComponent(challengeId)}&user_id=eq.${encodeURIComponent(user.id)}&used_at=is.null`,
      { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ used_at: new Date().toISOString() }) },
    ) as Array<{ id: string }>;
    if (!used?.length) return Response.json({ error: "This verification request has already been used. Start again." }, { status: 409 });

    if (!validAnswers) {
      const failedAttempts = Number(security.failed_attempts || 0) + 1;
      const lockedUntil = failedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
      await supabaseRequest(`koyal_admin_security?user_id=eq.${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ failed_attempts: failedAttempts, locked_until: lockedUntil, updated_at: new Date().toISOString() }),
      });
      await writeAdminLog(user, "admin_security_answer_rejected", { failedAttempts, locked: Boolean(lockedUntil) });
      return Response.json({ error: lockedUntil ? "Too many incorrect answers. Admin verification is locked for 15 minutes." : "That answer is incorrect. Please try again." }, { status: lockedUntil ? 429 : 401 });
    }

    await supabaseRequest(`koyal_admin_security?user_id=eq.${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() }),
    });
    const session = await createKoyalAdminSession(user);
    await writeAdminLog(user, "admin_access_granted");
    return Response.json({ success: true, expiresAt: session.expiresAt }, {
      headers: { "Cache-Control": "no-store", "Set-Cookie": session.cookie },
    });
  } catch (error) {
    console.error("KOYAL admin verification failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Admin verification is temporarily unavailable. Please try again." }, { status: 500 });
  }
}
