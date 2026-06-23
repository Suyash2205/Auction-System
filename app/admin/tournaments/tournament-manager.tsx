"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Calendar, Pencil, Plus, Save, Trash2, UsersRound } from "lucide-react";
import { categoryConfig, formatPoints } from "@/lib/demo-data";
import type { PlayerCategory } from "@/lib/types";

type Player = {
  id: string;
  name: string;
  phone: string;
  experience: string;
  city: string | null;
  dominantHand: string | null;
  photoUrl: string | null;
};

type Team = {
  id: string;
  name: string;
  ownerName: string;
  ownerPhone: string | null;
  color: string | null;
  budget: number;
  spent: number;
};

type Lot = {
  id: string;
  playerId: string;
  category: PlayerCategory;
  basePrice: number;
  status: string;
  player: Player;
};

type Tournament = {
  id: string;
  name: string;
  startsAt: string | null;
  teamKitty: number;
  bidIncrement: number;
  teams: Team[];
  lots: Lot[];
};

const colors = ["#1f8f64", "#1677a8", "#d8643f", "#7f56d9", "#d7f241", "#13231d"];

export function TournamentManager() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<PlayerCategory>("M1");

  const selectedTournament = useMemo(
    () => tournaments.find((tournament) => tournament.id === selectedTournamentId) ?? tournaments[0],
    [selectedTournamentId, tournaments]
  );

  async function load() {
    const [playersResponse, tournamentsResponse] = await Promise.all([
      fetch("/api/players"),
      fetch("/api/admin/tournaments")
    ]);
    const playersData = await playersResponse.json();
    const tournamentsData = await tournamentsResponse.json();
    setPlayers(playersData.players ?? []);
    setTournaments(tournamentsData.tournaments ?? []);
    setSelectedTournamentId((current) => current || tournamentsData.tournaments?.[0]?.id || "");
  }

  useEffect(() => {
    load();
  }, []);

  async function createTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/tournaments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        startsAt: form.get("startsAt"),
        teamKitty: form.get("teamKitty"),
        bidIncrement: form.get("bidIncrement")
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not create tournament.");
      return;
    }
    setMessage("Tournament created.");
    await load();
    setSelectedTournamentId(data.tournament.id);
  }

  async function addTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTournament) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/tournaments/${selectedTournament.id}/teams`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        ownerName: form.get("ownerName"),
        ownerPhone: form.get("ownerPhone"),
        budget: form.get("budget") || selectedTournament.teamKitty,
        color: colors[selectedTournament.teams.length % colors.length]
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not add team.");
      return;
    }
    setMessage("Team added.");
    await load();
    event.currentTarget.reset();
  }

  async function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTournament || !selectedPlayerId) return;
    const response = await fetch(`/api/admin/tournaments/${selectedTournament.id}/players`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: selectedPlayerId,
        category: selectedCategory,
        basePrice: categoryConfig[selectedCategory].basePrice
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not add player.");
      return;
    }
    setMessage("Player added to tournament.");
    setSelectedPlayerId("");
    await load();
  }

  async function updateTournament() {
    if (!selectedTournament) return;
    const name = window.prompt("Tournament name", selectedTournament.name);
    if (!name) return;
    const teamKitty = window.prompt("Team budget", String(selectedTournament.teamKitty));
    if (!teamKitty) return;
    const bidIncrement = window.prompt("Bid increment", String(selectedTournament.bidIncrement));
    if (!bidIncrement) return;

    const response = await fetch(`/api/admin/tournaments/${selectedTournament.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, startsAt: selectedTournament.startsAt, teamKitty, bidIncrement })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not update tournament.");
      return;
    }
    setMessage("Tournament updated.");
    await load();
  }

  async function deleteTournament() {
    if (!selectedTournament || !window.confirm(`Delete ${selectedTournament.name}? This removes its teams, auction lots, and bids.`)) return;
    const response = await fetch(`/api/admin/tournaments/${selectedTournament.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not delete tournament.");
      return;
    }
    setSelectedTournamentId("");
    setMessage("Tournament deleted.");
    await load();
  }

  async function updateTeam(team: Team) {
    if (!selectedTournament) return;
    const name = window.prompt("Team name", team.name);
    if (!name) return;
    const ownerName = window.prompt("Owner name", team.ownerName);
    if (!ownerName) return;
    const ownerPhone = window.prompt("Owner phone", team.ownerPhone ?? "") ?? "";
    const budget = window.prompt("Team budget", String(team.budget));
    if (!budget) return;

    const response = await fetch(`/api/admin/tournaments/${selectedTournament.id}/teams/${team.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, ownerName, ownerPhone, budget, color: team.color })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not update team.");
      return;
    }
    setMessage("Team updated.");
    await load();
  }

  async function deleteTeam(team: Team) {
    if (!selectedTournament || !window.confirm(`Delete ${team.name}? Teams with bids cannot be deleted.`)) return;
    const response = await fetch(`/api/admin/tournaments/${selectedTournament.id}/teams/${team.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not delete team.");
      return;
    }
    setMessage("Team deleted.");
    await load();
  }

  async function updateTournamentPlayer(lot: Lot) {
    if (!selectedTournament) return;
    const category = window.prompt("Category: M1, F1, M2, M3, or M4", lot.category) as PlayerCategory | null;
    if (!category) return;
    const basePrice = window.prompt("Base price", String(lot.basePrice));
    if (!basePrice) return;

    const response = await fetch(`/api/admin/tournaments/${selectedTournament.id}/players/${lot.playerId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category, basePrice })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not update player.");
      return;
    }
    setMessage("Tournament player updated.");
    await load();
  }

  async function removeTournamentPlayer(lot: Lot) {
    if (!selectedTournament || !window.confirm(`Remove ${lot.player.name} from this tournament?`)) return;
    const response = await fetch(`/api/admin/tournaments/${selectedTournament.id}/players/${lot.playerId}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not remove player.");
      return;
    }
    setMessage("Player removed from tournament.");
    await load();
  }

  const availablePlayers = players.filter((player) => !selectedTournament?.lots.some((lot) => lot.playerId === player.id));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court-green">Tournament Builder</p>
          <h1 className="mt-2 text-3xl font-bold">Set up auction details</h1>
          <p className="mt-2 text-court-ink/60">Create tournaments, add owners, and select registered players with admin-assigned categories.</p>
        </div>
        {selectedTournament ? (
          <a href="/admin/auction" className="inline-flex items-center justify-center gap-2 rounded-md bg-court-ink px-5 py-3 text-sm font-semibold text-white">
            <Save size={17} /> Open Auction
          </a>
        ) : null}
      </div>

      {message ? <p className="mt-5 rounded-md bg-court-mint px-4 py-3 text-sm font-semibold">{message}</p> : null}
      {error ? <p className="mt-5 rounded-md bg-court-clay/10 px-4 py-3 text-sm font-semibold text-court-clay">{error}</p> : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="space-y-6">
          <form onSubmit={createTournament} className="rounded-lg border border-court-ink/10 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-xl font-semibold"><Calendar size={20} /> New Tournament</h2>
            <div className="mt-5 grid gap-4">
              <input required name="name" className="focus-ring rounded-md border border-court-ink/15 px-4 py-3" placeholder="Tournament name" />
              <input type="date" name="startsAt" className="focus-ring rounded-md border border-court-ink/15 px-4 py-3" />
              <div className="grid grid-cols-2 gap-4">
                <input name="teamKitty" defaultValue="90000" className="focus-ring rounded-md border border-court-ink/15 px-4 py-3" />
                <input name="bidIncrement" defaultValue="1000" className="focus-ring rounded-md border border-court-ink/15 px-4 py-3" />
              </div>
              <button className="rounded-md bg-court-green px-5 py-3 text-sm font-bold text-white">Create Tournament</button>
            </div>
          </form>

          <section className="rounded-lg border border-court-ink/10 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold">Active Tournament</h2>
              {selectedTournament ? (
                <div className="flex gap-2">
                  <button onClick={updateTournament} className="grid h-10 w-10 place-items-center rounded-md border border-court-ink/15" title="Edit tournament" type="button">
                    <Pencil size={16} />
                  </button>
                  <button onClick={deleteTournament} className="grid h-10 w-10 place-items-center rounded-md border border-court-clay/30 text-court-clay" title="Delete tournament" type="button">
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : null}
            </div>
            <select
              value={selectedTournament?.id ?? ""}
              onChange={(event) => setSelectedTournamentId(event.target.value)}
              className="focus-ring mt-4 w-full rounded-md border border-court-ink/15 px-4 py-3"
            >
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>{tournament.name}</option>
              ))}
            </select>
          </section>

          <form onSubmit={addTeam} className="rounded-lg border border-court-ink/10 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-xl font-semibold"><UsersRound size={20} /> Add Team</h2>
            <div className="mt-5 grid gap-4">
              <input required name="name" className="focus-ring rounded-md border border-court-ink/15 px-4 py-3" placeholder="Team name" />
              <input required name="ownerName" className="focus-ring rounded-md border border-court-ink/15 px-4 py-3" placeholder="Owner name" />
              <input name="ownerPhone" className="focus-ring rounded-md border border-court-ink/15 px-4 py-3" placeholder="Owner phone" />
              <input name="budget" defaultValue={selectedTournament?.teamKitty ?? 90000} className="focus-ring rounded-md border border-court-ink/15 px-4 py-3" />
              <button disabled={!selectedTournament} className="inline-flex items-center justify-center gap-2 rounded-md border border-court-ink/15 px-4 py-3 text-sm font-semibold disabled:opacity-50">
                <Plus size={17} /> Add Team
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-6">
          <section className="rounded-lg border border-court-ink/10 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Teams</h2>
            <div className="mt-4 grid gap-3">
              {selectedTournament?.teams.map((team) => (
                <div key={team.id} className="flex items-center justify-between gap-3 rounded-lg border border-court-ink/10 p-4">
                  <div>
                    <span className="flex items-center gap-3 font-semibold">
                      <span className="h-4 w-4 rounded-full" style={{ backgroundColor: team.color ?? "#1f8f64" }} />
                      {team.name}
                    </span>
                    <span className="mt-1 block text-sm text-court-ink/60">{team.ownerName} · {formatPoints(team.budget - team.spent)} left</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateTeam(team)} className="grid h-9 w-9 place-items-center rounded-md border border-court-ink/15" title="Edit team" type="button">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => deleteTeam(team)} className="grid h-9 w-9 place-items-center rounded-md border border-court-clay/30 text-court-clay" title="Delete team" type="button">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )) ?? null}
            </div>
          </section>

          <form onSubmit={addPlayer} className="rounded-lg border border-court-ink/10 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Add Registered Player</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_auto]">
              <select value={selectedPlayerId} onChange={(event) => setSelectedPlayerId(event.target.value)} className="focus-ring rounded-md border border-court-ink/15 px-4 py-3">
                <option value="">Select player</option>
                {availablePlayers.map((player) => (
                  <option key={player.id} value={player.id}>{player.name} · {player.experience}</option>
                ))}
              </select>
              <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value as PlayerCategory)} className="focus-ring rounded-md border border-court-ink/15 px-4 py-3">
                {Object.keys(categoryConfig).map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <button className="rounded-md bg-court-green px-5 py-3 text-sm font-bold text-white">Add</button>
            </div>
          </form>

          <section className="rounded-lg border border-court-ink/10 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Tournament Players</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {selectedTournament?.lots.map((lot) => (
                <div key={lot.id} className="rounded-lg border border-court-ink/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{lot.player.name}</p>
                      <p className="mt-1 text-sm text-court-ink/60">{lot.category} · Base {formatPoints(lot.basePrice)} · {lot.status}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => updateTournamentPlayer(lot)} className="grid h-9 w-9 place-items-center rounded-md border border-court-ink/15" title="Edit category/base price" type="button">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => removeTournamentPlayer(lot)} className="grid h-9 w-9 place-items-center rounded-md border border-court-clay/30 text-court-clay" title="Remove from tournament" type="button">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )) ?? null}
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}
