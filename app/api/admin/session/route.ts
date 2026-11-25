import { requireKoyalAdminSession } from "@/lib/koyal-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireKoyalAdminSession(request);
    if (!user) return Response.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
    return Response.json({ authenticated: true, email: user.email, name: "Koyal Ai India" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ authenticated: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
