import { seedLpl4Tournament, LPL4_TOURNAMENT_NAME, describeLpl4Teams } from "../lib/seed-lpl4-tournament";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Run with: vercel env run --environment production -- npm run seed:lpl4:direct");
    process.exit(1);
  }

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

    console.log(`Seeded "${LPL4_TOURNAMENT_NAME}" (${result.tournamentId})`);
    console.log(`  Teams: ${result.teams} · Players: ${result.players} · Lots: ${result.lots}`);
    for (const team of describeLpl4Teams()) {
      const playing = team.playingOwner ? ` · playing: ${team.playingOwner}` : "";
      console.log(`  - ${team.name} (${team.owners})${playing}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
