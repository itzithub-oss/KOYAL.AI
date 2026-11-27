import { supabaseRequest } from "@/lib/cashfree-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_FEATURE_FLAGS = {
  find_up: true,
  tours_travels: true,
  voice: true,
  precise_mode: true,
  image_creation: true,
};

export async function GET() {
  try {
    const rows = await supabaseRequest(
      "koyal_admin_system_settings?select=feature_flags&id=eq.true&limit=1",
    ) as Array<{ feature_flags?: Record<string, unknown> }>;
    const saved = rows?.[0]?.feature_flags;
    const featureFlags = { ...DEFAULT_FEATURE_FLAGS };
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      for (const key of Object.keys(DEFAULT_FEATURE_FLAGS) as (keyof typeof DEFAULT_FEATURE_FLAGS)[]) {
        if (typeof saved[key] === "boolean") featureFlags[key] = saved[key] as never;
      }
    }
    return Response.json({ featureFlags }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("KOYAL public feature settings lookup failed:", error instanceof Error ? error.message : "unknown error");
    // Keep the public app usable during a temporary settings-service outage.
    return Response.json({ featureFlags: DEFAULT_FEATURE_FLAGS }, { headers: { "Cache-Control": "no-store" } });
  }
}
