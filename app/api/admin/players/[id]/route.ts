import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const experience = String(body.experience ?? "").trim();

  if (!name || !phone || !experience) {
    return NextResponse.json({ error: "Name, mobile number, and experience are required." }, { status: 400 });
  }

  const player = await prisma.player.update({
    where: { id },
    data: {
      name,
      phone,
      experience,
      city: String(body.city ?? "").trim() || null,
      dominantHand: String(body.dominantHand ?? "").trim() || null
    }
  });

  await writeAuditLog({
    action: "UPDATE",
    entityType: "Player",
    entityId: id,
    summary: `Updated player ${player.name}`,
    details: { name: player.name, phone: player.phone, experience: player.experience }
  });

  return NextResponse.json({ player });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const player = await prisma.player.findUnique({
    where: { id },
    include: { lots: true }
  });

  if (!player) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  const soldLots = player.lots.filter((lot) => lot.status === "SOLD" && lot.soldToTeamId && lot.soldAmount);

  await prisma.$transaction(async (tx) => {
    for (const lot of soldLots) {
      await tx.team.update({
        where: { id: lot.soldToTeamId! },
        data: { spent: { decrement: lot.soldAmount! } }
      });
    }

    await tx.auctionLot.deleteMany({ where: { playerId: id } });
    await tx.tournamentPlayer.deleteMany({ where: { playerId: id } });
    await tx.player.delete({ where: { id } });
  });

  await writeAuditLog({
    action: "DELETE",
    entityType: "Player",
    entityId: id,
    summary: `Deleted player ${player.name}`,
    details: { name: player.name, soldAdjustments: soldLots.length }
  });

  return NextResponse.json({ ok: true });
}
