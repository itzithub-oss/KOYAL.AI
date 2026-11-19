import { NextRequest, NextResponse } from "next/server";
import { rankFindUpBusinesses, validateFindUpApplication } from "../../../lib/find-up.mjs";
import { findUpDatabase } from "../../../lib/find-up-server.mjs";

export const runtime = "nodejs";
const PUBLIC_FIELDS = "id,business_id,business_name,display_name,category,subcategory,description,establishment_year,operating_status,services,keywords,specialisations,search_synonyms,location,pricing,operations,professionals,online_presence,verification_status,category_details,created_at,approved_at";

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function cleanList(value: unknown, maxItems = 40) {
  return Array.isArray(value) ? value.slice(0, maxItems).map((item) => cleanText(item, 180)).filter(Boolean) : [];
}
function jsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export async function GET(request: NextRequest) {
  try {
    const query = cleanText(request.nextUrl.searchParams.get("q"), 240);
    const location = cleanText(request.nextUrl.searchParams.get("location"), 100);
    const category = cleanText(request.nextUrl.searchParams.get("category"), 100);
    const maxPrice = cleanText(request.nextUrl.searchParams.get("maxPrice"), 20);
    if (!query && !location && !category) {
      return NextResponse.json({ businesses: [], total: 0, message: "Enter a service, business type or location to search." });
    }
    const rows = await findUpDatabase(`find_up_businesses?select=${PUBLIC_FIELDS}&status=eq.APPROVED&order=approved_at.desc&limit=1000`);
    const ranked = rankFindUpBusinesses(rows || [], query, { location, category, maxPrice });
    const businesses = ranked.map((business: any) => ({
      ...business,
      professionals: business.verification_status === "VERIFIED"
        ? (business.professionals || []).filter((person: any) => person?.credentials_verified === true)
        : [],
    }));
    return NextResponse.json({ businesses: businesses.slice(0, 50), total: businesses.length });
  } catch (error) {
    console.error("[FIND UP] Search failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Find Up search is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = jsonObject(body?.business);
    const services = Array.isArray(input.services) ? input.services.slice(0, 40).map((service: any) => typeof service === "string" ? { name: cleanText(service, 120), description: "", keywords: [] } : ({ name: cleanText(service?.name, 120), description: cleanText(service?.description, 500), keywords: cleanList(service?.keywords, 12) })).filter((service: any) => service.name) : [];
    const application = {
      business_name: cleanText(input.business_name, 160),
      display_name: cleanText(input.display_name || input.business_name, 160),
      category: cleanText(input.category, 100),
      subcategory: cleanText(input.subcategory, 100),
      description: cleanText(input.description, 2500),
      category_details: jsonObject(input.category_details),
      establishment_year: input.establishment_year ? Number(input.establishment_year) : null,
      operating_status: cleanText(input.operating_status || "Operating", 40),
      services,
      keywords: cleanList(input.keywords),
      specialisations: cleanList(input.specialisations),
      search_synonyms: cleanList(input.search_synonyms),
      location: {
        full_address: cleanText(input.full_address, 300),
        city: cleanText(input.city, 100),
        district: cleanText(input.district, 100),
        state: cleanText(input.state, 100),
        pin_code: cleanText(input.pin_code, 12),
        maps_url: cleanText(input.maps_url, 500),
        latitude: input.latitude === "" || input.latitude == null ? null : Number(input.latitude),
        longitude: input.longitude === "" || input.longitude == null ? null : Number(input.longitude),
        service_areas: cleanList(input.service_areas, 30),
      },
      pricing: jsonObject(input.pricing),
      operations: {
        operating_person: cleanText(input.operating_person, 120),
        public_contact_name: cleanText(input.public_contact_name, 120),
        business_phone: cleanText(input.business_phone, 30),
        whatsapp: cleanText(input.whatsapp, 30),
        business_hours: cleanText(input.business_hours, 500),
      },
      professionals: Array.isArray(input.professionals) ? input.professionals.slice(0, 20).map((person: any) => ({
        name: cleanText(person?.name, 120), degree: cleanText(person?.degree, 160),
        qualifications: cleanList(person?.qualifications, 20), specialisation: cleanList(person?.specialisation, 20),
        experience_years: person?.experience_years ? Number(person.experience_years) : null,
        registration_authority: cleanText(person?.registration_authority, 160),
        registration_number: cleanText(person?.registration_number, 100),
        credentials_verified: false,
      })) : [],
      online_presence: {
        website: cleanText(input.website, 500),
        social_links: cleanList(input.social_links, 20),
        logo_url: cleanText(input.logo_url, 500),
        photo_urls: cleanList(input.photo_urls, 20),
      },
      owner_information: {
        owner_name: cleanText(input.owner_name, 120),
        owner_phone: cleanText(input.owner_phone, 30),
        owner_email: cleanText(input.owner_email, 180),
        designation: cleanText(input.designation, 100),
      },
      private_documents: [],
      status: "PENDING",
      verification_status: "UNVERIFIED",
    };
    const errors = validateFindUpApplication({
      business_name: application.business_name,
      category: application.category,
      description: application.description,
      owner_name: application.owner_information.owner_name,
      owner_phone: application.owner_information.owner_phone,
      city: application.location.city,
      state: application.location.state,
      services: application.services,
    });
    if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    if (application.establishment_year && (application.establishment_year < 1800 || application.establishment_year > new Date().getFullYear())) {
      return NextResponse.json({ error: "Enter a valid establishment year." }, { status: 400 });
    }
    const inserted = await findUpDatabase("find_up_businesses", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(application),
    });
    return NextResponse.json({ success: true, businessId: inserted?.[0]?.business_id, status: "PENDING", message: "Your partnership application has been submitted for review." }, { status: 201 });
  } catch (error) {
    console.error("[FIND UP] Application submission failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not submit the application." }, { status: 503 });
  }
}
