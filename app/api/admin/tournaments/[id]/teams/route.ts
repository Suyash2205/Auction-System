import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";
import { getActiveTournament } from "@/lib/auction-db";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const ownerName = String(body.ownerName ?? "").trim();

  if (!name || !ownerName) {
    return NextResponse.json({ error: "Team name and owner name are required." }, { status: 400 });
  }

  const team = await prisma.team.create({
    data: {
      tournamentId: id,
      name,
      ownerName,
      ownerPhone: String(body.ownerPhone ?? "").trim() || null,
      ownerEmail: String(body.ownerEmail ?? "").trim() || null,
      color: String(body.color ?? "").trim() || "#1f8f64",
      budget: Number(body.budget || 90000)
    }
  });

  await writeAuditLog({
    action: "CREATE",
    entityType: "Team",
    entityId: team.id,
    tournamentId: id,
    summary: `Added team ${team.name}`,
    details: { name: team.name, ownerName: team.ownerName, budget: team.budget }
  });

  const tournament = await getActiveTournament(id);
  return NextResponse.json({ tournament }, { status: 201 });
}
