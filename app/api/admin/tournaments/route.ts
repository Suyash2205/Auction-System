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
  const body = await request.json();
  const name = String(body.name ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Tournament name is required." }, { status: 400 });
  }

  const tournament = await prisma.tournament.create({
    data: {
      name,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      teamKitty: Number(body.teamKitty || 90000),
      bidIncrement: Number(body.bidIncrement || 1000)
    },
    include: getTournamentInclude()
  });

  await writeAuditLog({
    action: "CREATE",
    entityType: "Tournament",
    entityId: tournament.id,
    tournamentId: tournament.id,
    summary: `Created tournament ${tournament.name}`,
    details: { name, teamKitty: tournament.teamKitty, bidIncrement: tournament.bidIncrement }
  });

  return NextResponse.json({ tournament }, { status: 201 });
}
