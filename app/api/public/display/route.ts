import { NextResponse } from "next/server";
import { getActiveTournament } from "@/lib/auction-db";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tournament = await getActiveTournament();

    if (!tournament) {
      return NextResponse.json({ tournament: null }, { headers: { "cache-control": "no-store" } });
    }
    const auctionEnded = Boolean(
      await prisma.auditLog.findFirst({
        where: { tournamentId: tournament.id, action: "AUCTION_ENDED" }
      })
    );

    const liveLot = tournament.lots.find((lot) => lot.status === "LIVE") ?? null;
    const completedCategory = liveLot
      ? null
      : tournament.lots
          .filter((lot) => !["QUEUED", "LIVE", "SKIPPED"].includes(lot.status))
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]?.category ?? null;
    const latestTransition = await prisma.auditLog.findFirst({
      where: { tournamentId: tournament.id, action: "DISPLAY_TRANSITION" },
      orderBy: { createdAt: "desc" },
      select: { entityId: true }
    });

    return NextResponse.json(
      { transitionId: latestTransition?.entityId ?? null, tournament, liveLot: auctionEnded ? null : liveLot, completedCategory, auctionEnded },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("Public display failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load display state." },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }
}
