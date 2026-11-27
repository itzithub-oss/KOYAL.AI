import { createHash, randomBytes, randomInt, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { getAuthenticatedUser, requiredEnv, supabaseRequest } from "@/lib/cashfree-server";

export const KOYAL_ADMIN_EMAIL = "koyalaiindia@gmail.com";
export const ADMIN_QUESTIONS = [
  "What is your best friend's name?",
  "What is your mother's name?",
  "What is the name of your school?",
  "What was your childhood nickname?",
  "What is the name of your first teacher?",
] as const;

const ANSWER_ITERATIONS = 210_000;
const ADMIN_SESSION_SECONDS = 4 * 60 * 60;
const ADMIN_COOKIE = "koyal_admin_session";

type AdminUser = { id: string; email?: string };
type AnswerHash = { salt: string; hash: string };
type SecurityRow = { user_id: string; answer_hashes: AnswerHash[]; failed_attempts: number; locked_until: string | null };
type ChallengeRow = { id: string; user_id: string; question_indexes: number[]; expires_at: string; used_at: string | null };

export function normalizeAdminAnswer(value: unknown) {
  return typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US") : "";
}

export function hashAdminAnswer(value: string): AnswerHash {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(normalizeAdminAnswer(value), salt, ANSWER_ITERATIONS, 32, "sha256").toString("hex");
  return { salt, hash };
}

export function verifyAdminAnswer(value: string, saved: AnswerHash[]) {
  const candidate = normalizeAdminAnswer(value);
  if (!candidate) return false;
  let matched = false;
  for (const item of saved) {
    const actual = pbkdf2Sync(candidate, item.salt, ANSWER_ITERATIONS, 32, "sha256");
    const expected = Buffer.from(item.hash, "hex");
    if (expected.length === actual.length && timingSafeEqual(actual, expected)) matched = true;
  }
  return matched;
}

export function randomAdminQuestionIndex() { return randomInt(ADMIN_QUESTIONS.length); }

export async function getKoyalAdminUser(request: Request): Promise<AdminUser | null> {
  const user = await getAuthenticatedUser(request);
  if (!user?.id || String(user.email || "").trim().toLowerCase() !== KOYAL_ADMIN_EMAIL) return null;
  return { id: user.id, email: KOYAL_ADMIN_EMAIL };
}

export async function reauthenticateKoyalAdmin(password: unknown) {
  if (typeof password !== "string" || password.length < 6 || password.length > 256) return false;
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: KOYAL_ADMIN_EMAIL, password }),
    cache: "no-store",
  });
  if (!response.ok) return false;
  const data = await response.json().catch(() => ({}));
  return String(data?.user?.email || "").trim().toLowerCase() === KOYAL_ADMIN_EMAIL;
}

export async function getAdminSecurity(userId: string) {
  const rows = await supabaseRequest(
    `koyal_admin_security?select=user_id,answer_hashes,failed_attempts,locked_until&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  ) as SecurityRow[];
  return rows?.[0] || null;
}

export async function writeAdminLog(user: AdminUser, action: string, details: Record<string, unknown> = {}) {
  await supabaseRequest("koyal_admin_activity_logs", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ admin_user_id: user.id, admin_email: KOYAL_ADMIN_EMAIL, action, details }),
  });
}

function readAdminCookie(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)koyal_admin_session=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

export async function requireKoyalAdminSession(request: Request) {
  const user = await getKoyalAdminUser(request);
  if (!user) return null;
  const token = readAdminCookie(request);
  if (!token || token.length < 40) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const rows = await supabaseRequest(
    `koyal_admin_sessions?select=token_hash,user_id,expires_at&token_hash=eq.${tokenHash}&user_id=eq.${encodeURIComponent(user.id)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`,
  ) as Array<{ token_hash: string; user_id: string; expires_at: string }>;
  const session = rows?.[0];
  if (!session) return null;
  await supabaseRequest(`koyal_admin_sessions?token_hash=eq.${tokenHash}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
  });
  return user;
}

export async function createKoyalAdminSession(user: AdminUser) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_SECONDS * 1000).toISOString();
  await supabaseRequest("koyal_admin_sessions", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ token_hash: tokenHash, user_id: user.id, expires_at: expiresAt }),
  });
  return {
    cookie: `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ADMIN_SESSION_SECONDS}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    expiresAt,
  };
}

export function clearKoyalAdminCookie() {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export async function revokeKoyalAdminSession(request: Request, user: AdminUser) {
  const token = readAdminCookie(request);
  if (!token) return;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await supabaseRequest(
    `koyal_admin_sessions?token_hash=eq.${tokenHash}&user_id=eq.${encodeURIComponent(user.id)}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
}

export type { AdminUser, AnswerHash, ChallengeRow, SecurityRow };
