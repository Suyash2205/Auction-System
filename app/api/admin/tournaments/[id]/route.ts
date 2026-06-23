import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";
import { getActiveTournament, getTournamentInclude } from "@/lib/auction-db";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tournament = await getActiveTournament(id);

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }

  return NextResponse.json({ tournament });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const name = String(body.name ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Tournament name is required." }, { status: 400 });
  }

  const tournament = await prisma.tournament.update({
    where: { id },
    data: {
      name,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      teamKitty: Number(body.teamKitty || 90000),
      bidIncrement: Number(body.bidIncrement || 1000)
    },
    include: getTournamentInclude()
  });

  await writeAuditLog({
    action: "UPDATE",
    entityType: "Tournament",
    entityId: id,
    tournamentId: id,
    summary: `Updated tournament ${tournament.name}`,
    details: { name: tournament.name, teamKitty: tournament.teamKitty, bidIncrement: tournament.bidIncrement }
  });

  return NextResponse.json({ tournament });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { lots: { select: { id: true } } }
  });

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }

  const lotIds = tournament.lots.map((lot) => lot.id);

  await prisma.$transaction([
    prisma.bid.deleteMany({ where: { lotId: { in: lotIds } } }),
    prisma.auctionLot.deleteMany({ where: { tournamentId: id } }),
    prisma.tournamentPlayer.deleteMany({ where: { tournamentId: id } }),
    prisma.team.deleteMany({ where: { tournamentId: id } }),
    prisma.tournament.delete({ where: { id } })
  ]);

  await writeAuditLog({
    action: "DELETE",
    entityType: "Tournament",
    entityId: id,
    tournamentId: id,
    summary: `Deleted tournament ${tournament.name}`,
    details: { name: tournament.name }
  });

  return NextResponse.json({ ok: true });
}
