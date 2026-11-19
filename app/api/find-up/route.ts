import { NextRequest, NextResponse } from "next/server";
import { findUpBusinesses, searchFindUpBusinesses } from "../../../lib/find-up-data.mjs";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") || "").trim();
  if (!query) return NextResponse.json({ results: [] });
  if (query.length > 180) return NextResponse.json({ error: "Search is too long." }, { status: 400 });
  return NextResponse.json({ results: searchFindUpBusinesses(findUpBusinesses, query) });
}
