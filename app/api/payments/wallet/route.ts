import { getAuthenticatedUser, supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Please log in to view your feather balance." }, { status: 401 });
    const rows = await supabaseRequest(
      `koyal_feather_wallets?select=balance&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    ) as Array<{ balance: number }>;
    return Response.json({ balance: Math.max(0, Number(rows?.[0]?.balance || 0)) });
  } catch (error) {
    console.error("KOYAL wallet lookup:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not load your feather balance." }, { status: 500 });
  }
}
