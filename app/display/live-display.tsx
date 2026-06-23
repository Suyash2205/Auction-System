"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Gavel, ShieldCheck } from "lucide-react";
import { AUCTION_LIVE_STATE_KEY, type AuctionLiveState } from "@/lib/auction-live-state";
import { categoryConfig, demoTournament, formatPoints } from "@/lib/demo-data";

function readLiveState(): AuctionLiveState {
  if (typeof window === "undefined") {
    return {
      category: "M1",
      lotIndex: 0,
      lots: demoTournament.lots,
      updatedAt: new Date().toISOString()
    };
  }

  const raw = window.localStorage.getItem(AUCTION_LIVE_STATE_KEY);
  if (!raw) {
    return {
      category: "M1",
      lotIndex: 0,
      lots: demoTournament.lots,
      updatedAt: new Date().toISOString()
    };
  }

  try {
    return JSON.parse(raw) as AuctionLiveState;
  } catch {
    return {
      category: "M1",
      lotIndex: 0,
      lots: demoTournament.lots,
      updatedAt: new Date().toISOString()
    };
  }
}

export function LiveDisplay() {
  const [liveState, setLiveState] = useState<AuctionLiveState>({
    category: "M1",
    lotIndex: 0,
    lots: demoTournament.lots,
    updatedAt: new Date().toISOString()
  });

  useEffect(() => {
    setLiveState(readLiveState());

    function syncFromStorage(event?: StorageEvent) {
      if (event && event.key !== AUCTION_LIVE_STATE_KEY) return;
      setLiveState(readLiveState());
    }

    window.addEventListener("storage", syncFromStorage);
    const interval = window.setInterval(() => setLiveState(readLiveState()), 900);

    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.clearInterval(interval);
    };
  }, []);

  const categoryLots = useMemo(
    () => liveState.lots.filter((lot) => lot.category === liveState.category),
    [liveState]
  );
  const lot = categoryLots[liveState.lotIndex] ?? categoryLots[0] ?? liveState.lots[0] ?? demoTournament.lots[0];
  const player = demoTournament.players.find((item) => item.id === lot.playerId) ?? demoTournament.players[0];
  const bid = lot.bids.at(-1);
  const team = bid ? demoTournament.teams.find((item) => item.id === bid.teamId) : undefined;

  return (
    <main className="min-h-screen bg-court-ink text-white">
      <section className="court-grid grid min-h-screen grid-rows-[auto_1fr_auto]">
        <header className="flex items-center justify-between gap-4 border-b border-white/15 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-court-lime text-court-ink">
              <Gavel size={22} />
            </span>
            <div>
              <p className="text-lg font-bold">Lush Pickleball League 4.0</p>
              <p className="text-sm text-white/60">Live Auction Display</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-semibold sm:flex">
            <ShieldCheck size={17} /> Owner View
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-7xl items-center gap-8 px-6 py-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-white/15 bg-white/10 shadow-glow">
            <Image src={player.photoUrl} alt={player.name} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 45vw" priority />
            <div className="absolute left-5 top-5 rounded-md bg-court-lime px-4 py-2 text-sm font-black text-court-ink">
              {lot.category} · {categoryConfig[lot.category].label}
            </div>
          </div>

          <section>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-court-lime">Now Auctioning</p>
            <h1 className="mt-4 text-6xl font-black leading-none sm:text-7xl lg:text-8xl">{player.name}</h1>
            <div className="mt-6 grid gap-3 text-xl text-white/75 sm:grid-cols-3">
              <p className="rounded-md bg-white/10 px-4 py-3">{player.experience}</p>
              <p className="rounded-md bg-white/10 px-4 py-3">{player.city}</p>
              <p className="rounded-md bg-white/10 px-4 py-3">{player.dominantHand} hand</p>
            </div>

            <div className="mt-8 rounded-lg border border-white/15 bg-white/10 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/55">Current Highest Bid</p>
              <p className="mt-3 text-7xl font-black text-court-lime">{formatPoints(bid?.amount ?? lot.basePrice)}</p>
              <div className="mt-4 flex items-center gap-4">
                {team ? <span className="h-5 w-5 rounded-full" style={{ backgroundColor: team.color }} /> : null}
                <p className="text-4xl font-black">{team ? team.name : "Opening Bid"}</p>
              </div>
            </div>
          </section>
        </div>

        <footer className="grid gap-3 border-t border-white/15 px-6 py-4 md:grid-cols-4">
          {demoTournament.teams.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-md bg-white/10 px-4 py-3">
              <span className="flex items-center gap-2 font-semibold">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}
              </span>
              <span className="text-sm text-white/65">{formatPoints(item.budget - item.spent)} left</span>
            </div>
          ))}
        </footer>
      </section>
    </main>
  );
}
