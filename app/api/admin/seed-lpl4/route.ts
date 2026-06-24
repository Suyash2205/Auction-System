import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { describeLpl4Teams, LPL4_TOURNAMENT_NAME, seedLpl4Tournament } from "@/lib/seed-lpl4-tournament";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const force = Boolean(body.force);

    const result = await seedLpl4Tournament(prisma, { force });

    if (result.created) {
      await writeAuditLog({
        action: "CREATE",
        entityType: "Tournament",
        entityId: result.tournamentId,
        tournamentId: result.tournamentId,
        summary: `Seeded ${LPL4_TOURNAMENT_NAME}`,
        details: {
          teams: result.teams,
          players: result.players,
          lots: result.lots,
          createdPlayers: result.createdPlayers
        }
      });
    }

    return NextResponse.json({
      ok: true,
      tournamentName: LPL4_TOURNAMENT_NAME,
      ...result,
      teamsDetail: describeLpl4Teams()
    });
  } catch (error) {
    console.error("LPL4 seed failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not seed LPL4 tournament." },
      { status: 500 }
    );
  }
}
