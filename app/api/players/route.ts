import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const PHOTO_BUCKET = "player-photos";

function cleanFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function GET() {
  const players = await prisma.player.findMany({
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ players });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const experience = String(formData.get("experience") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const dominantHand = String(formData.get("dominantHand") ?? "").trim();
  const photo = formData.get("photo");

  if (!name || !phone || !experience) {
    return NextResponse.json({ error: "Name, mobile number, and experience are required." }, { status: 400 });
  }

  let photoUrl: string | undefined;

  if (photo instanceof File && photo.size > 0) {
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
  }

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
