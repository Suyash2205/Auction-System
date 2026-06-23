import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";
import { getTournamentInclude } from "@/lib/auction-db";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: "desc" },
    include: getTournamentInclude()
  });

  return NextResponse.json({ tournaments });
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
