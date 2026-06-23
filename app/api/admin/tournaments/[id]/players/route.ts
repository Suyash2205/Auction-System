import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";
import { categoryConfig } from "@/lib/demo-data";
import { getActiveTournament } from "@/lib/auction-db";
import { prisma } from "@/lib/prisma";
import type { PlayerCategory } from "@/lib/types";

const validCategories = new Set(["M1", "M2", "M3", "M4", "F1"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const playerId = String(body.playerId ?? "");
  const category = String(body.category ?? "") as PlayerCategory;

  if (!playerId || !validCategories.has(category)) {
    return NextResponse.json({ error: "Player and category are required." }, { status: 400 });
  }

  const basePrice = Number(body.basePrice || categoryConfig[category].basePrice);
  const count = await prisma.auctionLot.count({ where: { tournamentId: id } });

  const existingLot = await prisma.auctionLot.findFirst({
    where: { tournamentId: id, playerId }
  });

  await prisma.$transaction([
    prisma.tournamentPlayer.upsert({
      where: { tournamentId_playerId: { tournamentId: id, playerId } },
      update: { category, basePrice },
      create: { tournamentId: id, playerId, category, basePrice }
    }),
    existingLot
      ? prisma.auctionLot.update({
          where: { id: existingLot.id },
          data: { category, basePrice }
        })
      : prisma.auctionLot.create({
          data: { tournamentId: id, playerId, category, basePrice, orderIndex: count }
        })
  ]);

  await writeAuditLog({
    action: existingLot ? "UPDATE" : "CREATE",
    entityType: "TournamentPlayer",
    entityId: playerId,
    tournamentId: id,
    summary: `${existingLot ? "Updated" : "Added"} player in category ${category}`,
    details: { playerId, category, basePrice }
  });

  const tournament = await getActiveTournament(id);
  return NextResponse.json({ tournament }, { status: 201 });
}
