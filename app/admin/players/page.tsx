import Image from "next/image";
import Link from "next/link";
import { Camera, Download, Phone, Plus, Search, Trophy, UsersRound } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function RegisteredPlayersPage() {
  const players = await prisma.player.findMany({
    orderBy: { createdAt: "desc" }
  });

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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead className="bg-[#f6fbf7] text-sm text-court-ink/60">
                <tr>
                  <th className="px-5 py-3 font-semibold">Player</th>
                  <th className="px-5 py-3 font-semibold">Mobile</th>
                  <th className="px-5 py-3 font-semibold">Experience</th>
                  <th className="px-5 py-3 font-semibold">City</th>
                  <th className="px-5 py-3 font-semibold">Hand</th>
                  <th className="px-5 py-3 font-semibold">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-court-ink/10">
                {players.map((player) => (
                  <tr key={player.id} className="align-middle">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-court-mint text-court-ink">
                          {player.photoUrl ? (
                            <Image src={player.photoUrl} alt={player.name} fill className="object-cover" sizes="56px" />
                          ) : (
                            <Camera size={20} />
                          )}
                        </div>
                        <div>
                          <p className="font-bold">{player.name}</p>
                          <p className="text-sm text-court-ink/50">ID {player.id.slice(-6)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-2 font-semibold">
                        <Phone size={15} /> {player.phone}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-court-ink/70">{player.experience}</td>
                    <td className="px-5 py-4 text-court-ink/70">{player.city || "-"}</td>
                    <td className="px-5 py-4 text-court-ink/70">{player.dominantHand || "-"}</td>
                    <td className="px-5 py-4 text-court-ink/70">
                      {new Intl.DateTimeFormat("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      }).format(player.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
