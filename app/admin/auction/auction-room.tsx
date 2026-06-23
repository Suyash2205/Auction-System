"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronRight, Download, Gavel, RotateCcw, SkipForward, Trophy } from "lucide-react";
import { categoryConfig, categoryOrder, formatPoints } from "@/lib/demo-data";
import type { PlayerCategory } from "@/lib/types";

type Team = {
  id: string;
  name: string;
  ownerName: string;
  color: string | null;
  budget: number;
  spent: number;
};

type Bid = {
  id: string;
  teamId: string;
  amount: number;
  createdAt: string;
  team: Team;
};

type Lot = {
  id: string;
  playerId: string;
  category: PlayerCategory;
  basePrice: number;
  status: string;
  soldAmount: number | null;
  soldToTeamId: string | null;
  player: {
    id: string;
    name: string;
    photoUrl: string | null;
    experience: string;
    city: string | null;
    dominantHand: string | null;
  };
  bids: Bid[];
};

type Tournament = {
  id: string;
  name: string;
  teamKitty: number;
  bidIncrement: number;
  teams: Team[];
  lots: Lot[];
};

export function AuctionRoom() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [category, setCategory] = useState<PlayerCategory>("M1");
  const [customTeamId, setCustomTeamId] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [error, setError] = useState("");

  const selectedTournament = useMemo(
    () => tournaments.find((tournament) => tournament.id === selectedTournamentId) ?? tournaments[0],
    [selectedTournamentId, tournaments]
  );
  const categoryLots = selectedTournament?.lots.filter((lot) => lot.category === category) ?? [];
  const activeCategory = (selectedTournament?.lots.find((lot) => lot.status === "LIVE")?.category ?? category) as PlayerCategory;
  const activeCategoryLots = selectedTournament?.lots.filter((lot) => lot.category === activeCategory) ?? [];
  const activeCategoryIsOpen = activeCategoryLots.some((lot) => ["LIVE", "QUEUED", "SKIPPED"].includes(lot.status));
  const canChangeCategory = !activeCategoryIsOpen || activeCategory === category;
  const currentLot =
    categoryLots.find((lot) => lot.status === "LIVE") ??
    categoryLots.find((lot) => lot.status === "QUEUED") ??
    categoryLots.find((lot) => lot.status === "SKIPPED") ??
    categoryLots[0];
  const openCurrentLot = currentLot && ["LIVE", "QUEUED", "SKIPPED"].includes(currentLot.status);
  const latestBid = currentLot?.bids.at(-1);
  const leadingTeam = latestBid?.team;
  const defaultNextAmount = currentLot
    ? Math.max(currentLot.basePrice, (latestBid?.amount ?? currentLot.basePrice - (selectedTournament?.bidIncrement ?? 1000)) + (selectedTournament?.bidIncrement ?? 1000))
    : 0;

  async function load() {
    const response = await fetch("/api/admin/tournaments");
    const data = await response.json();
    setTournaments(data.tournaments ?? []);
    setSelectedTournamentId((current) => current || data.tournaments?.[0]?.id || "");
    setCustomTeamId((current) => current || data.tournaments?.[0]?.teams?.[0]?.id || "");
  }

  useEffect(() => {
    load();
  }, []);

  async function action(payload: Record<string, unknown>, targetLotId = currentLot?.id) {
    if (!selectedTournament || !targetLotId) return;
    setError("");
    const response = await fetch(`/api/admin/tournaments/${selectedTournament.id}/auction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lotId: targetLotId, currentCategory: category, ...payload })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Auction action failed.");
      return;
    }
    await load();
  }

  async function addBid(teamId: string, amount: number) {
    if (!openCurrentLot) {
      setError("This player is already closed. Use Re-auction if you need to restart.");
      return;
    }
    await action({ action: "bid", teamId, amount });
  }

  async function addCustomBid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(customAmount);
    if (!amount || amount < defaultNextAmount) {
      setError(`Bid must be at least ${formatPoints(defaultNextAmount)} pts.`);
      return;
    }
    await addBid(customTeamId, amount);
    setCustomAmount("");
  }

  async function nextPlayer() {
    if (!selectedTournament || !currentLot) return;
    const currentIndex = categoryLots.findIndex((lot) => lot.id === currentLot.id);
    const nextLot =
      categoryLots.slice(currentIndex + 1).find((lot) => lot.status === "QUEUED") ??
      categoryLots.find((lot) => lot.status === "QUEUED") ??
      categoryLots.find((lot) => lot.status === "SKIPPED");
    if (!nextLot) return;
    setError("");
    const response = await fetch(`/api/admin/tournaments/${selectedTournament.id}/auction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "live", lotId: nextLot.id, currentCategory: category })
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Could not move to next player.");
      return;
    }
    await load();
  }

  async function skipPlayer() {
    if (!currentLot) return;
    await action({ action: "skip" });
  }

  async function unsellPlayer(lot: Lot) {
    await action({ action: "unsell" }, lot.id);
  }

  function selectCategory(nextCategory: PlayerCategory) {
    if (nextCategory !== activeCategory && activeCategoryIsOpen) {
      setError(`Finish ${activeCategory} before moving to another category.`);
      return;
    }
    setCategory(nextCategory);
    setError("");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court-green">Live control room</p>
          <h1 className="mt-2 text-3xl font-bold">Auctioneer Panel</h1>
          <p className="mt-2 text-court-ink/60">Bids, sold status, and live display state now save to the database.</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/exports/team" className="inline-flex items-center justify-center gap-2 rounded-md border border-court-ink/15 px-4 py-3 text-sm font-semibold">
            <Download size={17} /> Team CSV
          </a>
          <a href="/display" target="_blank" className="inline-flex items-center justify-center gap-2 rounded-md bg-court-ink px-4 py-3 text-sm font-semibold text-white">
            <Trophy size={17} /> Display
          </a>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select value={selectedTournament?.id ?? ""} onChange={(event) => setSelectedTournamentId(event.target.value)} className="focus-ring rounded-md border border-court-ink/15 bg-white px-4 py-3">
          {tournaments.map((tournament) => (
            <option key={tournament.id} value={tournament.id}>{tournament.name}</option>
          ))}
        </select>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categoryOrder.map((item) => (
            <button
              key={item}
              onClick={() => selectCategory(item)}
              disabled={item !== activeCategory && !canChangeCategory}
              className={`h-11 rounded-md px-5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${category === item ? "bg-court-green text-white shadow-glow" : "bg-white text-court-ink"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="mt-5 rounded-md bg-court-clay/10 px-4 py-3 text-sm font-semibold text-court-clay">{error}</p> : null}

      {!selectedTournament || !currentLot ? (
        <section className="mt-8 rounded-lg border border-court-ink/10 bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold">No auction lots ready</h2>
          <p className="mt-2 text-court-ink/60">Create a tournament and add players first.</p>
        </section>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="overflow-hidden rounded-lg border border-court-ink/10 bg-white shadow-sm">
            <div className="relative h-64 bg-court-mint">
              {currentLot.player.photoUrl ? (
                <Image src={currentLot.player.photoUrl} alt={currentLot.player.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 420px" />
              ) : null}
              <div className="absolute left-3 top-3 rounded-md bg-court-lime px-3 py-1 text-xs font-bold text-court-ink">
                {currentLot.category} · {categoryConfig[currentLot.category].label}
              </div>
            </div>
            <div className="p-4">
              <h3 className="text-2xl font-bold">{currentLot.player.name}</h3>
              <p className="mt-2 text-court-ink/60">{currentLot.player.experience} · {currentLot.player.city || "-"} · {currentLot.player.dominantHand || "-"} hand</p>
              <p className="mt-2 font-semibold">Base {formatPoints(currentLot.basePrice)} pts · {currentLot.status}</p>
            </div>
          </article>

          <section className="rounded-lg border border-court-ink/10 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-court-ink/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-court-ink/55">Current Bid</p>
                <p className="mt-1 text-5xl font-bold text-court-ink">{formatPoints(latestBid?.amount ?? currentLot.basePrice)} pts</p>
                {leadingTeam ? (
                  <div className="mt-3 inline-flex items-center gap-3 rounded-md bg-court-mint px-4 py-3">
                    <span className="h-4 w-4 rounded-full" style={{ backgroundColor: leadingTeam.color ?? "#1f8f64" }} />
                    <span className="text-2xl font-black text-court-ink">{leadingTeam.name}</span>
                  </div>
                ) : (
                  <p className="mt-3 text-lg font-semibold text-court-ink/60">Waiting for first bid</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => action({ action: "sold" })} disabled={!latestBid || currentLot.status === "SOLD"} className="rounded-md bg-court-green px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Sold</button>
                <button onClick={skipPlayer} disabled={currentLot.status !== "LIVE"} className="inline-flex items-center justify-center gap-2 rounded-md border border-court-ink/15 px-5 py-3 text-sm font-bold disabled:opacity-40">
                  <SkipForward size={17} /> Skip
                </button>
                <button onClick={() => action({ action: "unsold" })} disabled={currentLot.status === "SOLD"} className="rounded-md bg-court-clay px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Unsold</button>
                <button onClick={nextPlayer} className="inline-flex items-center justify-center gap-2 rounded-md border border-court-ink/15 px-5 py-3 text-sm font-bold">
                  Next Player <ChevronRight size={17} />
                </button>
              </div>
            </div>

            <div className="mt-5">
              <h2 className="text-lg font-semibold">Quick Bid</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {selectedTournament.teams.map((team) => (
                  <button key={team.id} disabled={!openCurrentLot} onClick={() => addBid(team.id, defaultNextAmount)} className="rounded-lg border border-court-ink/10 p-4 text-left transition hover:border-court-green hover:bg-court-mint/30 disabled:cursor-not-allowed disabled:opacity-40">
                    <span className="flex items-center gap-2 font-semibold">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: team.color ?? "#1f8f64" }} />
                      {team.name}
                    </span>
                    <span className="mt-2 block text-sm text-court-ink/55">Bid {formatPoints(defaultNextAmount)} · {formatPoints(team.budget - team.spent)} left</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={addCustomBid} className="mt-5 rounded-lg border border-court-ink/10 bg-[#f6fbf7] p-4">
              <h2 className="text-lg font-semibold">Custom Bid</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <select value={customTeamId} onChange={(event) => setCustomTeamId(event.target.value)} className="focus-ring h-12 rounded-md border border-court-ink/15 bg-white px-3">
                  {selectedTournament.teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
                <input value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} min={defaultNextAmount} type="number" step={selectedTournament.bidIncrement} placeholder={`Eg. ${defaultNextAmount}`} className="focus-ring h-12 rounded-md border border-court-ink/15 bg-white px-3" />
                <button disabled={!openCurrentLot} className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-court-ink px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Gavel size={17} /> Add Bid</button>
              </div>
              <p className="mt-3 text-sm text-court-ink/55">Minimum valid custom bid is {formatPoints(defaultNextAmount)} pts.</p>
            </form>

            <div className="mt-6 rounded-lg bg-[#f6fbf7] p-4">
              <h2 className="text-lg font-semibold">Bid History</h2>
              <div className="mt-3 grid gap-2">
                {currentLot.bids.length ? currentLot.bids.slice().reverse().map((bid) => (
                  <div key={bid.id} className="flex items-center justify-between rounded-md bg-white px-4 py-3 text-sm">
                    <span className="font-semibold">{bid.team.name}</span>
                    <span>{formatPoints(bid.amount)} pts</span>
                  </div>
                )) : <p className="rounded-md bg-white px-4 py-3 text-sm text-court-ink/55">No bids yet.</p>}
              </div>
            </div>

            <div className="mt-6 rounded-lg bg-[#f6fbf7] p-4">
              <h2 className="text-lg font-semibold">Sold Players in {category}</h2>
              <div className="mt-3 grid gap-2">
                {categoryLots.filter((lot) => lot.status === "SOLD").length ? categoryLots.filter((lot) => lot.status === "SOLD").map((lot) => (
                  <div key={lot.id} className="flex flex-col gap-3 rounded-md bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-semibold">{lot.player.name} · {formatPoints(lot.soldAmount ?? 0)} pts</span>
                    <button onClick={() => unsellPlayer(lot)} className="inline-flex items-center justify-center gap-2 rounded-md border border-court-ink/15 px-3 py-2 text-sm font-bold">
                      <RotateCcw size={15} /> Re-auction
                    </button>
                  </div>
                )) : <p className="rounded-md bg-white px-4 py-3 text-sm text-court-ink/55">No sold players in this category yet.</p>}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
