import { NextRequest, NextResponse } from "next/server";
import { findUpBusinesses, searchFindUpBusinesses } from "../../../lib/find-up-data.mjs";
import { supabaseRequest } from "../../../lib/cashfree-server";

export const dynamic = "force-dynamic";

function toBusiness(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description || "",
    location: row.location,
    startingPrice: row.starting_price || "",
    contactName: row.contact_name || "",
    operatorName: row.operator_name || "",
    phone: row.phone || "",
    email: row.email || "",
    website: row.website || "",
    professionalName: row.professional_name || "",
    qualifications: row.qualifications || [],
    experience: row.experience || "",
    services: row.services || [],
    serviceHours: row.service_hours || "",
  };
}

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") || "").trim();
  if (!query) return NextResponse.json({ results: [] });
  if (query.length > 180) return NextResponse.json({ error: "Search is too long." }, { status: 400 });
  try {
    const rows = await supabaseRequest("koyal_partner_directory?select=*&status=eq.active&order=created_at.desc&limit=1000") as Array<Record<string, any>>;
    const businesses = (rows || []).map(toBusiness);
    return NextResponse.json({ results: searchFindUpBusinesses(businesses, query) });
  } catch {
    // Keep the original verified seed listing available until the migration is applied.
    return NextResponse.json({ results: searchFindUpBusinesses(findUpBusinesses, query), directoryFallback: true });
  }
}
