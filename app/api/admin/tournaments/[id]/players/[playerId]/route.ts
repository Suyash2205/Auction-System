import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";
import { categoryConfig } from "@/lib/demo-data";
import { getActiveTournament } from "@/lib/auction-db";
import { prisma } from "@/lib/prisma";
import type { PlayerCategory } from "@/lib/types";

const validCategories = new Set(["M1", "M2", "M3", "M4", "F1"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string; playerId: string }> }) {
  const { id, playerId } = await context.params;
  const body = await request.json();
  const category = String(body.category ?? "") as PlayerCategory;

  if (!validCategories.has(category)) {
    return NextResponse.json({ error: "Valid category is required." }, { status: 400 });
  }

  const basePrice = Number(body.basePrice || categoryConfig[category].basePrice);
  const lot = await prisma.auctionLot.findFirst({ where: { tournamentId: id, playerId } });

  if (!lot) {
    return NextResponse.json({ error: "Tournament player not found." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.tournamentPlayer.update({
      where: { tournamentId_playerId: { tournamentId: id, playerId } },
      data: { category, basePrice }
    }),
    prisma.auctionLot.update({
      where: { id: lot.id },
      data: { category, basePrice }
    })
  ]);

  await writeAuditLog({
    action: "UPDATE",
    entityType: "TournamentPlayer",
    entityId: playerId,
    tournamentId: id,
    summary: `Updated player category to ${category}`,
    details: { playerId, category, basePrice }
  });

  const tournament = await getActiveTournament(id);
  return NextResponse.json({ tournament });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string; playerId: string }> }) {
  const { id, playerId } = await context.params;
  const lot = await prisma.auctionLot.findFirst({ where: { tournamentId: id, playerId } });

  if (!lot) {
    return NextResponse.json({ error: "Tournament player not found." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    if (lot.status === "SOLD" && lot.soldToTeamId && lot.soldAmount) {
      await tx.team.update({
        where: { id: lot.soldToTeamId },
        data: { spent: { decrement: lot.soldAmount } }
      });
    }

    await tx.auctionLot.delete({ where: { id: lot.id } });
    await tx.tournamentPlayer.delete({ where: { tournamentId_playerId: { tournamentId: id, playerId } } });
  });
  await writeAuditLog({
    action: "DELETE",
    entityType: "TournamentPlayer",
    entityId: playerId,
    tournamentId: id,
    summary: "Removed player from tournament",
    details: { playerId, lotId: lot.id, soldAdjustment: lot.soldAmount ?? 0 }
  });

  const tournament = await getActiveTournament(id);
  return NextResponse.json({ tournament });
}
