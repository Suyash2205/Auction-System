import { NextResponse } from "next/server";
import { getActiveTournament } from "@/lib/auction-db";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const ownerName = String(body.ownerName ?? "").trim();

  if (!name || !ownerName) {
    return NextResponse.json({ error: "Team name and owner name are required." }, { status: 400 });
  }

  await prisma.team.create({
    data: {
      tournamentId: id,
      name,
      ownerName,
      ownerPhone: String(body.ownerPhone ?? "").trim() || null,
      ownerEmail: String(body.ownerEmail ?? "").trim() || null,
      color: String(body.color ?? "").trim() || "#1f8f64",
      budget: Number(body.budget || 90000)
    }
  });

  const tournament = await getActiveTournament(id);
  return NextResponse.json({ tournament }, { status: 201 });
}
