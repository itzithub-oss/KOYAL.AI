import { getAdminSecurity, getKoyalAdminUser, writeAdminLog, verifyAdminAnswer, createKoyalAdminSession } from "@/lib/koyal-admin";
import { supabaseRequest } from "@/lib/cashfree-server";
import { consumeKoyalRateLimit } from "@/lib/koyal-rate-limit";
import { readLimitedRequest, requestClientIp } from "@/lib/koyal-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getKoyalAdminUser(request);
    if (!user) return Response.json({ error: "This account is not authorized for KOYAL AI administration." }, { status: 403 });
    const ip = requestClientIp(request);
    const ipAllowed = await consumeKoyalRateLimit("admin-security-verify:ip:" + ip, 8, 60);
    const accountAllowed = await consumeKoyalRateLimit("admin-security-verify:user:" + user.id, 8, 60);
    if (!ipAllowed || !accountAllowed) return Response.json({ error: "Too many verification attempts. Please wait and try again." }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });

    let body: any;
    try { body = await (await readLimitedRequest(request, 4 * 1024)).json(); }
    catch { return Response.json({ error: "The verification request is invalid or too large." }, { status: 400 }); }
    const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
    if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !Number.isInteger(body.questionIndex) ||
        body.questionIndex < 0 || body.questionIndex > 4 || typeof body.answer !== "string" || body.answer.length > 256) {
      return Response.json({ error: "Answer the selected security question." }, { status: 400 });
    }

    const challengeRows = await supabaseRequest(
      `koyal_admin_challenges?select=id,user_id,question_indexes,expires_at,used_at&id=eq.${encodeURIComponent(challengeId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    ) as Array<{ id: string; user_id: string; question_indexes: number[]; expires_at: string; used_at: string | null }>;
    const challenge = challengeRows?.[0];
    if (!challenge || challenge.used_at || Date.parse(challenge.expires_at) <= Date.now() ||
        !Array.isArray(challenge.question_indexes) || challenge.question_indexes.length !== 1 || challenge.question_indexes[0] !== body.questionIndex) {
      return Response.json({ error: "This verification request has expired or was already used. Start again." }, { status: 400 });
    }

    const security = await getAdminSecurity(user.id);
    if (!security || !Array.isArray(security.answer_hashes) || security.answer_hashes.length !== 5 ||
        security.answer_hashes.some(item => !item || typeof item.salt !== "string" || typeof item.hash !== "string")) {
      return Response.json({ error: "Admin security answers are not configured. Set them up again." }, { status: 409 });
    }
    if (security.locked_until && Date.parse(security.locked_until) > Date.now()) {
      return Response.json({ error: "Admin verification is temporarily locked. Please try again later." }, { status: 429 });
    }

    const selectedIndex = challenge.question_indexes[0];
    const valid = verifyAdminAnswer(body.answer, [security.answer_hashes[selectedIndex]]);
    const used = await supabaseRequest(
      `koyal_admin_challenges?id=eq.${encodeURIComponent(challengeId)}&user_id=eq.${encodeURIComponent(user.id)}&used_at=is.null`,
      { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ used_at: new Date().toISOString() }) },
    ) as Array<{ id: string }>;
    if (!used?.length) return Response.json({ error: "This verification request has already been used. Start again." }, { status: 409 });

    if (!valid) {
      const failureRows = await supabaseRequest("rpc/record_koyal_admin_failure", {
        method: "POST", body: JSON.stringify({ p_user_id: user.id }),
      }) as Array<{ failed_attempts: number; locked_until: string | null }>;
      const failedAttempts = Number(failureRows?.[0]?.failed_attempts || 1);
      const lockedUntil = failureRows?.[0]?.locked_until || null;
      await writeAdminLog(user, "admin_security_answer_rejected", { questionIndex: selectedIndex, failedAttempts, locked: Boolean(lockedUntil) });
      return Response.json({ error: lockedUntil ? "Too many incorrect answers. Admin verification is locked for 15 minutes." : "That security answer does not match." }, { status: lockedUntil ? 429 : 401 });
    }

    await supabaseRequest("rpc/reset_koyal_admin_failures", {
      method: "POST", body: JSON.stringify({ p_user_id: user.id }),
    });
    const session = await createKoyalAdminSession(user);
    await writeAdminLog(user, "admin_access_granted", { questionIndex: selectedIndex });
    return Response.json({ success: true, expiresAt: session.expiresAt }, {
      headers: { "Cache-Control": "no-store", "Set-Cookie": session.cookie },
    });
  } catch (error) {
    console.error("KOYAL admin answer verification failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Admin verification is temporarily unavailable. Please try again." }, { status: 500 });
  }
}
