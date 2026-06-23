"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Gavel, ShieldCheck } from "lucide-react";
import { categoryConfig, formatPoints } from "@/lib/demo-data";
import { getMaxAllowedBid } from "@/lib/auction-rules";
import { supabase } from "@/lib/supabase";
import type { PlayerCategory } from "@/lib/types";

type Team = {
  id: string;
  name: string;
  color: string | null;
  budget: number;
  spent: number;
};

type Lot = {
  id: string;
  category: PlayerCategory;
  basePrice: number;
  status: string;
  soldToTeamId: string | null;
  player: {
    name: string;
    photoUrl: string | null;
    experience: string;
    city: string | null;
    dominantHand: string | null;
  };
  bids: Array<{ id: string; amount: number; team: Team }>;
};

type Tournament = {
  name: string;
  teams: Team[];
  lots: Array<{
    id: string;
    category: PlayerCategory;
    status: string;
    soldToTeamId: string | null;
    soldAmount: number | null;
    player: { name: string };
  }>;
};

type SaleEvent = {
  id: string;
  playerName: string;
  playerPhotoUrl: string | null;
  category: PlayerCategory;
  teamName: string;
  teamColor: string | null;
  amount: number;
  kind: "sold" | "owner";
};

const INSTANT_DISPLAY_KEY = "lush-pickleball-instant-display";
const INSTANT_DISPLAY_CHANNEL = "lush-pickleball-display";
const SUPABASE_BROADCAST_CHANNEL = "auction-display-broadcast";
const SUPABASE_BROADCAST_EVENT = "state";
const MAX_INSTANT_STATE_AGE_MS = 10_000;
const INSTANT_SERVER_GRACE_MS = 2_500;

export function LiveDisplay() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [lot, setLot] = useState<Lot | null>(null);
  const [completedCategory, setCompletedCategory] = useState<PlayerCategory | null>(null);
  const [saleQueue, setSaleQueue] = useState<SaleEvent[]>([]);
  const [activeSale, setActiveSale] = useState<SaleEvent | null>(null);
  const [auctionEnded, setAuctionEnded] = useState(false);
  const isLoadingRef = useRef(false);
  const lastInstantStateAtRef = useRef(0);
  const seenSaleIdsRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (isLoadingRef.current) return;
    const requestedAt = Date.now();
    isLoadingRef.current = true;

    try {
      const response = await fetch("/api/public/display", { cache: "no-store" });
      const data = await response.json();
      if (requestedAt < lastInstantStateAtRef.current || Date.now() - lastInstantStateAtRef.current < INSTANT_SERVER_GRACE_MS) {
        return;
      }
      setTournament(data.tournament);
      setLot(data.liveLot);
      setCompletedCategory(data.liveLot ? null : data.completedCategory ?? null);
      setAuctionEnded(Boolean(data.auctionEnded));
    } finally {
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    load();

    const interval = window.setInterval(load, 500);
    const applyInstantState = (value: unknown) => {
      const data = value as { sentAt?: number; tournament?: Tournament | null; liveLot?: Lot | null; completedCategory?: PlayerCategory | null; saleEvents?: SaleEvent[]; auctionEnded?: boolean };

      if (!data?.sentAt || Date.now() - data.sentAt > MAX_INSTANT_STATE_AGE_MS) return;

      lastInstantStateAtRef.current = Date.now();
      setTournament(data.tournament ?? null);
      setLot(data.liveLot ?? null);
      setCompletedCategory(data.liveLot ? null : data.completedCategory ?? null);
      setAuctionEnded(Boolean(data.auctionEnded));
      if (data.saleEvents?.length) {
        const freshSaleEvents = data.saleEvents.filter((saleEvent) => {
          if (seenSaleIdsRef.current.has(saleEvent.id)) return false;
          seenSaleIdsRef.current.add(saleEvent.id);
          return true;
        });
        if (freshSaleEvents.length) {
          setSaleQueue((current) => [...current, ...freshSaleEvents]);
        }
      }
    };

    try {
      const cached = window.localStorage.getItem(INSTANT_DISPLAY_KEY);
      if (cached) applyInstantState(JSON.parse(cached));
    } catch {
      // Ignore malformed stale instant display state.
    }

    const instantChannel = new BroadcastChannel(INSTANT_DISPLAY_CHANNEL);
    instantChannel.onmessage = (event) => applyInstantState(event.data);

    const storageListener = (event: StorageEvent) => {
      if (event.key !== INSTANT_DISPLAY_KEY || !event.newValue) return;
      try {
        applyInstantState(JSON.parse(event.newValue));
      } catch {
        // Ignore malformed storage payloads.
      }
    };

    window.addEventListener("storage", storageListener);
    const supabaseBroadcastChannel = supabase
      ?.channel(SUPABASE_BROADCAST_CHANNEL, {
        config: { broadcast: { self: false } }
      })
      .on("broadcast", { event: SUPABASE_BROADCAST_EVENT }, ({ payload }) => applyInstantState(payload))
      .subscribe();
    const supabaseChannel = supabase
      ?.channel("live-auction-display")
      .on("postgres_changes", { event: "*", schema: "public", table: "AuctionLot" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "Bid" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "Team" }, load)
      .subscribe();

    return () => {
      window.clearInterval(interval);
      instantChannel.close();
      window.removeEventListener("storage", storageListener);
      if (supabaseBroadcastChannel) {
        supabase?.removeChannel(supabaseBroadcastChannel);
      }
      if (supabaseChannel) {
        supabase?.removeChannel(supabaseChannel);
      }
    };
  }, [load]);

  useEffect(() => {
    if (activeSale || !saleQueue.length) return;

    const [nextSale, ...remainingSales] = saleQueue;
    setActiveSale(nextSale);
    setSaleQueue(remainingSales);
  }, [activeSale, saleQueue]);

  useEffect(() => {
    if (!activeSale) return;

    const timeout = window.setTimeout(() => setActiveSale(null), 2000);

    return () => window.clearTimeout(timeout);
  }, [activeSale]);

  const bid = lot?.bids.at(-1);
  const team = bid?.team;

  if (!tournament) {
    return (
      <main className="grid min-h-screen place-items-center bg-court-ink text-white">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-court-lime">Live Auction Display</p>
          <h1 className="mt-4 text-5xl font-black">Waiting for tournament</h1>
        </div>
      </main>
    );
  }

  if (activeSale) {
    return (
      <main className="min-h-screen bg-court-ink text-white">
        <section className="court-grid grid min-h-screen grid-cols-1 items-center gap-8 px-8 py-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-lg border border-white/15 bg-white/10 shadow-glow">
            {activeSale.playerPhotoUrl ? (
              <Image src={activeSale.playerPhotoUrl} alt={activeSale.playerName} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 35vw" priority />
            ) : null}
            <div className="absolute left-5 top-5 rounded-md bg-court-lime px-4 py-2 text-sm font-black text-court-ink">
              {activeSale.category} · {categoryConfig[activeSale.category].label}
            </div>
          </div>
          <div className="animate-pulse">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-court-lime">
              {activeSale.kind === "owner" ? "Owner Player Sold" : "Sold"}
            </p>
            <h1 className="mt-4 text-6xl font-black leading-none sm:text-7xl lg:text-8xl">{activeSale.playerName}</h1>
            <div className="mt-8 rounded-lg border border-white/15 bg-white/10 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/55">Sold To</p>
              <div className="mt-4 flex items-center gap-4">
                <span className="h-6 w-6 rounded-full" style={{ backgroundColor: activeSale.teamColor ?? "#1f8f64" }} />
                <p className="text-5xl font-black">{activeSale.teamName}</p>
              </div>
              <p className="mt-6 text-7xl font-black text-court-lime">{formatPoints(activeSale.amount)}</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (auctionEnded) {
    return (
      <main className="min-h-screen bg-court-ink text-white">
        <section className="court-grid min-h-screen px-6 py-8">
          <header className="mx-auto w-full max-w-7xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-court-lime">Auction Completed</p>
            <h1 className="mt-3 text-5xl font-black">{tournament.name}</h1>
          </header>
          <div className="mx-auto mt-8 grid w-full max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-4">
            {tournament.teams.map((team) => {
              const players = tournament.lots.filter((item) => item.soldToTeamId === team.id);

              return (
                <article key={team.id} className="rounded-lg border border-white/15 bg-white/10 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="h-4 w-4 rounded-full" style={{ backgroundColor: team.color ?? "#1f8f64" }} />
                      <h2 className="text-2xl font-black">{team.name}</h2>
                    </div>
                    <span className="text-sm text-white/60">{formatPoints(team.budget - team.spent)} left</span>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {players.map((item) => (
                      <div key={item.id} className="rounded-md bg-white/10 px-3 py-2">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-semibold">{item.player.name}</span>
                          <span className="text-court-lime">{formatPoints(item.soldAmount ?? 0)}</span>
                        </div>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-white/50">{item.category}</p>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    );
  }

  if (!lot) {
    return (
      <main className="grid min-h-screen place-items-center bg-court-ink text-white">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-court-lime">Live Auction Display</p>
          <h1 className="mt-4 text-6xl font-black">
            {completedCategory ? `${completedCategory} Category Completed` : "Waiting for category"}
          </h1>
          <p className="mt-4 text-2xl text-white/65">Auctioneer selecting next category</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-court-ink text-white">
      <section className="court-grid grid min-h-screen grid-rows-[auto_1fr_auto]">
        <header className="flex items-center justify-between gap-4 border-b border-white/15 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-court-lime text-court-ink">
              <Gavel size={22} />
            </span>
            <div>
              <p className="text-lg font-bold">{tournament.name}</p>
              <p className="text-sm text-white/60">Live Auction Display</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-semibold sm:flex">
            <ShieldCheck size={17} /> Owner View
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-7xl items-center gap-8 px-6 py-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-white/15 bg-white/10 shadow-glow">
            {lot.player.photoUrl ? (
              <Image src={lot.player.photoUrl} alt={lot.player.name} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 45vw" priority />
            ) : null}
            <div className="absolute left-5 top-5 rounded-md bg-court-lime px-4 py-2 text-sm font-black text-court-ink">
              {lot.category} · {categoryConfig[lot.category].label}
            </div>
          </div>

          <section>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-court-lime">Now Auctioning</p>
            <h1 className="mt-4 text-6xl font-black leading-none sm:text-7xl lg:text-8xl">{lot.player.name}</h1>
            <div className="mt-6 grid gap-3 text-xl text-white/75 sm:grid-cols-3">
              <p className="rounded-md bg-white/10 px-4 py-3">{lot.player.experience}</p>
              <p className="rounded-md bg-white/10 px-4 py-3">{lot.player.city || "-"}</p>
              <p className="rounded-md bg-white/10 px-4 py-3">{lot.player.dominantHand || "-"} hand</p>
            </div>

            <div className="mt-8 rounded-lg border border-white/15 bg-white/10 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/55">Current Highest Bid</p>
              <p className="mt-3 text-7xl font-black text-court-lime">{formatPoints(bid?.amount ?? lot.basePrice)}</p>
              <div className="mt-4 flex items-center gap-4">
                {team ? <span className="h-5 w-5 rounded-full" style={{ backgroundColor: team.color ?? "#1f8f64" }} /> : null}
                <p className="text-4xl font-black">{team ? team.name : "Opening Bid"}</p>
              </div>
            </div>
          </section>
        </div>

        <footer className="grid gap-3 border-t border-white/15 px-6 py-4 md:grid-cols-4">
          {tournament.teams.map((item) => (
            <div key={item.id} className="rounded-md bg-white/10 px-4 py-3">
              <div className="flex items-center gap-2 font-semibold">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color ?? "#1f8f64" }} />
                <span>{item.name}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <span className="text-white/60">Total {formatPoints(item.budget - item.spent)}</span>
                <span className="font-semibold text-court-lime">Usable {formatPoints(getMaxAllowedBid(item, tournament.lots, lot.category))}</span>
              </div>
            </div>
          ))}
        </footer>
      </section>
    </main>
  );
}
