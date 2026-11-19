import { NextRequest, NextResponse } from "next/server";
import { findUpDatabase, requireFindUpAdmin } from "../../../../lib/find-up-server.mjs";

export const runtime = "nodejs";
const STATUSES = new Set(["PENDING", "UNDER REVIEW", "APPROVED", "REJECTED", "NEEDS CORRECTION", "SUSPENDED"]);
const EDITABLE = new Set(["business_name","display_name","category","subcategory","description","establishment_year","operating_status","services","keywords","specialisations","search_synonyms","branches","category_details","location","pricing","operations","professionals","online_presence","verification_notes"]);

export async function GET(request: NextRequest) {
  try {
    const auth = await requireFindUpAdmin(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const rows = await findUpDatabase("find_up_businesses?select=*&order=submitted_at.desc&limit=1000");
    return NextResponse.json({ businesses: rows || [] });
  } catch (error) {
    console.error("[FIND UP ADMIN] List failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load applications." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireFindUpAdmin(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : "";
    const action = typeof body?.action === "string" ? body.action : "";
    if (!id) return NextResponse.json({ error: "Business ID is required." }, { status: 400 });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), reviewed_by: auth.user.email };
    if (action === "VERIFY_CREDENTIALS") {
      patch.verification_status = "VERIFIED";
      patch.verified_at = new Date().toISOString();
      const existing = await findUpDatabase(`find_up_businesses?id=eq.${encodeURIComponent(id)}&select=professionals`);
      patch.professionals = (Array.isArray(existing?.[0]?.professionals) ? existing[0].professionals : []).map((person: Record<string, unknown>) => ({ ...person, credentials_verified: true }));
    } else if (action === "UNVERIFY_CREDENTIALS") {
      patch.verification_status = "UNVERIFIED";
      patch.verified_at = null;
    } else if (STATUSES.has(action)) {
      patch.status = action;
      if (action === "APPROVED") patch.approved_at = new Date().toISOString();
    } else if (action === "EDIT") {
      const updates = body?.updates && typeof body.updates === "object" ? body.updates : {};
      for (const [key, value] of Object.entries(updates)) if (EDITABLE.has(key)) patch[key] = value;
      if (Object.keys(patch).length === 2) return NextResponse.json({ error: "No editable fields were supplied." }, { status: 400 });
    } else {
      return NextResponse.json({ error: "Unsupported admin action." }, { status: 400 });
    }
    const rows = await findUpDatabase(`find_up_businesses?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch),
    });
    if (!rows?.length) return NextResponse.json({ error: "Business listing not found." }, { status: 404 });
    return NextResponse.json({ success: true, business: rows[0] });
  } catch (error) {
    console.error("[FIND UP ADMIN] Update failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update this listing." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireFindUpAdmin(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const id = request.nextUrl.searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "Business ID is required." }, { status: 400 });
    await findUpDatabase(`find_up_businesses?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[FIND UP ADMIN] Delete failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete this listing." }, { status: 503 });
  }
}
