import Link from "next/link";
import { Camera, Download, Plus, Search, Trophy, UsersRound } from "lucide-react";
import { PlayerAdminTable } from "@/components/player-admin-table";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function RegisteredPlayersPage() {
  let players: Awaited<ReturnType<typeof prisma.player.findMany>> = [];
  let loadError = "";

  try {
    players = await prisma.player.findMany({
      orderBy: { createdAt: "desc" }
    });
  } catch (error) {
    console.error("Registered players page failed", error);
    loadError = error instanceof Error ? error.message : "Could not load players from database.";
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <p className="rounded-md bg-court-clay/10 px-4 py-3 text-sm font-semibold text-court-clay">
          Database error: {loadError}
        </p>
        <p className="mt-3 text-sm text-court-ink/60">Refresh in a few seconds. If this persists, the database connection pool may be busy.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court-green">Player Database</p>
          <h1 className="mt-2 text-3xl font-bold">Registered Players</h1>
          <p className="mt-2 text-court-ink/60">
            These are real registrations saved in Supabase and reusable for future tournaments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/players"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-court-ink/15 px-4 py-3 text-sm font-semibold"
          >
            <Download size={17} /> JSON
          </a>
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-court-ink px-4 py-3 text-sm font-semibold text-white"
          >
            <Plus size={17} /> Registration Link
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-court-ink/10 bg-white p-5 shadow-sm">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-court-mint text-court-ink">
            <UsersRound size={20} />
          </span>
          <p className="mt-4 text-sm font-medium text-court-ink/55">Total Players</p>
          <p className="mt-1 text-3xl font-bold">{players.length}</p>
        </div>
        <div className="rounded-lg border border-court-ink/10 bg-white p-5 shadow-sm">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-court-mint text-court-ink">
            <Camera size={20} />
          </span>
          <p className="mt-4 text-sm font-medium text-court-ink/55">With Photos</p>
          <p className="mt-1 text-3xl font-bold">{players.filter((player) => player.photoUrl).length}</p>
        </div>
        <div className="rounded-lg border border-court-ink/10 bg-white p-5 shadow-sm">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-court-mint text-court-ink">
            <Trophy size={20} />
          </span>
          <p className="mt-4 text-sm font-medium text-court-ink/55">Latest Registration</p>
          <p className="mt-1 text-xl font-bold">{players[0]?.name ?? "None yet"}</p>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-court-ink/10 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-court-ink/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">All Player Profiles</h2>
          <div className="flex h-11 items-center gap-2 rounded-md border border-court-ink/15 px-3 text-court-ink/55">
            <Search size={17} />
            <span className="text-sm">Search will come with filters</span>
          </div>
        </div>

        {players.length === 0 ? (
          <div className="grid place-items-center px-5 py-16 text-center">
            <UsersRound className="text-court-green" size={42} />
            <h3 className="mt-4 text-2xl font-semibold">No registrations yet</h3>
            <p className="mt-2 max-w-md text-court-ink/60">
              Share the registration link with players. Their profiles will appear here automatically.
            </p>
            <Link href="/register" className="mt-5 rounded-md bg-court-green px-5 py-3 text-sm font-bold text-white">
              Open Registration Link
            </Link>
          </div>
        ) : (
          <PlayerAdminTable players={players.map((player) => ({ ...player, createdAt: player.createdAt.toISOString() }))} />
        )}
      </section>
    </div>
  );
}
