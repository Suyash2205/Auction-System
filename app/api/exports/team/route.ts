import { NextResponse } from "next/server";
import { getActiveTournament } from "@/lib/auction-db";

export async function GET() {
  const tournament = await getActiveTournament();
  const rows = [
    ["Team", "Owner", "Budget", "Spent", "Remaining", "Players"],
    ...(tournament?.teams.map((team) => {
      const players = tournament.lots
        .filter((lot) => lot.soldToTeamId === team.id)
        .map((lot) => `${lot.player.name} (${lot.category})`)
        .join("; ");

      return [
        team.name,
        team.ownerName,
        String(team.budget),
        String(team.spent),
        String(team.budget - team.spent),
        players
      ];
    }) ?? [])
  ];

  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"lush-teams.csv\""
    }
  });
}
