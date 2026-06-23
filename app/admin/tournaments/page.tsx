import { Calendar, Plus, Save, UsersRound } from "lucide-react";
import { PlayerCard } from "@/components/player-card";
import { categoryConfig, demoTournament, formatPoints } from "@/lib/demo-data";

export default function TournamentSetupPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court-green">Tournament Builder</p>
          <h1 className="mt-2 text-3xl font-bold">Set up auction details</h1>
          <p className="mt-2 text-court-ink/60">Create the tournament, add owners, and choose which registered players are participating.</p>
        </div>
        <button className="inline-flex items-center justify-center gap-2 rounded-md bg-court-ink px-5 py-3 text-sm font-semibold text-white">
          <Save size={17} /> Save Draft
        </button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-lg border border-court-ink/10 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-xl font-semibold"><Calendar size={20} /> Tournament</h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold">
              Tournament Name
              <input defaultValue={demoTournament.name} className="focus-ring rounded-md border border-court-ink/15 px-4 py-3 font-normal" />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Date
              <input type="date" defaultValue={demoTournament.date} className="focus-ring rounded-md border border-court-ink/15 px-4 py-3 font-normal" />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-2 text-sm font-semibold">
                Team Kitty
                <input defaultValue={demoTournament.kitty} className="focus-ring rounded-md border border-court-ink/15 px-4 py-3 font-normal" />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Bid Increment
                <input defaultValue={demoTournament.bidIncrement} className="focus-ring rounded-md border border-court-ink/15 px-4 py-3 font-normal" />
              </label>
            </div>
          </div>

          <h2 className="mt-8 flex items-center gap-2 text-xl font-semibold"><UsersRound size={20} /> Teams & Owners</h2>
          <div className="mt-4 grid gap-3">
            {demoTournament.teams.map((team) => (
              <div key={team.id} className="rounded-lg border border-court-ink/10 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="h-4 w-4 rounded-full" style={{ backgroundColor: team.color }} />
                    <div>
                      <p className="font-semibold">{team.name}</p>
                      <p className="text-sm text-court-ink/55">{team.ownerName} · {team.ownerPhone}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{formatPoints(team.budget)} pts</span>
                </div>
              </div>
            ))}
            <button className="inline-flex items-center justify-center gap-2 rounded-md border border-court-ink/15 px-4 py-3 text-sm font-semibold">
              <Plus size={17} /> Add Team
            </button>
          </div>
        </section>

        <section>
          <div className="rounded-lg border border-court-ink/10 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Auction Categories</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(categoryConfig).map(([category, item]) => (
                <div key={category} className="rounded-md bg-[#f6fbf7] p-4">
                  <p className="font-semibold">{category} · {item.label}</p>
                  <p className="mt-1 text-sm text-court-ink/55">{item.required} required per team · {formatPoints(item.basePrice)} base</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <h2 className="mb-4 text-xl font-semibold">Selected Players</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {demoTournament.lots.map((lot) => {
                const player = demoTournament.players.find((item) => item.id === lot.playerId);
                if (!player) return null;

                return (
                  <div key={lot.playerId} className="rounded-lg border border-court-ink/10 bg-white p-3 shadow-sm">
                    <PlayerCard player={player} category={lot.category} basePrice={lot.basePrice} compact />
                    <label className="mt-3 grid gap-2 text-sm font-semibold">
                      Admin Category
                      <select defaultValue={lot.category} className="focus-ring rounded-md border border-court-ink/15 px-3 py-2 font-normal">
                        {Object.entries(categoryConfig).map(([category, item]) => (
                          <option key={category} value={category}>
                            {category} - {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
