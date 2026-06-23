import { createHmac } from "crypto";
import { NextResponse } from "next/server";

function sign(timestamp: string) {
  return createHmac("sha256", process.env.NEXTAUTH_SECRET ?? "dev-secret").update(timestamp).digest("hex");
}

export async function POST(request: Request) {
  const { password } = await request.json().catch(() => ({ password: "" }));
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const timestamp = String(Date.now());
  const response = NextResponse.json({ ok: true });
  response.cookies.set("auction_admin", `${timestamp}.${sign(timestamp)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });

  return response;
}
