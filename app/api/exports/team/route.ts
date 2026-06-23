import { NextResponse } from "next/server";
import { demoTournament, formatPoints } from "@/lib/demo-data";

export function GET() {
  const rows = [
    ["Team", "Owner", "Budget", "Spent", "Remaining"],
    ...demoTournament.teams.map((team) => [
      team.name,
      team.ownerName,
      String(team.budget),
      String(team.spent),
      String(team.budget - team.spent)
    ])
  ];

  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="lush-teams-${formatPoints(Date.now()).replaceAll(",", "")}.csv"`
    }
  });
}
