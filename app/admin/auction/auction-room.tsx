"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronRight, Download, Gavel, RotateCcw, Trophy } from "lucide-react";
import { PlayerCard } from "@/components/player-card";
import { AUCTION_LIVE_STATE_KEY } from "@/lib/auction-live-state";
import { categoryOrder, demoTournament, formatPoints } from "@/lib/demo-data";
import type { AuctionLot, Bid, PlayerCategory, Team } from "@/lib/types";

export function AuctionRoom() {
  const [category, setCategory] = useState<PlayerCategory>("M1");
  const [lotIndex, setLotIndex] = useState(0);
  const [lots, setLots] = useState<AuctionLot[]>(demoTournament.lots);
  const [customTeamId, setCustomTeamId] = useState(demoTournament.teams[0]?.id ?? "");
  const [customAmount, setCustomAmount] = useState("");
  const [customBidError, setCustomBidError] = useState("");

  const categoryLots = useMemo(
    () => lots.filter((lot) => lot.category === category),
    [category, lots]
  );
  const currentLot = categoryLots[lotIndex] ?? categoryLots[0] ?? lots[0];
  const currentPlayer = demoTournament.players.find((player) => player.id === currentLot.playerId) ?? demoTournament.players[0];
  const latestBid = currentLot?.bids.at(-1);
  const leadingTeam = latestBid ? demoTournament.teams.find((team) => team.id === latestBid.teamId) : undefined;
  const defaultNextAmount = Math.max(currentLot.basePrice, (latestBid?.amount ?? currentLot.basePrice - demoTournament.bidIncrement) + demoTournament.bidIncrement);

  useEffect(() => {
    window.localStorage.setItem(
      AUCTION_LIVE_STATE_KEY,
      JSON.stringify({
        category,
        lotIndex,
        lots,
        updatedAt: new Date().toISOString()
      })
    );
  }, [category, lotIndex, lots]);

  function addBid(team: Team, amount?: number) {
    const nextAmount = amount ?? defaultNextAmount;
    const bid: Bid = { teamId: team.id, amount: nextAmount, createdAt: new Date().toISOString() };
    setLots((previous) =>
      previous.map((lot) =>
        lot.playerId === currentPlayer.id
          ? { ...lot, status: "live", bids: [...lot.bids, bid] }
          : lot
      )
    );
  }

  function addCustomBid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const team = demoTournament.teams.find((item) => item.id === customTeamId);
    const amount = Number(customAmount);

    if (!team || !Number.isFinite(amount) || amount <= 0) {
      setCustomBidError("Enter a valid bid amount.");
      return;
    }

    if (amount < defaultNextAmount) {
      setCustomBidError(`Bid must be at least ${formatPoints(defaultNextAmount)} pts.`);
      return;
    }

    addBid(team, amount);
    setCustomAmount("");
    setCustomBidError("");
  }

  function markSold() {
    if (!latestBid) return;
    setLots((previous) =>
      previous.map((lot) =>
        lot.playerId === currentPlayer.id
          ? { ...lot, status: "sold", soldToTeamId: latestBid.teamId, soldAmount: latestBid.amount }
          : lot
      )
    );
  }

  function markUnsold() {
    setLots((previous) =>
      previous.map((lot) =>
        lot.playerId === currentPlayer.id ? { ...lot, status: "unsold" } : lot
      )
    );
  }

  function nextPlayer() {
    setLotIndex((index) => (index + 1 >= categoryLots.length ? 0 : index + 1));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court-green">Live control room</p>
          <h1 className="mt-2 text-3xl font-bold">Auctioneer Panel</h1>
          <p className="mt-2 text-court-ink/60">Owner bids happen on Meet. The auctioneer records the latest team and amount here.</p>
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

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {categoryOrder.map((item) => (
          <button
            key={item}
            onClick={() => {
              setCategory(item);
              setLotIndex(0);
            }}
            className={`h-11 rounded-md px-5 text-sm font-bold transition ${category === item ? "bg-court-green text-white shadow-glow" : "bg-white text-court-ink"}`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <PlayerCard player={currentPlayer} category={currentLot.category} basePrice={currentLot.basePrice} />

        <section className="rounded-lg border border-court-ink/10 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-court-ink/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-court-ink/55">Current Bid</p>
              <p className="mt-1 text-5xl font-bold text-court-ink">{formatPoints(latestBid?.amount ?? currentLot.basePrice)} pts</p>
              {leadingTeam ? (
                <div className="mt-3 inline-flex items-center gap-3 rounded-md bg-court-mint px-4 py-3">
                  <span className="h-4 w-4 rounded-full" style={{ backgroundColor: leadingTeam.color }} />
                  <span className="text-2xl font-black text-court-ink">{leadingTeam.name}</span>
                </div>
              ) : (
                <p className="mt-3 text-lg font-semibold text-court-ink/60">Waiting for first bid</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={markSold} disabled={!latestBid} className="rounded-md bg-court-green px-5 py-3 text-sm font-bold text-white disabled:opacity-40">
                Sold
              </button>
              <button onClick={markUnsold} className="rounded-md bg-court-clay px-5 py-3 text-sm font-bold text-white">
                Unsold
              </button>
              <button onClick={nextPlayer} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-md border border-court-ink/15 px-5 py-3 text-sm font-bold">
                Next Player <ChevronRight size={17} />
              </button>
            </div>
          </div>

          <div className="mt-5">
            <h2 className="text-lg font-semibold">Quick Bid</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {demoTournament.teams.map((team) => {
                return (
                  <button
                    key={team.id}
                    onClick={() => addBid(team, defaultNextAmount)}
                    className="rounded-lg border border-court-ink/10 p-4 text-left transition hover:border-court-green hover:bg-court-mint/30"
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: team.color }} />
                      {team.name}
                    </span>
                    <span className="mt-2 block text-sm text-court-ink/55">
                      Bid {formatPoints(defaultNextAmount)} · {formatPoints(team.budget - team.spent)} left
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={addCustomBid} className="mt-5 rounded-lg border border-court-ink/10 bg-[#f6fbf7] p-4">
            <h2 className="text-lg font-semibold">Custom Bid</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="grid gap-2 text-sm font-semibold">
                Team
                <select
                  value={customTeamId}
                  onChange={(event) => setCustomTeamId(event.target.value)}
                  className="focus-ring h-12 rounded-md border border-court-ink/15 bg-white px-3 font-normal"
                >
                  {demoTournament.teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Bid Amount
                <input
                  value={customAmount}
                  onChange={(event) => setCustomAmount(event.target.value)}
                  min={defaultNextAmount}
                  type="number"
                  step={demoTournament.bidIncrement}
                  inputMode="numeric"
                  placeholder={`Eg. ${defaultNextAmount}`}
                  className="focus-ring h-12 rounded-md border border-court-ink/15 bg-white px-3 font-normal"
                />
              </label>
              <button className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-md bg-court-ink px-5 text-sm font-bold text-white">
                <Gavel size={17} /> Add Bid
              </button>
            </div>
            {customBidError ? (
              <p className="mt-3 rounded-md bg-court-clay/10 px-3 py-2 text-sm font-semibold text-court-clay">
                {customBidError}
              </p>
            ) : (
              <p className="mt-3 text-sm text-court-ink/55">
                Minimum valid custom bid is {formatPoints(defaultNextAmount)} pts.
              </p>
            )}
          </form>

          <div className="mt-6 rounded-lg bg-[#f6fbf7] p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Bid History</h2>
              <button
                onClick={() => {
                  setLots(demoTournament.lots);
                  setCategory("M1");
                  setLotIndex(0);
                }}
                className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-court-ink/65 hover:bg-white"
              >
                <RotateCcw size={15} /> Reset Demo
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              {currentLot?.bids.length ? currentLot.bids.slice().reverse().map((bid, index) => {
                const team = demoTournament.teams.find((item) => item.id === bid.teamId);
                return (
                  <div key={`${bid.teamId}-${bid.amount}-${index}`} className="flex items-center justify-between rounded-md bg-white px-4 py-3 text-sm">
                    <span className="font-semibold">{team?.name}</span>
                    <span>{formatPoints(bid.amount)} pts</span>
                  </div>
                );
              }) : (
                <p className="rounded-md bg-white px-4 py-3 text-sm text-court-ink/55">No bids yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
