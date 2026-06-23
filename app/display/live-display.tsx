"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Gavel, ShieldCheck } from "lucide-react";
import { categoryConfig, formatPoints } from "@/lib/demo-data";
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
};

export function LiveDisplay() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [lot, setLot] = useState<Lot | null>(null);
  const isLoadingRef = useRef(false);

  const load = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      const response = await fetch("/api/public/display", { cache: "no-store" });
      const data = await response.json();
      setTournament(data.tournament);
      setLot(data.liveLot);
    } finally {
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    load();

    const interval = window.setInterval(load, 500);
    const channel = supabase
      ?.channel("live-auction-display")
      .on("postgres_changes", { event: "*", schema: "public", table: "AuctionLot" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "Bid" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "Team" }, load)
      .subscribe();

    return () => {
      window.clearInterval(interval);
      if (channel) {
        supabase?.removeChannel(channel);
      }
    };
  }, [load]);

  const bid = lot?.bids.at(-1);
  const team = bid?.team;

  if (!tournament || !lot) {
    return (
      <main className="grid min-h-screen place-items-center bg-court-ink text-white">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-court-lime">Live Auction Display</p>
          <h1 className="mt-4 text-5xl font-black">Waiting for tournament</h1>
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
            <div key={item.id} className="flex items-center justify-between rounded-md bg-white/10 px-4 py-3">
              <span className="flex items-center gap-2 font-semibold">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color ?? "#1f8f64" }} />
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
