import { requireKoyalAdminSession, writeAdminLog } from "@/lib/koyal-admin";
import { supabaseRequest } from "@/lib/cashfree-server";

export const runtime = "nodejs";

const FIELDS = ["name", "category", "description", "location", "starting_price", "contact_name", "operator_name", "phone", "email", "website", "professional_name", "qualifications", "experience", "services", "service_hours"] as const;
const STATUSES = new Set(["active", "inactive", "pending", "rejected"]);

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403 });
    const search = (new URL(request.url).searchParams.get("search") || "").trim().toLowerCase().slice(0, 120);
    const rows = await supabaseRequest("koyal_partner_directory?select=*&order=created_at.desc&limit=1000") as Array<Record<string, unknown>>;
    const partners = (rows || []).filter(row => !search || [row.name, row.category, row.location, row.phone, row.email].some(value => String(value || "").toLowerCase().includes(search)));
    return Response.json({ partners, total: partners.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL admin partners failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not load partners. Run the partner directory migration first." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const name = cleanText(body.name, 120);
    const category = cleanText(body.category, 100);
    const description = cleanText(body.description, 1000);
    const location = cleanText(body.location, 180);
    if (!name || !category || !location) return Response.json({ error: "Business name, category and location are required." }, { status: 400 });
    const row: Record<string, unknown> = { name, category, description, location, status: "active", source: "admin" };
    for (const field of FIELDS) {
      if (["name", "category", "description", "location"].includes(field)) continue;
      const value = body[field];
      if (field === "qualifications" || field === "services") {
        row[field] = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean).slice(0, 30) : [];
      } else {
        const text = cleanText(value, 300);
        if (text) row[field] = text;
      }
    }
    const created = await supabaseRequest("koyal_partner_directory", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(row),
    }) as Array<{ id: string }>;
    const partnerId = created?.[0]?.id || null;
    await writeAdminLog(admin, "partner_created", { partnerId, name, category, location });
    return Response.json({ success: true, id: partnerId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL admin partner creation failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not create the partner listing." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireKoyalAdminSession(request);
    if (!admin) return Response.json({ error: "Admin verification is required." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const id = cleanText(body.id, 60);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return Response.json({ error: "A valid partner ID is required." }, { status: 400 });
    }
    const updates: Record<string, unknown> = {};
    if (typeof body.status === "string") {
      if (!STATUSES.has(body.status)) return Response.json({ error: "Choose a valid partner status." }, { status: 400 });
      updates.status = body.status;
    }
    for (const field of FIELDS) {
      if (body[field] === undefined) continue;
      if (field === "qualifications" || field === "services") {
        if (!Array.isArray(body[field])) return Response.json({ error: "Services and qualifications must be lists." }, { status: 400 });
        updates[field] = body[field].filter((item: unknown): item is string => typeof item === "string").map((item: string) => item.trim()).filter(Boolean).slice(0, 30);
      } else {
        const value = cleanText(body[field], field === "description" ? 1000 : 300);
        if (["name", "category", "location"].includes(field) && !value) return Response.json({ error: "Name, category and location cannot be blank." }, { status: 400 });
        updates[field] = value || null;
      }
    }
    if (!Object.keys(updates).length) return Response.json({ error: "No partner changes were supplied." }, { status: 400 });
    updates.updated_at = new Date().toISOString();
    const existing = await supabaseRequest(`koyal_partner_directory?id=eq.${encodeURIComponent(id)}&select=id,name,status&limit=1`) as Array<{ id: string; name: string; status: string }>;
    if (!existing?.length) return Response.json({ error: "Partner listing not found." }, { status: 404 });
    await supabaseRequest(`koyal_partner_directory?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(updates),
    });
    await writeAdminLog(admin, "partner_updated", { partnerId: id, changes: updates });
    return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("KOYAL admin partner update failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not update the partner listing." }, { status: 503 });
  }
}
