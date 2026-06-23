import { prisma } from "@/lib/prisma";

export function getTournamentInclude() {
  return {
    teams: {
      orderBy: { createdAt: "asc" as const }
    },
    players: {
      include: { player: true },
      orderBy: { selectedAt: "asc" as const }
    },
    lots: {
      include: {
        player: true,
        bids: {
          include: { team: true },
          orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
        },
        soldToTeam: true
      },
      orderBy: { orderIndex: "asc" as const }
    }
  };
}

export async function getActiveTournament(id?: string | null) {
  if (id) {
    return prisma.tournament.findUnique({
      where: { id },
      include: getTournamentInclude()
    });
  }

  return prisma.tournament.findFirst({
    orderBy: { createdAt: "desc" },
    include: getTournamentInclude()
  });
}

export function latestBid<T extends { bids: Array<{ amount: number; createdAt: Date }> }>(lot: T) {
  return lot.bids.at(-1);
}
