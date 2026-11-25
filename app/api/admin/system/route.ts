import { requireKoyalAdminSession, writeAdminLog } from "@/lib/koyal-admin";
import { supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

const DEFAULTS = {
  id: true,
  maintenance_mode: false,
  maintenance_message: "KOYAL AI is temporarily under maintenance. Please try again soon.",
  feature_flags: { find_up: true, tours_travels: true, voice: true, precise_mode: true, image_creation: true },
};
const ALLOWED_FLAGS = new Set(Object.keys(DEFAULTS.feature_flags));

async function loadSettings() {
  const rows = await supabaseRequest("koyal_admin_system_settings?select=id,maintenance_mode,maintenance_message,feature_flags,updated_by,updated_at&id=eq.true&limit=1") as Array<Record<string, unknown>>;
  return rows?.[0] || DEFAULTS;
}

export async function GET(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403 });
    return Response.json({ settings: await loadSettings() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown database error";
    console.error("KOYAL admin system settings load failed:", detail);
    return Response.json({ error: "Could not load system settings.", details: detail.slice(0, 400) }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const current = await loadSettings();
    const next = {
      maintenance_mode: typeof body.maintenanceMode === "boolean" ? body.maintenanceMode : current.maintenance_mode,
      maintenance_message: typeof body.maintenanceMessage === "string" ? body.maintenanceMessage.trim() : current.maintenance_message,
      feature_flags: { ...DEFAULTS.feature_flags, ...(current.feature_flags && typeof current.feature_flags === "object" ? current.feature_flags as Record<string, boolean> : {}) } as Record<string, boolean>,
    };
    if (next.maintenance_message.length < 5 || next.maintenance_message.length > 500) return Response.json({ error: "Maintenance message must be 5–500 characters." }, { status: 400 });
    if (body.featureFlags !== undefined) {
      if (!body.featureFlags || typeof body.featureFlags !== "object" || Array.isArray(body.featureFlags)) return Response.json({ error: "Feature settings are invalid." }, { status: 400 });
      for (const [key, value] of Object.entries(body.featureFlags)) {
        if (!ALLOWED_FLAGS.has(key) || typeof value !== "boolean") return Response.json({ error: "One or more feature settings are invalid." }, { status: 400 });
        next.feature_flags[key] = value;
      }
    }
    const rows = await supabaseRequest("koyal_admin_system_settings?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ id: true, ...next, updated_by: admin.email || "admin", updated_at: new Date().toISOString() }),
    }) as Array<Record<string, unknown>>;
    const saved = rows?.[0] || { ...current, ...next, updated_by: admin.email || "admin" };
    const changes: Record<string, unknown> = {};
    if (typeof body.maintenanceMode === "boolean") changes.maintenance_mode = next.maintenance_mode;
    if (typeof body.maintenanceMessage === "string") changes.maintenance_message = next.maintenance_message;
    if (body.featureFlags !== undefined) changes.feature_flags = body.featureFlags;
    try { await writeAdminLog(admin, "system_settings_updated", changes); }
    catch (logError) { console.error("KOYAL system settings audit logging failed:", logError instanceof Error ? logError.message : "unknown error"); }
    return Response.json({ success: true, settings: saved }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown database error";
    console.error("KOYAL admin system settings update failed:", detail);
    return Response.json({ error: "Could not save system settings.", details: detail.slice(0, 400) }, { status: 503 });
  }
}
