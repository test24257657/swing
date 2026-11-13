import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, setSessionCookie, clearSessionCookie, getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const password = body?.password;
    const adminPassword = process.env.ADMIN_PASSWORD || "admin";

    if (!password || password !== adminPassword) {
      return NextResponse.json({ error: "Invalid terminal password" }, { status: 401 });
    }

    const token = await createSessionToken();
    const res = NextResponse.json({ success: true, message: "Terminal authenticated" });
    setSessionCookie(res, token);
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  const isAuthed = await getSession();
  return NextResponse.json({ authenticated: isAuthed });
}

export async function DELETE() {
  const res = NextResponse.json({ success: true, message: "Logged out" });
  clearSessionCookie(res);
  return res;
}
