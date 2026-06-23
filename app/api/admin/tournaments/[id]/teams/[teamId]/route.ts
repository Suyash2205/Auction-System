import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";
import { getActiveTournament } from "@/lib/auction-db";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; teamId: string }> }) {
  const { id, teamId } = await context.params;
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const ownerName = String(body.ownerName ?? "").trim();

  if (!name || !ownerName) {
    return NextResponse.json({ error: "Team name and owner name are required." }, { status: 400 });
  }

  const existingTeam = await prisma.team.findUnique({ where: { id: teamId } });

  if (!existingTeam || existingTeam.tournamentId !== id) {
    return NextResponse.json({ error: "Team not found." }, { status: 404 });
  }

  const team = await prisma.team.update({
    where: { id: teamId },
    data: {
      name,
      ownerName,
      ownerPhone: String(body.ownerPhone ?? "").trim() || null,
      ownerEmail: String(body.ownerEmail ?? "").trim() || null,
      color: String(body.color ?? "").trim() || "#1f8f64",
      budget: Number(body.budget || 90000)
    }
  });

  await writeAuditLog({
    action: "UPDATE",
    entityType: "Team",
    entityId: teamId,
    tournamentId: id,
    summary: `Updated team ${team.name}`,
    details: { name: team.name, ownerName: team.ownerName, budget: team.budget }
  });

  const tournament = await getActiveTournament(id);
  return NextResponse.json({ tournament });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string; teamId: string }> }) {
  const { id, teamId } = await context.params;
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { bids: true, soldLots: true }
  });

  if (!team || team.tournamentId !== id) {
    return NextResponse.json({ error: "Team not found." }, { status: 404 });
  }

  if (team.bids.length || team.soldLots.length) {
    return NextResponse.json({ error: "Teams with bids or sold players cannot be deleted. Rename/correct the team instead." }, { status: 400 });
  }

  await prisma.team.delete({ where: { id: teamId } });
  await writeAuditLog({
    action: "DELETE",
    entityType: "Team",
    entityId: teamId,
    tournamentId: id,
    summary: `Deleted team ${team.name}`,
    details: { name: team.name }
  });

  const tournament = await getActiveTournament(id);
  return NextResponse.json({ tournament });
}
