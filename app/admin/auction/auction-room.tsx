"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Download, Gavel, RotateCcw, SkipForward, Trophy } from "lucide-react";
import { categoryConfig, categoryOrder, formatPoints } from "@/lib/demo-data";
import { supabase } from "@/lib/supabase";
import type { PlayerCategory } from "@/lib/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
  orderIndex: number;
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

const INSTANT_DISPLAY_KEY = "lush-pickleball-instant-display";
const INSTANT_DISPLAY_CHANNEL = "lush-pickleball-display";
const SUPABASE_BROADCAST_CHANNEL = "auction-display-broadcast";
const SUPABASE_BROADCAST_EVENT = "state";

function getNextOpenLot(lots: Lot[], currentLotId: string) {
  const currentIndex = lots.findIndex((lot) => lot.id === currentLotId);

  return (
    lots.slice(currentIndex + 1).find((lot) => lot.status === "QUEUED") ??
    lots.find((lot) => lot.status === "QUEUED" && lot.id !== currentLotId) ??
    lots.find((lot) => lot.status === "SKIPPED" && lot.id !== currentLotId) ??
    null
  );
}

function publishInstantDisplay(tournament: Tournament, liveLot: Lot | null, realtimeChannel: RealtimeChannel | null) {
  const payload = {
    sentAt: Date.now(),
    tournament: {
      name: tournament.name,
      teams: tournament.teams
    },
    liveLot
  };

  try {
    window.localStorage.setItem(INSTANT_DISPLAY_KEY, JSON.stringify(payload));
    new BroadcastChannel(INSTANT_DISPLAY_CHANNEL).postMessage(payload);
  } catch {
    // Best-effort same-browser acceleration; server state remains authoritative.
  }

  void realtimeChannel?.send({
    type: "broadcast",
    event: SUPABASE_BROADCAST_EVENT,
    payload
  });
}

export function AuctionRoom() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [category, setCategory] = useState<PlayerCategory>("M1");
  const [customTeamId, setCustomTeamId] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [error, setError] = useState("");
  const realtimeBroadcastRef = useRef<RealtimeChannel | null>(null);
  const realtimeReadyRef = useRef(false);
  const pendingDisplayPayloadRef = useRef<Parameters<typeof publishInstantDisplay>[0] | null>(null);
  const pendingDisplayLotRef = useRef<Lot | null>(null);
  const latestActionRequestRef = useRef(0);

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

  useEffect(() => {
    if (!supabase) return;

    const realtimeClient = supabase;
    const channel = realtimeClient.channel(SUPABASE_BROADCAST_CHANNEL, {
      config: { broadcast: { self: false } }
    });
    realtimeBroadcastRef.current = channel;
    channel.subscribe((status) => {
      realtimeReadyRef.current = status === "SUBSCRIBED";
      if (status === "SUBSCRIBED" && pendingDisplayPayloadRef.current) {
        publishInstantDisplay(pendingDisplayPayloadRef.current, pendingDisplayLotRef.current, channel);
        pendingDisplayPayloadRef.current = null;
        pendingDisplayLotRef.current = null;
      }
    });

    return () => {
      realtimeReadyRef.current = false;
      realtimeBroadcastRef.current = null;
      void realtimeClient.removeChannel(channel);
    };
  }, []);

  function applyOptimisticAction(payload: Record<string, unknown>, targetLotId: string) {
    let optimisticLiveLot: Lot | null = null;
    let optimisticTournament: Tournament | null = null;
    const nextTournaments = tournaments.map((tournament) => {
      if (tournament.id !== selectedTournament?.id) return tournament;

      const actionType = String(payload.action ?? "");
      const targetLot = tournament.lots.find((lot) => lot.id === targetLotId);
      if (!targetLot) return tournament;

      const lots = tournament.lots.map((lot) => ({
        ...lot,
        bids: [...lot.bids]
      }));
      const targetIndex = lots.findIndex((lot) => lot.id === targetLotId);
      const categoryLots = lots.filter((lot) => lot.category === targetLot.category).sort((a, b) => a.orderIndex - b.orderIndex);
      const nextOpenLot = getNextOpenLot(categoryLots, targetLotId);
      const maxOrderIndex = Math.max(...categoryLots.map((lot) => lot.orderIndex), 0);

      if (actionType === "bid") {
        const team = tournament.teams.find((item) => item.id === payload.teamId);
        const amount = Number(payload.amount);
        if (team && Number.isFinite(amount)) {
          lots[targetIndex] = {
            ...lots[targetIndex],
            status: "LIVE",
            bids: [
              ...lots[targetIndex].bids,
              {
                id: `optimistic-${Date.now()}`,
                teamId: team.id,
                amount,
                createdAt: new Date().toISOString(),
                team
              }
            ]
          };
          optimisticLiveLot = lots[targetIndex];
        }
      }

      if (actionType === "sold") {
        const latest = lots[targetIndex].bids.at(-1);
        lots[targetIndex] = {
          ...lots[targetIndex],
          status: "SOLD",
          soldToTeamId: latest?.teamId ?? lots[targetIndex].soldToTeamId,
          soldAmount: latest?.amount ?? lots[targetIndex].soldAmount
        };
        if (nextOpenLot) {
          const nextIndex = lots.findIndex((lot) => lot.id === nextOpenLot.id);
          lots[nextIndex] = { ...lots[nextIndex], status: "LIVE" };
          optimisticLiveLot = lots[nextIndex];
        }
      }

      if (actionType === "skip" || actionType === "unsold") {
        lots[targetIndex] = {
          ...lots[targetIndex],
          status: "SKIPPED",
          orderIndex: maxOrderIndex + 1
        };
        if (nextOpenLot) {
          const nextIndex = lots.findIndex((lot) => lot.id === nextOpenLot.id);
          lots[nextIndex] = { ...lots[nextIndex], status: "LIVE" };
          optimisticLiveLot = lots[nextIndex];
        }
      }

      if (actionType === "unsell") {
        lots[targetIndex] = {
          ...lots[targetIndex],
          status: "LIVE",
          soldToTeamId: null,
          soldAmount: null,
          bids: []
        };
        optimisticLiveLot = lots[targetIndex];
      }

      optimisticTournament = { ...tournament, lots };
      return optimisticTournament;
    });

    setTournaments(nextTournaments);

    if (optimisticTournament) {
      publishInstantDisplay(optimisticTournament, optimisticLiveLot, realtimeReadyRef.current ? realtimeBroadcastRef.current : null);
      if (!realtimeReadyRef.current) {
        pendingDisplayPayloadRef.current = optimisticTournament;
        pendingDisplayLotRef.current = optimisticLiveLot;
      }
    }
  }

  async function action(payload: Record<string, unknown>, targetLotId = currentLot?.id) {
    if (!selectedTournament || !targetLotId) return;
    const requestId = latestActionRequestRef.current + 1;
    latestActionRequestRef.current = requestId;
    setError("");
    applyOptimisticAction(payload, targetLotId);
    const response = await fetch(`/api/admin/tournaments/${selectedTournament.id}/auction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lotId: targetLotId, currentCategory: category, ...payload })
    });
    const data = await response.json();
    if (requestId !== latestActionRequestRef.current) return;

    if (!response.ok) {
      setError(data.error ?? "Auction action failed.");
      await load();
      return;
    }
    if (data.tournament) {
      setTournaments((current) => current.map((tournament) => (tournament.id === data.tournament.id ? data.tournament : tournament)));
      setSelectedTournamentId(data.tournament.id);
      setCustomTeamId((current) => current || data.tournament.teams?.[0]?.id || "");
    }
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
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => action({ action: "sold" })} disabled={!latestBid || currentLot.status !== "LIVE"} className="rounded-md bg-court-green px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Sold</button>
                <button onClick={skipPlayer} disabled={currentLot.status !== "LIVE"} className="inline-flex items-center justify-center gap-2 rounded-md border border-court-ink/15 px-5 py-3 text-sm font-bold disabled:opacity-40">
                  <SkipForward size={17} /> Skip
                </button>
                <button onClick={() => action({ action: "unsold" })} disabled={currentLot.status !== "LIVE"} className="rounded-md bg-court-clay px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Unsold</button>
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
