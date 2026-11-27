import { getAdminSecurity, getKoyalAdminUser, writeAdminLog, verifyAdminAnswer } from "@/lib/koyal-admin";
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
    try { body = await (await readLimitedRequest(request, 8 * 1024)).json(); }
    catch { return Response.json({ error: "The verification request is invalid or too large." }, { status: 400 }); }
    const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
    const answers = body.answers;
    if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !Array.isArray(answers) || answers.length !== 5) {
      return Response.json({ error: "Answer all five security questions." }, { status: 400 });
    }

    const challengeRows = await supabaseRequest(
      `koyal_admin_challenges?select=id,user_id,question_indexes,expires_at,used_at,combination_index&id=eq.${encodeURIComponent(challengeId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    ) as Array<{ id: string; user_id: string; question_indexes: number[]; expires_at: string; used_at: string | null; combination_index: number | null }>;
    const challenge = challengeRows?.[0];
    if (!challenge || challenge.used_at || Date.parse(challenge.expires_at) <= Date.now() || challenge.combination_index !== null) {
      return Response.json({ error: "This verification request has expired or was already used. Start again." }, { status: 400 });
    }

    const security = await getAdminSecurity(user.id);
    if (!security || !Array.isArray(security.answer_hashes) || security.answer_hashes.length !== 3) {
      return Response.json({ error: "Admin security combinations are not configured." }, { status: 409 });
    }
    if (security.locked_until && Date.parse(security.locked_until) > Date.now()) {
      return Response.json({ error: "Admin verification is temporarily locked. Please try again later." }, { status: 429 });
    }

    const supplied = new Map<number, string>();
    for (const item of answers) {
      if (typeof item?.questionIndex !== "number" || typeof item?.answer !== "string" || item.questionIndex < 0 || item.questionIndex > 4 || supplied.has(item.questionIndex)) {
        return Response.json({ error: "The five security answers are invalid." }, { status: 400 });
      }
      supplied.set(item.questionIndex, item.answer);
    }
    const validShape = challenge.question_indexes.length === 5 && [0,1,2,3,4].every(index => supplied.has(index));
    let matchedCombination = -1;
    if (validShape) {
      for (let comboIndex = 0; comboIndex < 3; comboIndex++) {
        const saved = security.answer_hashes[comboIndex];
        if (Array.isArray(saved) && saved.length === 5 && saved.every((hash, questionIndex) => verifyAdminAnswer(supplied.get(questionIndex) || "", [hash]))) {
          matchedCombination = comboIndex;
          break;
        }
      }
    }

    const used = await supabaseRequest(
      `koyal_admin_challenges?id=eq.${encodeURIComponent(challengeId)}&user_id=eq.${encodeURIComponent(user.id)}&used_at=is.null&combination_index=is.null`,
      { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ combination_index: matchedCombination >= 0 ? matchedCombination : null, used_at: matchedCombination >= 0 ? null : new Date().toISOString() }) },
    ) as Array<{ id: string }>;
    if (!used?.length) return Response.json({ error: "This verification request has already been used. Start again." }, { status: 409 });
    if (matchedCombination < 0) {
      const failureRows = await supabaseRequest("rpc/record_koyal_admin_failure", {
        method: "POST", body: JSON.stringify({ p_user_id: user.id }),
      }) as Array<{ failed_attempts: number; locked_until: string | null }>;
      const failedAttempts = Number(failureRows?.[0]?.failed_attempts || 1);
      const lockedUntil = failureRows?.[0]?.locked_until || null;
      await writeAdminLog(user, "admin_security_combination_rejected", { failedAttempts, locked: Boolean(lockedUntil) });
      return Response.json({ error: lockedUntil ? "Too many incorrect combinations. Admin verification is locked for 15 minutes." : "The five answers do not match a complete combination." }, { status: lockedUntil ? 429 : 401 });
    }

    await writeAdminLog(user, "admin_security_combination_verified", { combination: matchedCombination + 1 });
    return Response.json({ success: true, combinationIndex: matchedCombination }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL admin answer verification failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Admin verification is temporarily unavailable. Please try again." }, { status: 500 });
  }
}
