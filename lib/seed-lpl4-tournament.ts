import type { PrismaClient } from "@prisma/client";
import { categoryConfig, categoryOrder } from "@/lib/demo-data";
import { lpl4Players } from "@/lib/lpl4-players";
import { lpl4Teams } from "@/lib/lpl4-teams";

export const LPL4_TOURNAMENT_NAME = "Lush Pickleball League 4";

export type SeedLpl4Result = {
  tournamentId: string;
  created: boolean;
  teams: number;
  players: number;
  lots: number;
  createdPlayers: string[];
};

function normalizePlayerName(value: string) {
  return value
    .toLowerCase()
    .replace(/^(mr|mrs|ms|dr)\.?\s+/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findPlayerByName<T extends { name: string }>(players: T[], name: string) {
  const normalized = normalizePlayerName(name);
  return players.find((player) => normalizePlayerName(player.name) === normalized) ?? null;
}

function formatOwnerLabel(team: (typeof lpl4Teams)[number]) {
  return team.coOwnerName ? `${team.ownerName} & ${team.coOwnerName}` : team.ownerName;
}

export async function seedLpl4Tournament(
  prisma: PrismaClient,
  options: { force?: boolean } = {}
): Promise<SeedLpl4Result> {
  const force = options.force ?? false;
  const existing = await prisma.tournament.findFirst({ where: { name: LPL4_TOURNAMENT_NAME } });

  if (existing && !force) {
    const [teams, players, lots] = await Promise.all([
      prisma.team.count({ where: { tournamentId: existing.id } }),
      prisma.tournamentPlayer.count({ where: { tournamentId: existing.id } }),
      prisma.auctionLot.count({ where: { tournamentId: existing.id } })
    ]);

    return {
      tournamentId: existing.id,
      created: false,
      teams,
      players,
      lots,
      createdPlayers: []
    };
  }

  if (existing && force) {
    await prisma.tournament.delete({ where: { id: existing.id } });
  }

  const dbPlayers = await prisma.player.findMany();
  const playerIdByListId = new Map<string, string>();
  const createdPlayers: string[] = [];
  let phoneCounter = 1;

  for (const listed of lpl4Players) {
    const lookupName = listed.dbName ?? listed.name;
    let player = findPlayerByName(dbPlayers, lookupName);

    if (!player) {
      const phone = `99000${String(phoneCounter).padStart(5, "0")}`;
      phoneCounter += 1;
      player = await prisma.player.create({
        data: {
          name: lookupName,
          phone,
          experience: "LPL 4",
          city: "Mumbai",
          dominantHand: "Right"
        }
      });
      dbPlayers.push(player);
      createdPlayers.push(player.name);
    }

    playerIdByListId.set(listed.id, player.id);
  }

  const tournament = await prisma.tournament.create({
    data: {
      name: LPL4_TOURNAMENT_NAME,
      startsAt: new Date("2026-07-18T10:00:00.000Z"),
      teamKitty: 90000,
      bidIncrement: 1000
    }
  });

  for (const team of lpl4Teams) {
    await prisma.team.create({
      data: {
        tournamentId: tournament.id,
        name: team.name,
        ownerName: formatOwnerLabel(team),
        color: team.color,
        budget: 90000
      }
    });
  }

  let orderIndex = 0;

  for (const category of categoryOrder) {
    const categoryPlayers = lpl4Players.filter((player) => player.category === category);
    for (const listed of categoryPlayers) {
      const playerId = playerIdByListId.get(listed.id);
      if (!playerId) continue;

      const basePrice = categoryConfig[category].basePrice;

      await prisma.tournamentPlayer.create({
        data: {
          tournamentId: tournament.id,
          playerId,
          category,
          basePrice
        }
      });

      await prisma.auctionLot.create({
        data: {
          tournamentId: tournament.id,
          playerId,
          category,
          basePrice,
          orderIndex,
          status: "QUEUED"
        }
      });

      orderIndex += 1;
    }
  }

  return {
    tournamentId: tournament.id,
    created: true,
    teams: lpl4Teams.length,
    players: lpl4Players.length,
    lots: orderIndex,
    createdPlayers
  };
}

export function describeLpl4Teams() {
  return lpl4Teams.map((team) => ({
    name: team.name,
    owners: formatOwnerLabel(team),
    playingOwner: team.playingOwnerListName ?? null
  }));
}
