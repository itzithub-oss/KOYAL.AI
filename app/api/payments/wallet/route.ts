import { getAuthenticatedUser, supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Please log in to view your feather balance." }, { status: 401 });
    let rows = await supabaseRequest(
      `koyal_feather_wallets?select=balance&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    ) as Array<{ balance: number }>;
    if (!rows?.length) {
      // Preserve KOYAL's existing 150-feather welcome grant, but create it server-side only once.
      await supabaseRequest("koyal_feather_wallets?on_conflict=user_id", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: user.id, balance: 150 }),
      });
      rows = await supabaseRequest(
        `koyal_feather_wallets?select=balance&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
      ) as Array<{ balance: number }>;
    }
    return Response.json({ balance: Math.max(0, Number(rows?.[0]?.balance || 0)) });
  } catch (error) {
    console.error("KOYAL wallet lookup:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not load your feather balance." }, { status: 500 });
  }
}
