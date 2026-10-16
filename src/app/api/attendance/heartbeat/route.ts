import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshToken =
      cookieStore.get("refreshToken")?.value ||
      cookieStore.get("selfera_refresh_token")?.value;

    let userEmail: string | null = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      userEmail = user?.email || null;
    } catch {}

    if (!userEmail && !refreshToken) {
      return NextResponse.json({ skipped: true, reason: "unauthenticated" });
    }

    const rawIssuer = process.env.OIDC_ISSUER_URL;
    const issuerUrl = (!rawIssuer || rawIssuer === "https://admin.selfera.co.uk" || rawIssuer.includes("automaitee-admin.vercel.app"))
      ? "https://selfera-admin-api.vercel.app"
      : rawIssuer;

    const clientId = process.env.OIDC_CLIENT_ID;
    const clientSecret = process.env.OIDC_CLIENT_SECRET;

    const payload: any = {
      app: "sales",
    };
    if (clientId && clientSecret) {
      payload.client_id = clientId;
      payload.client_secret = clientSecret;
    }
    if (userEmail) {
      payload.email = userEmail;
    }
    if (refreshToken) {
      payload.refresh_token = refreshToken;
    }

    const res = await fetch(`${issuerUrl}/api/attendance/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
