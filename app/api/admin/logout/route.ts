import { clearKoyalAdminCookie, getKoyalAdminUser, revokeKoyalAdminSession, writeAdminLog } from "@/lib/koyal-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getKoyalAdminUser(request);
    if (user) {
      await revokeKoyalAdminSession(request, user);
      await writeAdminLog(user, "admin_panel_signed_out");
    }
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Set-Cookie": clearKoyalAdminCookie() },
    });
  } catch {
    return new Response(JSON.stringify({ success: false }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Set-Cookie": clearKoyalAdminCookie() },
    });
  }
}
