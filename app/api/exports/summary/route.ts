import { NextResponse } from "next/server";
import { demoTournament } from "@/lib/demo-data";

export function GET() {
  const rows = [
    ["Player", "Category", "Base Price", "Status", "Sold Team", "Sold Amount"],
    ...demoTournament.lots.map((lot) => {
      const player = demoTournament.players.find((item) => item.id === lot.playerId);
      const team = lot.soldToTeamId ? demoTournament.teams.find((item) => item.id === lot.soldToTeamId) : undefined;

      return [
        player?.name ?? "",
        lot.category,
        String(lot.basePrice),
        lot.status,
        team?.name ?? "",
        String(lot.soldAmount ?? "")
      ];
    })
  ];

  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"lush-auction-summary.csv\""
    }
  });
}
