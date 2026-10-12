import { NextResponse } from "next/server";

export const runtime = "nodejs";

function expiryAfterMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Live token route is working.",
    sessionExpireTime: expiryAfterMinutes(5),
    newSessionExpireTime: expiryAfterMinutes(1),
  });
}

export async function POST() {
  return NextResponse.json({
    success: true,
    message: "Live token created.",
    sessionExpireTime: expiryAfterMinutes(5),
    newSessionExpireTime: expiryAfterMinutes(1),
  });
}