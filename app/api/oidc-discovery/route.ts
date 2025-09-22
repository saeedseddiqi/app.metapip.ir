import { NextRequest, NextResponse } from "next/server";

// Force dynamic so we can call upstream every time in diagnostics
export const dynamic = "force-dynamic";
// Use Node.js runtime to avoid potential outbound fetch limitations in Edge
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const base = searchParams.get("base");
    if (!base) {
      return NextResponse.json({ error: "missing 'base' query param" }, { status: 400 });
    }
    const wellKnown = `${base.replace(/\/$/, "")}/.well-known/openid-configuration`;
    const res = await fetch(wellKnown, {
      method: "GET",
      headers: { Accept: "application/json" },
      // You may add a timeout if your runtime supports AbortController
    });
    const text = await res.text();
    let json: any = {};
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return NextResponse.json({ ok: res.ok, status: res.status, data: json }, { status: res.ok ? 200 : res.status });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
