import { NextRequest, NextResponse } from "next/server";
import { UAParser } from "ua-parser-js";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

function getClientIp(req: NextRequest): string {
  // Vercel sets x-forwarded-for; take the first (client) hop.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userAgent = req.headers.get("user-agent") || "";
    const parser = new UAParser(userAgent);
    const ua = parser.getResult();
    const ip = getClientIp(req);

    const sql = getSql();
    await sql`
      INSERT INTO visits
        (ip, user_agent, browser, os, device_type, device_vendor, device_model, timezone, screen_res, language)
      VALUES
        (${ip},
         ${userAgent},
         ${ua.browser.name ? `${ua.browser.name} ${ua.browser.version ?? ""}`.trim() : null},
         ${ua.os.name ? `${ua.os.name} ${ua.os.version ?? ""}`.trim() : null},
         ${ua.device.type ?? "desktop"},
         ${ua.device.vendor ?? null},
         ${ua.device.model ?? null},
         ${body.timezone ?? null},
         ${body.screen ?? null},
         ${body.language ?? null})
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Never break the page over logging -- fail quietly, log server-side.
    console.error("log-visit error:", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
