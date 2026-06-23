import { NextResponse } from "next/server";
import { getActiveTournament } from "@/lib/auction-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const tournament = await getActiveTournament();

  if (!tournament) {
    return NextResponse.json({ tournament: null }, { headers: { "cache-control": "no-store" } });
  }

  const liveLot = tournament.lots.find((lot) => lot.status === "LIVE") ?? null;
  const completedCategory = liveLot
    ? null
    : tournament.lots
        .filter((lot) => !["QUEUED", "LIVE", "SKIPPED"].includes(lot.status))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]?.category ?? null;

  return NextResponse.json(
    { tournament, liveLot, completedCategory },
    { headers: { "cache-control": "no-store" } }
  );
}
