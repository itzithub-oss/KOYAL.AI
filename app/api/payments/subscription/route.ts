import { getActiveSubscription, getAuthenticatedUser } from "@/lib/cashfree-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Please log in to check your subscription." }, { status: 401 });
    const subscription = await getActiveSubscription(user.id);
    return Response.json(subscription, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL subscription lookup:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not load your subscription status." }, { status: 500 });
  }
}