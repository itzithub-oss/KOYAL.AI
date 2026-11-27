import { ADMIN_QUESTIONS, getAdminSecurity, getKoyalAdminUser, randomAdminQuestionIndex, reauthenticateKoyalAdmin, writeAdminLog } from "@/lib/koyal-admin";
import { supabaseRequest } from "@/lib/cashfree-server";
import { consumeKoyalRateLimit } from "@/lib/koyal-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getKoyalAdminUser(request);
    if (!user) return Response.json({ error: "This account is not authorized for KOYAL AI administration." }, { status: 403 });
    const ip = (request.headers.get("x-real-ip") || request.headers.get("x-vercel-forwarded-for") || "unknown").split(",")[0].trim().slice(0, 100) || "unknown";
    if (!await consumeKoyalRateLimit(`admin-password:ip:${ip}`, 10, 900) ||
        !await consumeKoyalRateLimit(`admin-password:user:${user.id}`, 10, 900)) {
      return Response.json({ error: "Too many administrator sign-in attempts. Please wait 15 minutes." }, { status: 429, headers: { "Retry-After": "900", "Cache-Control": "no-store" } });
    }
    const body = await request.json().catch(() => ({}));
    if (!await reauthenticateKoyalAdmin(body.password)) {
      await writeAdminLog(user, "admin_password_rejected");
      return Response.json({ error: "The administrator password could not be verified." }, { status: 401 });
    }

    const security = await getAdminSecurity(user.id);
    if (!security || !Array.isArray(security.answer_hashes) || security.answer_hashes.length !== 5 ||
        security.answer_hashes.some(item => !item || typeof item.salt !== "string" || typeof item.hash !== "string")) {
      return Response.json({ setupRequired: true }, { headers: { "Cache-Control": "no-store" } });
    }
    if (security.locked_until && Date.parse(security.locked_until) > Date.now()) {
      return Response.json({ error: "Admin verification is temporarily locked. Please try again later." }, { status: 429 });
    }

    const questionIndex = randomAdminQuestionIndex();
    const questionIndexes = [questionIndex];
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
      question: { index: questionIndex, question: ADMIN_QUESTIONS[questionIndex] },
      expiresAt,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL admin challenge failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Admin verification is temporarily unavailable. Confirm the admin security migrations have been applied." }, { status: 500 });
  }
}
