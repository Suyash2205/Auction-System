import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const PHOTO_BUCKET = "player-photos";
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

function cleanFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get("auction_admin")?.value;
  const [timestamp, signature] = session?.split(".") ?? [];
  const expected = timestamp && process.env.NEXTAUTH_SECRET
    ? createHmac("sha256", process.env.NEXTAUTH_SECRET).update(timestamp).digest("hex")
    : "";

  if (!timestamp || signature !== expected || Date.now() - Number(timestamp) > 1000 * 60 * 60 * 12) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const players = await prisma.player.findMany({
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ players });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit({ key: `register:${ip}`, limit: 20, windowMs: 60 * 60 * 1000 });

  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const experience = String(formData.get("experience") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const dominantHand = String(formData.get("dominantHand") ?? "").trim();
  const photo = formData.get("photo");

  if (!name || !phone || !experience || !city || !dominantHand) {
    return NextResponse.json({ error: "All player details are required." }, { status: 400 });
  }

  if (!/^[0-9+\-\s()]{7,18}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid mobile number." }, { status: 400 });
  }

  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "Player photo is required." }, { status: 400 });
  }

  const existingPlayer = await prisma.player.findFirst({ where: { phone } });
  if (existingPlayer) {
    return NextResponse.json({ error: "This mobile number is already registered." }, { status: 409 });
  }

  let photoUrl: string | undefined;

  if (photo.size > MAX_PHOTO_SIZE) {
    return NextResponse.json({ error: "Photo must be 5 MB or smaller." }, { status: 400 });
  }

  if (!ALLOWED_PHOTO_TYPES.has(photo.type)) {
    return NextResponse.json({ error: "Photo must be JPG, PNG, or WebP." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ error: "Photo upload is not configured yet." }, { status: 500 });
  }

  const { data: buckets } = await supabase.storage.listBuckets();
  const hasPhotoBucket = buckets?.some((bucket) => bucket.name === PHOTO_BUCKET);

  if (!hasPhotoBucket) {
    const { error: bucketError } = await supabase.storage.createBucket(PHOTO_BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"]
    });

    if (bucketError) {
      return NextResponse.json({ error: bucketError.message }, { status: 500 });
    }
  }

  const extension = photo.name.includes(".") ? photo.name.split(".").pop() : "jpg";
  const path = `${Date.now()}-${cleanFileName(name)}.${cleanFileName(extension ?? "jpg")}`;
  const bytes = await photo.arrayBuffer();

  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, bytes, {
    contentType: photo.type || "image/jpeg",
    upsert: false
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  photoUrl = data.publicUrl;

  const player = await prisma.player.create({
    data: {
      name,
      phone,
      experience,
      city: city || null,
      dominantHand: dominantHand || null,
      photoUrl
    }
  });

  return NextResponse.json({ player }, { status: 201 });
}
