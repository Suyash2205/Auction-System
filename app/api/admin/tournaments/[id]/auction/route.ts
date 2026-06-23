import { NextResponse } from "next/server";
import { getActiveTournament } from "@/lib/auction-db";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const action = String(body.action ?? "");
  const lotId = String(body.lotId ?? "");

  if (!lotId) {
    return NextResponse.json({ error: "Auction lot is required." }, { status: 400 });
  }

  const lot = await prisma.auctionLot.findUnique({
    where: { id: lotId },
    include: { bids: { orderBy: { createdAt: "asc" } } }
  });
  const tournamentConfig = await prisma.tournament.findUnique({ where: { id } });

  if (!lot || lot.tournamentId !== id || !tournamentConfig) {
    return NextResponse.json({ error: "Lot not found." }, { status: 404 });
  }

  if (action === "live") {
    await prisma.$transaction([
      prisma.auctionLot.updateMany({
        where: { tournamentId: id, status: "LIVE" },
        data: { status: "QUEUED" }
      }),
      prisma.auctionLot.update({
        where: { id: lotId },
        data: { status: "LIVE" }
      })
    ]);
  }

  if (action === "bid") {
    const teamId = String(body.teamId ?? "");
    const amount = Number(body.amount);
    const latestBid = lot.bids.at(-1);
    const minimumBid = Math.max(lot.basePrice, (latestBid?.amount ?? lot.basePrice - tournamentConfig.bidIncrement) + tournamentConfig.bidIncrement);

    if (!teamId || !Number.isFinite(amount) || amount < minimumBid) {
      return NextResponse.json({ error: `Bid must be at least ${minimumBid}.` }, { status: 400 });
    }

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team || team.tournamentId !== id) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    if (amount > team.budget - team.spent) {
      return NextResponse.json({ error: "Bid is higher than this team's remaining purse." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.auctionLot.updateMany({
        where: { tournamentId: id, status: "LIVE" },
        data: { status: "QUEUED" }
      }),
      prisma.auctionLot.update({
        where: { id: lotId },
        data: { status: "LIVE" }
      }),
      prisma.bid.create({
        data: { lotId, teamId, amount }
      })
    ]);
  }

  if (action === "sold") {
    if (lot.status === "SOLD") {
      return NextResponse.json({ error: "This player is already sold." }, { status: 400 });
    }

    const latestBid = lot.bids.at(-1);
    if (!latestBid) {
      return NextResponse.json({ error: "Cannot sell without a bid." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.auctionLot.update({
        where: { id: lotId },
        data: { status: "SOLD", soldToTeamId: latestBid.teamId, soldAmount: latestBid.amount }
      }),
      prisma.team.update({
        where: { id: latestBid.teamId },
        data: { spent: { increment: latestBid.amount } }
      })
    ]);
  }

  if (action === "unsold") {
    await prisma.auctionLot.update({
      where: { id: lotId },
      data: { status: "UNSOLD" }
    });
  }

  const tournament = await getActiveTournament(id);
  return NextResponse.json({ tournament });
}
