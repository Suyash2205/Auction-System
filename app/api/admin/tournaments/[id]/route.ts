import { NextResponse } from "next/server";
import { getActiveTournament } from "@/lib/auction-db";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tournament = await getActiveTournament(id);

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }

  return NextResponse.json({ tournament });
}
