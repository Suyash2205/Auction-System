import { NextResponse } from "next/server";
import { getActiveTournament } from "@/lib/auction-db";

export async function GET() {
  const tournament = await getActiveTournament();

  if (!tournament) {
    return NextResponse.json({ tournament: null });
  }

  const liveLot =
    tournament.lots.find((lot) => lot.status === "LIVE") ??
    tournament.lots.find((lot) => lot.status === "QUEUED") ??
    tournament.lots[0] ??
    null;

  return NextResponse.json({ tournament, liveLot });
}
