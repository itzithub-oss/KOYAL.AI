import { requireKoyalAdminSession, writeAdminLog } from "@/lib/koyal-admin";
import { supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403 });
    const rows = await supabaseRequest("koyal_admin_announcements?select=id,title,message,priority,audience_type,audience_value,scheduled_at,is_active,created_by,created_at&order=created_at.desc&limit=300");
    return Response.json({ announcements: rows || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown database error";
    console.error("KOYAL admin announcements failed:", detail);
    return Response.json({ error: "Could not load announcements.", details: detail.slice(0, 400) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const priority = body.priority === "urgent" ? "urgent" : "normal";
    const audienceType = body.audienceType === "plan" ? "plan" : "all";
    const audienceValue = audienceType === "plan" && typeof body.audienceValue === "string" ? body.audienceValue : null;
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    if (title.length < 3 || title.length > 100) return Response.json({ error: "Title must be 3–100 characters." }, { status: 400 });
    if (message.length < 3 || message.length > 2000) return Response.json({ error: "Message must be 3–2,000 characters." }, { status: 400 });
    if (audienceType === "plan" && !["Just", "Let It", "Care", "Elite", "Supreme"].includes(audienceValue || "")) return Response.json({ error: "Choose a valid target plan." }, { status: 400 });
    if (body.scheduledAt && (!scheduledAt || !Number.isFinite(scheduledAt.getTime()))) return Response.json({ error: "Choose a valid schedule date and time." }, { status: 400 });
    const rows = await supabaseRequest("koyal_admin_announcements", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ title, message, priority, audience_type: audienceType, audience_value: audienceValue, scheduled_at: scheduledAt?.toISOString() || null, is_active: true, created_by: admin.email || "admin" }),
    }) as Array<{ id: string }>;
    const created = rows?.[0];
    if (!created?.id) throw new Error("Announcement was not confirmed by the database.");
    try { await writeAdminLog(admin, "announcement_created", { id: created.id, title, priority, audienceType, audienceValue, scheduledAt: scheduledAt?.toISOString() || null }); }
    catch (logError) { console.error("KOYAL announcement audit logging failed:", logError instanceof Error ? logError.message : "unknown error"); }
    return Response.json({ success: true, id: created.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown database error";
    console.error("KOYAL announcement creation failed:", detail);
    return Response.json({ error: "Could not create announcement.", details: detail.slice(0, 400) }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string" || typeof body.isActive !== "boolean") return Response.json({ error: "Announcement ID and active status are required." }, { status: 400 });
    const rows = await supabaseRequest(`koyal_admin_announcements?id=eq.${encodeURIComponent(body.id)}&select=id,title&limit=1`) as Array<{ id: string; title: string }>;
    if (!rows?.length) return Response.json({ error: "Announcement not found." }, { status: 404 });
    await supabaseRequest(`koyal_admin_announcements?id=eq.${encodeURIComponent(body.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ is_active: body.isActive }) });
    try { await writeAdminLog(admin, body.isActive ? "announcement_enabled" : "announcement_disabled", { id: body.id, title: rows[0].title }); }
    catch (logError) { console.error("KOYAL announcement audit logging failed:", logError instanceof Error ? logError.message : "unknown error"); }
    return Response.json({ success: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown database error";
    console.error("KOYAL announcement update failed:", detail);
    return Response.json({ error: "Could not update announcement.", details: detail.slice(0, 400) }, { status: 503 });
  }
}
