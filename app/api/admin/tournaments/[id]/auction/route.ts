import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";
import { getActiveTournament } from "@/lib/auction-db";
import { canTeamBidInCategory, getMaxAllowedBid, getRequiredReserve } from "@/lib/auction-rules";
import { prisma } from "@/lib/prisma";

type CategoryLot = {
  id: string;
  orderIndex: number;
  status: string;
};

type BudgetLot = {
  category: "M1" | "M2" | "M3" | "M4" | "F1";
  status: string;
  soldToTeamId: string | null;
};

type TeamBudget = {
  id: string;
  budget: number;
  spent: number;
};

type SaleEvent = {
  id: string;
  playerName: string;
  playerPhotoUrl: string | null;
  category: BudgetLot["category"];
  teamName: string;
  teamColor: string | null;
  amount: number;
  kind: "sold" | "owner";
};

function findNextOpenLot(categoryLots: CategoryLot[], currentLotId: string) {
  const queuedLots = categoryLots.filter((item) => item.status === "QUEUED" && item.id !== currentLotId);
  const skippedLots = categoryLots.filter((item) => item.status === "SKIPPED" && item.id !== currentLotId);
  const nextPool = queuedLots.length ? queuedLots : skippedLots;

  return nextPool.length ? nextPool[Math.floor(Math.random() * nextPool.length)] : null;
}

async function finalizeOwnerLots(tournamentId: string, category: BudgetLot["category"]) {
  const categoryLots = await prisma.auctionLot.findMany({
    where: { tournamentId, category },
    include: { bids: true, player: true },
    orderBy: { orderIndex: "asc" }
  });
  const ownerLots = categoryLots.filter((item) => item.status === "UNSOLD" && item.soldToTeamId);
  if (!ownerLots.length) return [];

  const soldAmounts = categoryLots
    .filter((item) => item.status === "SOLD" && item.soldAmount !== null)
    .map((item) => item.soldAmount ?? 0);
  const averageAmount = soldAmounts.length
    ? Math.round(soldAmounts.reduce((total, amount) => total + amount, 0) / soldAmounts.length)
    : categoryLots[0]?.basePrice ?? 0;
  const budgetLots: BudgetLot[] = await prisma.auctionLot.findMany({
    where: { tournamentId },
    select: { category: true, status: true, soldToTeamId: true }
  });
  const teams = await prisma.team.findMany({ where: { tournamentId } });
  const teamById = new Map<string, TeamBudget>(teams.map((team) => [team.id, team]));
  const fullTeamById = new Map(teams.map((team) => [team.id, team]));
  const updates = [];
  const saleEvents: SaleEvent[] = [];
  for (const ownerLot of ownerLots) {
    const team = ownerLot.soldToTeamId ? teamById.get(ownerLot.soldToTeamId) : null;
    if (!team || !ownerLot.soldToTeamId) continue;

    const usableAmount = Math.max(team.budget - team.spent - getRequiredReserve(budgetLots, team.id), 0);
    const soldAmount = Math.min(averageAmount, usableAmount);
    teamById.set(team.id, { ...team, spent: team.spent + soldAmount });
    const fullTeam = fullTeamById.get(team.id);
    saleEvents.push({
      id: `${ownerLot.id}-${soldAmount}`,
      playerName: ownerLot.player.name,
      playerPhotoUrl: ownerLot.player.photoUrl,
      category,
      teamName: fullTeam?.name ?? "Owner Team",
      teamColor: fullTeam?.color ?? null,
      amount: soldAmount,
      kind: "owner"
    });

    updates.push(
      prisma.auctionLot.update({
        where: { id: ownerLot.id },
        data: { status: "SOLD", soldAmount }
      }),
      prisma.team.update({
        where: { id: ownerLot.soldToTeamId },
        data: { spent: { increment: soldAmount } }
      }),
      prisma.auditLog.create({
        data: {
          action: "OWNER_SOLD",
          entityType: "AuctionLot",
          entityId: ownerLot.id,
          tournamentId,
          summary: `Owner player sold at category average ${soldAmount}`,
          details: { lotId: ownerLot.id, teamId: ownerLot.soldToTeamId, category, averageAmount, soldAmount }
        }
      })
    );
  }

  if (updates.length) {
    await prisma.$transaction(updates);
  }

  return saleEvents;
}

async function getOwnerTeamIds(tournamentId: string) {
  const ownerLogs = await prisma.auditLog.findMany({
    where: { tournamentId, action: "OWNER_RESERVED" },
    select: { details: true }
  });

  return [
    ...new Set(
      ownerLogs
        .map((log) => (typeof log.details === "object" && log.details && "teamId" in log.details ? String(log.details.teamId) : ""))
        .filter(Boolean)
    )
  ];
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const action = String(body.action ?? "");
  const lotId = String(body.lotId ?? "");
  const currentCategory = String(body.currentCategory ?? "");
  let saleEvents: SaleEvent[] = [];

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
  const budgetLots: BudgetLot[] = await prisma.auctionLot.findMany({
    where: { tournamentId: id },
    select: { category: true, status: true, soldToTeamId: true }
  });
  const maxOrderIndex = Math.max(...categoryLots.map((item) => item.orderIndex), 0);

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
    const existingOwner = await prisma.auditLog.findFirst({
      where: {
        tournamentId: id,
        action: "OWNER_RESERVED",
        details: {
          path: ["teamId"],
          equals: teamId
        }
      }
    });
    if (existingOwner) {
      return NextResponse.json({ error: `${team.name} already has an owner player.` }, { status: 400 });
    }

    if (amount > team.budget - team.spent) {
      return NextResponse.json({ error: "Bid is higher than this team's remaining purse." }, { status: 400 });
    }

    if (!canTeamBidInCategory(budgetLots, team.id, lot.category)) {
      return NextResponse.json(
        { error: `${team.name} already has the required player count for ${lot.category}.` },
        { status: 400 }
      );
    }

    const maxAllowedBid = getMaxAllowedBid(team, budgetLots, lot.category);
    if (amount > maxAllowedBid) {
      return NextResponse.json(
        { error: `${team.name} can bid up to ${maxAllowedBid}. Required category slots must stay reserved.` },
        { status: 400 }
      );
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

  if (action === "owner") {
    if (lot.status !== "LIVE") {
      return NextResponse.json({ error: "Only the live player can be marked as an owner player." }, { status: 400 });
    }

    const teamId = String(body.teamId ?? "");
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team || team.tournamentId !== id) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }
    if (!canTeamBidInCategory(budgetLots, team.id, lot.category)) {
      return NextResponse.json(
        { error: `${team.name} already has the required player count for ${lot.category}.` },
        { status: 400 }
      );
    }

    const nextOpenLot = findNextOpenLot(categoryLots, lotId);

    await prisma.$transaction([
      prisma.bid.deleteMany({ where: { lotId } }),
      prisma.auctionLot.update({
        where: { id: lotId },
        data: { status: "UNSOLD", soldToTeamId: teamId, soldAmount: null, orderIndex: maxOrderIndex + 1 }
      }),
      ...(nextOpenLot
        ? [
            prisma.auctionLot.update({
              where: { id: nextOpenLot.id },
              data: { status: "LIVE" }
            })
          ]
        : [])
    ]);
    await writeAuditLog({
      action: "OWNER_RESERVED",
      entityType: "AuctionLot",
      entityId: lotId,
      tournamentId: id,
      summary: `Owner player reserved for ${team.name}`,
      details: { lotId, teamId, category: lot.category, nextLotId: nextOpenLot?.id ?? null }
    });

    if (!nextOpenLot) {
      saleEvents = await finalizeOwnerLots(id, lot.category);
    }
  }

  if (action === "skip") {
    if (lot.status !== "LIVE") {
      return NextResponse.json({ error: "Only the live player can be skipped." }, { status: 400 });
    }

    const nextOpenLot = findNextOpenLot(categoryLots, lotId);

    if (!nextOpenLot) {
      return NextResponse.json({ error: "This player cannot be skipped because every other player in this category has already come up." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.auctionLot.update({
        where: { id: lotId },
        data: { status: "SKIPPED", orderIndex: maxOrderIndex + 1 }
      }),
      prisma.auctionLot.update({
        where: { id: nextOpenLot.id },
        data: { status: "LIVE" }
      })
    ]);

    await writeAuditLog({
      action: "SKIP",
      entityType: "AuctionLot",
      entityId: lotId,
      tournamentId: id,
      summary: "Skipped player within category",
      details: { lotId, category: lot.category, nextLotId: nextOpenLot.id }
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

    const nextOpenLot = findNextOpenLot(categoryLots, lotId);
    const soldTeam = await prisma.team.findUnique({ where: { id: latestBid.teamId } });
    const soldPlayer = await prisma.player.findUnique({ where: { id: lot.playerId } });
    saleEvents.push({
      id: `${lotId}-${latestBid.amount}`,
      playerName: soldPlayer?.name ?? "Player",
      playerPhotoUrl: soldPlayer?.photoUrl ?? null,
      category: lot.category,
      teamName: soldTeam?.name ?? "Team",
      teamColor: soldTeam?.color ?? null,
      amount: latestBid.amount,
      kind: "sold"
    });

    await prisma.$transaction([
      prisma.auctionLot.update({
        where: { id: lotId },
        data: { status: "SOLD", soldToTeamId: latestBid.teamId, soldAmount: latestBid.amount }
      }),
      prisma.team.update({
        where: { id: latestBid.teamId },
        data: { spent: { increment: latestBid.amount } }
      }),
      ...(nextOpenLot
        ? [
            prisma.auctionLot.update({
              where: { id: nextOpenLot.id },
              data: { status: "LIVE" }
            })
          ]
        : [])
    ]);
    await writeAuditLog({
      action: "SOLD",
      entityType: "AuctionLot",
      entityId: lotId,
      tournamentId: id,
      summary: `Sold player for ${latestBid.amount}`,
      details: { lotId, teamId: latestBid.teamId, amount: latestBid.amount, nextLotId: nextOpenLot?.id ?? null }
    });

    if (!nextOpenLot) {
      saleEvents = [...saleEvents, ...(await finalizeOwnerLots(id, lot.category))];
    }
  }

  if (action === "unsold") {
    if (lot.status !== "LIVE") {
      return NextResponse.json({ error: "Only the live player can be marked unsold." }, { status: 400 });
    }

    const nextOpenLot = findNextOpenLot(categoryLots, lotId);

    if (!nextOpenLot) {
      return NextResponse.json({ error: "This player cannot be marked unsold because every player in this category must eventually be sold." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.auctionLot.update({
        where: { id: lotId },
        data: { status: "SKIPPED", orderIndex: maxOrderIndex + 1 }
      }),
      prisma.auctionLot.update({
        where: { id: nextOpenLot.id },
        data: { status: "LIVE" }
      })
    ]);
    await writeAuditLog({
      action: "UNSOLD",
      entityType: "AuctionLot",
      entityId: lotId,
      tournamentId: id,
      summary: "Moved unsold player to end of category queue",
      details: { lotId, category: lot.category, nextLotId: nextOpenLot.id }
    });
  }

  if (action === "unsell") {
    if (lot.status !== "SOLD" || !lot.soldToTeamId || lot.soldAmount === null) {
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
  return NextResponse.json({ tournament: tournament ? { ...tournament, ownerTeamIds: await getOwnerTeamIds(id) } : tournament, saleEvents });
}
