import type { NextRequest } from "next/server";
import { parsePlanParams } from "@/lib/plan";
import { buildIcs } from "@/lib/ics";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const parsed = parsePlanParams({
    lf: sp.get("lf"),
    ff: sp.get("ff"),
    crops: sp.get("crops"),
  });

  if (!parsed.ok) {
    return new Response(parsed.error + "\n", {
      status: 400,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(buildIcs(parsed.plan), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="sowcal.ics"',
      // CDN strips s-maxage from the client-visible Cache-Control,
      // so the CDN TTL is set separately (see memory/friction).
      "Cache-Control": "public, max-age=3600",
      "Vercel-CDN-Cache-Control": "public, s-maxage=3600",
    },
  });
}
