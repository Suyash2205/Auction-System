import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";
import { getActiveTournament } from "@/lib/auction-db";
import { prisma } from "@/lib/prisma";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tournament = await getActiveTournament(id);

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }

  const incompleteCount = tournament.lots.filter((lot) => lot.status !== "SOLD").length;
  if (incompleteCount > 0) {
    return NextResponse.json({ error: "All players must be sold before ending the auction." }, { status: 400 });
  }

  await prisma.auditLog.deleteMany({
    where: { tournamentId: id, action: "AUCTION_ENDED" }
  });
  await writeAuditLog({
    action: "AUCTION_ENDED",
    entityType: "Tournament",
    entityId: id,
    tournamentId: id,
    summary: `Ended auction for ${tournament.name}`,
    details: { tournamentId: id }
  });

  const refreshedTournament = await getActiveTournament(id);

  return NextResponse.json({ tournament: refreshedTournament, auctionEnded: true });
}
