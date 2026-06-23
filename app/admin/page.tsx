import Link from "next/link";
import { CalendarDays, CircleDollarSign, Gavel, UsersRound } from "lucide-react";
import { PlayerCard } from "@/components/player-card";
import { StatCard } from "@/components/stat-card";
import { categoryConfig, demoTournament, formatPoints } from "@/lib/demo-data";

export default function AdminDashboard() {
  const totalSlots = Object.values(categoryConfig).reduce((sum, item) => sum + item.required, 0);

  return (
    <div className="min-h-screen">
      <section className="court-grid bg-court-green text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:py-14">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-court-lime">Auctioneer workspace</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">
              Run the Lush Pickleball League auction from one screen.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-white/78">
              Register players, prepare teams, control bids, and screen-share a clean live display for owners on Google Meet.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/admin/auction" className="rounded-md bg-court-lime px-5 py-3 text-sm font-bold text-court-ink transition hover:bg-white">
                Start Auction
              </Link>
              <Link href="/register" className="rounded-md border border-white/30 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                Player Link
              </Link>
            </div>
          </div>
          <div className="rounded-lg border border-white/20 bg-white/12 p-5 backdrop-blur">
            <p className="text-sm font-semibold text-court-lime">Rulebook defaults</p>
            <div className="mt-5 grid gap-3">
              {Object.entries(categoryConfig).map(([key, item]) => (
                <div key={key} className="flex items-center justify-between rounded-md bg-white/12 px-4 py-3">
                  <span className="font-semibold">{key} · {item.label}</span>
                  <span className="text-sm text-white/75">{item.required} slot · {formatPoints(item.basePrice)} base</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard icon={UsersRound} label="Teams" value={`${demoTournament.teams.length}/10`} helper="Demo setup, expandable to league format" />
          <StatCard icon={CircleDollarSign} label="Kitty" value={formatPoints(demoTournament.kitty)} helper="Points per team" />
          <StatCard icon={Gavel} label="Increment" value={formatPoints(demoTournament.bidIncrement)} helper="Minimum bid raise" />
          <StatCard icon={CalendarDays} label="Squad Size" value={`${totalSlots}`} helper="5 male and 1 female player" />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-lg border border-court-ink/10 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">Tournament Setup</h2>
                <p className="mt-1 text-sm text-court-ink/60">Current tournament draft and owner teams.</p>
              </div>
              <Link href="/admin/tournaments" className="rounded-md bg-court-ink px-4 py-2 text-sm font-semibold text-white">
                Configure
              </Link>
            </div>
            <div className="mt-5 divide-y divide-court-ink/10">
              {demoTournament.teams.map((team) => (
                <div key={team.id} className="flex items-center justify-between gap-3 py-4">
                  <div className="flex items-center gap-3">
                    <span className="h-4 w-4 rounded-full" style={{ background: team.color }} />
                    <div>
                      <p className="font-semibold">{team.name}</p>
                      <p className="text-sm text-court-ink/55">{team.ownerName}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{formatPoints(team.budget - team.spent)} left</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">Registered Players</h2>
                <p className="mt-1 text-sm text-court-ink/60">Reusable player database preview.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {demoTournament.players.slice(0, 2).map((player) => (
                <PlayerCard key={player.id} player={player} compact />
              ))}
            </div>
            <Link href="/admin/players" className="mt-4 inline-flex rounded-md bg-court-ink px-4 py-2 text-sm font-semibold text-white">
              View Real Registrations
            </Link>
          </section>
        </div>
      </section>
    </div>
  );
}
