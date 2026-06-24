import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";
import { getTournamentInclude } from "@/lib/auction-db";
import { prisma } from "@/lib/prisma";

function getTournamentSetupInclude() {
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
        soldToTeam: true
      },
      orderBy: { orderIndex: "asc" as const }
    }
  };
}

export async function GET(request: Request) {
  try {
    const view = new URL(request.url).searchParams.get("view");
    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      include: view === "setup" ? getTournamentSetupInclude() : getTournamentInclude()
    });
    const ownerLogs = await prisma.auditLog.findMany({
      where: { action: "OWNER_RESERVED" },
      select: { tournamentId: true, details: true }
    });
    const ownerTeamsByTournament = new Map<string, Set<string>>();
    ownerLogs.forEach((log) => {
      const teamId = typeof log.details === "object" && log.details && "teamId" in log.details ? String(log.details.teamId) : "";
      if (!log.tournamentId || !teamId) return;
      const teamIds = ownerTeamsByTournament.get(log.tournamentId) ?? new Set<string>();
      teamIds.add(teamId);
      ownerTeamsByTournament.set(log.tournamentId, teamIds);
    });

    return NextResponse.json({
      tournaments: tournaments.map((tournament) => ({
        ...tournament,
        ownerTeamIds: [...(ownerTeamsByTournament.get(tournament.id) ?? new Set<string>())]
      }))
    });
  } catch (error) {
    console.error("Tournament list failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load tournaments." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();

    if (!name) {
      return NextResponse.json({ error: "Tournament name is required." }, { status: 400 });
    }

    const teamKitty = Number(body.teamKitty || 90000);
    const bidIncrement = Number(body.bidIncrement || 1000);

    if (!Number.isFinite(teamKitty) || !Number.isFinite(bidIncrement) || teamKitty <= 0 || bidIncrement <= 0) {
      return NextResponse.json({ error: "Team budget and bid increment must be valid positive numbers." }, { status: 400 });
    }

    const createdTournament = await prisma.tournament.create({
      data: {
        name,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        teamKitty,
        bidIncrement
      }
    });

    await writeAuditLog({
      action: "CREATE",
      entityType: "Tournament",
      entityId: createdTournament.id,
      tournamentId: createdTournament.id,
      summary: `Created tournament ${createdTournament.name}`,
      details: { name, teamKitty: createdTournament.teamKitty, bidIncrement: createdTournament.bidIncrement }
    });

    const tournament = await prisma.tournament.findUnique({
      where: { id: createdTournament.id },
      include: getTournamentInclude()
    });

    return NextResponse.json({ tournament: tournament ?? createdTournament }, { status: 201 });
  } catch (error) {
    console.error("Tournament create failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create tournament." }, { status: 500 });
  }
}
