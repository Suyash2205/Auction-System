import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";
import { getActiveTournament } from "@/lib/auction-db";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const action = String(body.action ?? "");
  const lotId = String(body.lotId ?? "");
  const currentCategory = String(body.currentCategory ?? "");

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

  const categoryLots = await prisma.auctionLot.findMany({
    where: { tournamentId: id, category: lot.category },
    orderBy: { orderIndex: "asc" },
    include: { bids: { orderBy: { createdAt: "asc" } } }
  });

  const liveLot = await prisma.auctionLot.findFirst({
    where: { tournamentId: id, status: "LIVE" }
  });

  if (liveLot && liveLot.category !== lot.category) {
    const liveCategoryOpenCount = await prisma.auctionLot.count({
      where: {
        tournamentId: id,
        category: liveLot.category,
        status: { in: ["LIVE", "QUEUED", "SKIPPED"] }
      }
    });

    if (liveCategoryOpenCount > 0) {
      return NextResponse.json({ error: "Finish the current category before moving to another category." }, { status: 400 });
    }
  }

  if (currentCategory && currentCategory !== lot.category) {
    const currentCategoryOpenCount = await prisma.auctionLot.count({
      where: {
        tournamentId: id,
        category: currentCategory as typeof lot.category,
        status: { in: ["LIVE", "QUEUED", "SKIPPED"] }
      }
    });

    if (currentCategoryOpenCount > 0) {
      return NextResponse.json({ error: "Finish the current category before moving to another category." }, { status: 400 });
    }
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
    await writeAuditLog({
      action: "LIVE",
      entityType: "AuctionLot",
      entityId: lotId,
      tournamentId: id,
      summary: "Set auction lot live",
      details: { lotId }
    });
  }

  if (action === "bid") {
    if (["SOLD", "UNSOLD"].includes(lot.status)) {
      return NextResponse.json({ error: "This player is already closed. Re-auction first if needed." }, { status: 400 });
    }

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
    await writeAuditLog({
      action: "BID",
      entityType: "Bid",
      entityId: lotId,
      tournamentId: id,
      summary: `${team.name} bid ${amount}`,
      details: { lotId, teamId, amount }
    });
  }

  if (action === "skip") {
    if (lot.status !== "LIVE") {
      return NextResponse.json({ error: "Only the live player can be skipped." }, { status: 400 });
    }

    const currentIndex = categoryLots.findIndex((item) => item.id === lotId);
    const nextQueuedLot =
      categoryLots.slice(currentIndex + 1).find((item) => item.status === "QUEUED") ??
      categoryLots.find((item) => item.status === "QUEUED");

    if (!nextQueuedLot) {
      return NextResponse.json({ error: "This player cannot be skipped because every other player in this category has already come up." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.auctionLot.update({
        where: { id: lotId },
        data: { status: "SKIPPED" }
      }),
      prisma.auctionLot.update({
        where: { id: nextQueuedLot.id },
        data: { status: "LIVE" }
      })
    ]);

    await writeAuditLog({
      action: "SKIP",
      entityType: "AuctionLot",
      entityId: lotId,
      tournamentId: id,
      summary: "Skipped player within category",
      details: { lotId, category: lot.category, nextLotId: nextQueuedLot.id }
    });
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
    await writeAuditLog({
      action: "SOLD",
      entityType: "AuctionLot",
      entityId: lotId,
      tournamentId: id,
      summary: `Sold player for ${latestBid.amount}`,
      details: { lotId, teamId: latestBid.teamId, amount: latestBid.amount }
    });
  }

  if (action === "unsold") {
    await prisma.auctionLot.update({
      where: { id: lotId },
      data: { status: "UNSOLD" }
    });
    await writeAuditLog({
      action: "UNSOLD",
      entityType: "AuctionLot",
      entityId: lotId,
      tournamentId: id,
      summary: "Marked player unsold",
      details: { lotId }
    });
  }

  if (action === "unsell") {
    if (lot.status !== "SOLD" || !lot.soldToTeamId || !lot.soldAmount) {
      return NextResponse.json({ error: "Only a sold player can be unsold." }, { status: 400 });
    }

    if (currentCategory && currentCategory !== lot.category) {
      return NextResponse.json({ error: "You can only unsell players from the category currently being auctioned." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.team.update({
        where: { id: lot.soldToTeamId },
        data: { spent: { decrement: lot.soldAmount } }
      }),
      prisma.bid.deleteMany({
        where: { lotId }
      }),
      prisma.auctionLot.update({
        where: { id: lotId },
        data: { status: "LIVE", soldToTeamId: null, soldAmount: null }
      }),
      prisma.auctionLot.updateMany({
        where: { tournamentId: id, status: "LIVE", id: { not: lotId } },
        data: { status: "QUEUED" }
      })
    ]);

    await writeAuditLog({
      action: "UNSELL",
      entityType: "AuctionLot",
      entityId: lotId,
      tournamentId: id,
      summary: "Unsold player and restarted auction",
      details: { lotId, category: lot.category, teamId: lot.soldToTeamId, amount: lot.soldAmount }
    });
  }

  const tournament = await getActiveTournament(id);
  return NextResponse.json({ tournament });
}
