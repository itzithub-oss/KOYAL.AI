import type { NextRequest } from "next/server";

const ADMIN_PATHS = ["/admin", "/api/admin"];
const MAINTENANCE_EXEMPT_API_PATHS = ["/api/payments/webhook", "/api/system-config"];
const FEATURE_API_PATHS: Record<string, string> = {
  "/api/find-up": "find_up",
  "/api/image": "image_creation",
  "/api/live-token": "voice",
  "/api/speech": "voice",
};

function isPathOrChild(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(base + "/");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

function maintenancePage(message: string) {
  const safeMessage = escapeHtml(message);
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>KOYAL AI · Maintenance</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 0%,#3b1422 0%,#130d16 48%,#09090d 100%);color:#fff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.panel{width:min(100%,560px);padding:42px 30px;border:1px solid rgba(255,92,125,.28);border-radius:24px;background:rgba(18,14,22,.88);box-shadow:0 24px 80px rgba(0,0,0,.4);text-align:center}.mark{display:inline-grid;place-items:center;width:64px;height:64px;margin-bottom:22px;border-radius:20px;background:rgba(255,71,109,.13);color:#ff6b8b;font-size:30px}.eyebrow{color:#ff829c;font-size:11px;font-weight:700;letter-spacing:.2em}.panel h1{margin:12px 0;font-size:clamp(26px,6vw,38px)}.message{margin:0;color:#d6cbd2;font-size:16px;line-height:1.7;overflow-wrap:anywhere}.hint{margin:26px 0 0;color:#938994;font-size:12px}
</style>
</head>
<body><main class="panel"><div class="mark" aria-hidden="true">✦</div><div class="eyebrow">KOYAL AI</div><h1>We’ll be back soon</h1><p class="message">${safeMessage}</p><p class="hint">Please check back in a little while.</p></main></body>
</html>`,
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Retry-After": "300",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Keep administrator access and payment-provider callbacks available.
  if (
    ADMIN_PATHS.some(path => isPathOrChild(pathname, path)) ||
    MAINTENANCE_EXEMPT_API_PATHS.some(path => isPathOrChild(pathname, path))
  ) {
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("KOYAL maintenance check skipped: Supabase server configuration is missing.");
    return;
  }

  try {
    const baseUrl = supabaseUrl.replace(/\/$/, "");
    const response = await fetch(
      `${baseUrl}/rest/v1/koyal_admin_system_settings?select=maintenance_mode,maintenance_message&id=eq.true&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          ...(serviceKey.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${serviceKey}` }),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      },
    );

    if (!response.ok) {
      console.error("KOYAL maintenance settings lookup failed:", response.status);
      return;
    }

    const rows = await response.json() as Array<{ maintenance_mode?: boolean; maintenance_message?: string; feature_flags?: Record<string, boolean> }>;
    const settings = rows?.[0];
    const flags = settings?.feature_flags && typeof settings.feature_flags === "object" ? settings.feature_flags : {};

    if (settings?.maintenance_mode === true) {
      const message = typeof settings.maintenance_message === "string" &&
        settings.maintenance_message.trim().length >= 5
        ? settings.maintenance_message.trim().slice(0, 500)
        : "KOYAL AI is temporarily under maintenance. Please try again soon.";
      if (pathname.startsWith("/api/")) {
        return Response.json(
          { error: "maintenance_mode", message },
          {
            status: 503,
            headers: {
              "Cache-Control": "no-store, no-cache, must-revalidate",
              "Retry-After": "300",
            },
          },
        );
      }
      return maintenancePage(message);
    }

    if (pathname.startsWith("/api/")) {
      const pathFeature = Object.entries(FEATURE_API_PATHS).find(([path]) => isPathOrChild(pathname, path))?.[1];
      let requestedFeature = pathFeature;
      if (pathname === "/api/find-up") {
        requestedFeature = request.nextUrl.searchParams.get("feature") === "tours_travels" ? "tours_travels" : "find_up";
      }
      if (pathname === "/api/chat" && request.method === "POST") {
        try {
          const body = await request.clone().json() as { voiceMode?: boolean; preciseMode?: boolean; featureKey?: string };
          if (body.voiceMode === true) requestedFeature = "voice";
          else if (body.preciseMode === true) requestedFeature = "precise_mode";
          else if (body.featureKey === "tours_travels") requestedFeature = "tours_travels";
        } catch { /* The route validates malformed request bodies itself. */ }
      }
      if (requestedFeature && flags[requestedFeature] === false) {
        return Response.json(
          { error: "feature_disabled", message: "This feature is temporarily unavailable." },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
  } catch (error) {
    // A database/network outage must not accidentally lock out every public route.
    console.error("KOYAL maintenance settings lookup unavailable:", error instanceof Error ? error.message : "unknown error");
    return;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
