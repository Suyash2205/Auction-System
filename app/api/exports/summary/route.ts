import { NextResponse } from "next/server";
import { getActiveTournament } from "@/lib/auction-db";

export async function GET() {
  const tournament = await getActiveTournament();
  const rows = [
    ["Player", "Category", "Base Price", "Status", "Sold Team", "Sold Amount"],
    ...(tournament?.lots.map((lot) => [
      lot.player.name,
      lot.category,
      String(lot.basePrice),
      lot.status,
      lot.soldToTeam?.name ?? "",
      String(lot.soldAmount ?? "")
    ]) ?? [])
  ];

  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"lush-auction-summary.csv\""
    }
  });
}
