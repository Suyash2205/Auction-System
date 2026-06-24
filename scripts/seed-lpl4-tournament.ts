import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { describeLpl4Teams, LPL4_TOURNAMENT_NAME, seedLpl4Tournament } from "../lib/seed-lpl4-tournament";

function loadEnvFile(fileName: string) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  const contents = readFileSync(filePath, "utf8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!value || process.env[key]) continue;
    process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");
loadEnvFile(".env.seed");

if (!process.env.DATABASE_URL && process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const force = process.argv.includes("--force");
    const result = await seedLpl4Tournament(prisma, { force });

    if (!result.created) {
      console.log(`Tournament already exists: "${LPL4_TOURNAMENT_NAME}" (${result.tournamentId})`);
      console.log(`  Teams: ${result.teams} · Players: ${result.players} · Lots: ${result.lots}`);
      console.log("Run with --force to delete and recreate.");
      return;
    }

    if (result.createdPlayers.length) {
      console.log(`Created ${result.createdPlayers.length} new player records.`);
    }

    console.log(`\nSeeded "${LPL4_TOURNAMENT_NAME}"`);
    console.log(`  Tournament ID: ${result.tournamentId}`);
    console.log(`  Teams: ${result.teams}`);
    console.log(`  Players: ${result.players}`);
    console.log(`  Auction lots: ${result.lots}`);
    console.log("\nTeams:");
    for (const team of describeLpl4Teams()) {
      const playing = team.playingOwner ? ` · playing owner: ${team.playingOwner}` : " · owner not playing";
      console.log(`  - ${team.name} (${team.owners})${playing}`);
    }
    console.log("\nOpen http://localhost:3000/admin/tournaments to review, then /admin/auction to run the auction.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
