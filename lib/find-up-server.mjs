export function getFindUpSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Find Up database is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  return { url, key };
}

export async function findUpDatabase(path, options = {}) {
  const { url, key } = getFindUpSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.message || body?.hint || body?.details || "Supabase database request failed.";
    throw new Error(detail);
  }
  return body;
}

export async function requireFindUpAdmin(request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { ok: false, status: 401, error: "Sign in with an authorised admin account." };
  const { url, key } = getFindUpSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, status: 401, error: "Your login session is invalid or expired." };
  const user = await response.json();
  const allowed = (process.env.FIND_UP_ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (!user?.email || !allowed.includes(user.email.toLowerCase())) {
    return { ok: false, status: 403, error: "This account is not authorised to manage Find Up." };
  }
  return { ok: true, user };
}
