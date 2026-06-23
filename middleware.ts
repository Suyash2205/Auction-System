import { NextRequest, NextResponse } from "next/server";

const protectedPrefixes = ["/admin", "/api/admin", "/api/exports"];

function isProtected(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

async function verifySession(value: string | undefined) {
  if (!value || !process.env.NEXTAUTH_SECRET) return false;

  const [timestamp, signature] = value.split(".");
  if (!timestamp || !signature) return false;

  const issuedAt = Number(timestamp);
  if (!Number.isFinite(issuedAt)) return false;

  const maxAgeMs = 1000 * 60 * 60 * 12;
  if (Date.now() - issuedAt > maxAgeMs) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(process.env.NEXTAUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(timestamp));
  const expected = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");

  return expected === signature;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  const isAuthed = await verifySession(request.cookies.get("auction_admin")?.value);

  if (isAuthed) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/exports/:path*"]
};
