"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, UserRound } from "lucide-react";
import { categoryOrder } from "@/lib/demo-data";
import type { PlayerCategory } from "@/lib/types";

type ScreenSharePlayer = {
  id: string;
  listName: string;
  dbName: string | null;
  category: PlayerCategory;
  categoryLabel: string;
  indexInCategory: number;
  totalInCategory: number;
  isOwner: boolean;
  photoUrl: string | null;
  experience: string | null;
  city: string | null;
  dominantHand: string | null;
};

type CategoryMeta = {
  category: PlayerCategory;
  label: string;
  count: number;
  startIndex: number;
};

type Phase = "select" | "live" | "done";

function shufflePlayers<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export function PlayerScreenShare() {
  const [players, setPlayers] = useState<ScreenSharePlayer[]>([]);
  const [categories, setCategories] = useState<CategoryMeta[]>([]);
  const [phase, setPhase] = useState<Phase>("select");
  const [selectedCategory, setSelectedCategory] = useState<PlayerCategory>("F1");
  const [activeCategory, setActiveCategory] = useState<PlayerCategory | null>(null);
  const [queue, setQueue] = useState<ScreenSharePlayer[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPlayers() {
      try {
        const response = await fetch("/api/public/screen-share");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Could not load players.");
        }
        if (cancelled) return;
        setPlayers(data.players ?? []);
        setCategories(data.categories ?? []);
        const firstCategory =
          categoryOrder.find((category) => (data.categories ?? []).some((item: CategoryMeta) => item.category === category)) ??
          data.categories?.[0]?.category ??
          "F1";
        setSelectedCategory(firstCategory);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load players.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPlayers();
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const counts = new Map(categories.map((item) => [item.category, item]));
    return categoryOrder
      .filter((category) => counts.has(category))
      .map((category) => ({
        category,
        label: counts.get(category)?.label ?? category,
        count: counts.get(category)?.count ?? 0
      }));
  }, [categories]);

  const startCategory = useCallback(
    (category: PlayerCategory) => {
      const categoryPlayers = players.filter((player) => player.category === category);
      if (!categoryPlayers.length) return;
      setActiveCategory(category);
      setSelectedCategory(category);
      setQueue(shufflePlayers(categoryPlayers));
      setQueueIndex(0);
      setPhase("live");
    },
    [players]
  );

  const goNext = useCallback(() => {
    if (phase !== "live" || !queue.length) return;
    if (queueIndex < queue.length - 1) {
      setQueueIndex((current) => current + 1);
      return;
    }
    setPhase("done");
  }, [phase, queue.length, queueIndex]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (phase !== "live") return;
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        goNext();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, phase]);

  const current = phase === "live" ? queue[queueIndex] ?? null : null;
  const activeCategoryMeta = categoryOptions.find((item) => item.category === activeCategory) ?? null;

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-court-ink text-white">
        <p className="text-lg font-semibold">Loading player list…</p>
      </div>
    );
  }

  if (error || !players.length) {
    return (
      <div className="grid min-h-screen place-items-center bg-court-ink px-6 text-center text-white">
        <p className="text-lg font-semibold">{error || "No players found in the list."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-court-ink text-white">
      <div className="court-grid absolute inset-0 opacity-20" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-8">
        <header className="border-b border-white/10 pb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-court-lime">Lush Pickleball League 4</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Player Screen Share</h1>
          <p className="mt-1 text-sm text-white/60">Pick a category · players appear in random order</p>
        </header>

        {phase === "select" ? (
          <main className="my-10 flex flex-1 flex-col items-center justify-center">
            <section className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
              <h2 className="text-2xl font-bold">Select category to start</h2>
              <p className="mt-2 text-sm text-white/60">Players will be shown one by one in random order.</p>
              <label className="mt-8 block text-left text-sm font-semibold text-white/70">
                Category
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value as PlayerCategory)}
                  className="focus-ring mt-2 h-14 w-full rounded-xl border border-white/15 bg-court-ink px-4 text-base font-bold text-white"
                >
                  {categoryOptions.map((item) => (
                    <option key={item.category} value={item.category}>
                      {item.category} · {item.label} ({item.count} players)
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => startCategory(selectedCategory)}
                className="mt-6 inline-flex h-14 w-full items-center justify-center rounded-xl bg-court-lime text-base font-black text-court-ink"
              >
                Start {selectedCategory}
              </button>
            </section>
          </main>
        ) : null}

        {phase === "done" ? (
          <main className="my-10 flex flex-1 flex-col items-center justify-center">
            <section className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court-lime">Category completed</p>
              <h2 className="mt-3 text-3xl font-black">
                {activeCategory} finished
              </h2>
              <p className="mt-2 text-white/65">
                All {queue.length} players in {activeCategoryMeta?.label ?? activeCategory} have been shown.
              </p>
              <label className="mt-8 block text-left text-sm font-semibold text-white/70">
                Choose next category
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value as PlayerCategory)}
                  className="focus-ring mt-2 h-14 w-full rounded-xl border border-white/15 bg-court-ink px-4 text-base font-bold text-white"
                >
                  {categoryOptions.map((item) => (
                    <option key={item.category} value={item.category}>
                      {item.category} · {item.label} ({item.count} players)
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => startCategory(selectedCategory)}
                className="mt-6 inline-flex h-14 w-full items-center justify-center rounded-xl bg-court-lime text-base font-black text-court-ink"
              >
                Start {selectedCategory}
              </button>
            </section>
          </main>
        ) : null}

        {phase === "live" && current ? (
          <>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-white/70">
                <span className="font-semibold text-white">{activeCategory}</span>
                <span className="mx-2 text-white/30">·</span>
                Player {queueIndex + 1} of {queue.length}
                <span className="mx-2 text-white/30">·</span>
                random order
              </p>
            </div>

            <main className="my-8 flex flex-1 flex-col items-center justify-center">
              <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur">
                <div className="relative aspect-[4/3] w-full bg-court-mint/20 sm:aspect-[16/10]">
                  {current.photoUrl ? (
                    <Image
                      src={current.photoUrl}
                      alt={current.listName}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 960px"
                      priority
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-court-ink/50">
                      <span className="grid h-28 w-28 place-items-center rounded-full bg-white/70">
                        <UserRound size={56} strokeWidth={1.5} />
                      </span>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em]">No photo</p>
                    </div>
                  )}
                  <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                    <span className="rounded-md bg-court-lime px-4 py-2 text-sm font-black text-court-ink">
                      {current.category} · {current.categoryLabel}
                    </span>
                    {current.isOwner ? (
                      <span className="rounded-md bg-white/90 px-4 py-2 text-sm font-black text-court-ink">Owner player</span>
                    ) : null}
                  </div>
                </div>

                <div className="px-6 py-8 text-center sm:px-10 sm:py-10">
                  <h2 className="text-4xl font-black tracking-tight text-white sm:text-6xl">{current.listName}</h2>
                  {current.dbName && current.dbName.toLowerCase() !== current.listName.toLowerCase() ? (
                    <p className="mt-2 text-sm text-white/50">Registered as {current.dbName}</p>
                  ) : null}
                  {(current.experience || current.city || current.dominantHand) && (
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-base font-semibold text-white/80">
                      {current.experience ? <span className="rounded-md bg-white/10 px-4 py-2">{current.experience}</span> : null}
                      {current.city ? <span className="rounded-md bg-white/10 px-4 py-2">{current.city}</span> : null}
                      {current.dominantHand ? (
                        <span className="rounded-md bg-white/10 px-4 py-2">{current.dominantHand} hand</span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </main>

            <footer className="mt-auto border-t border-white/10 pt-5">
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex h-14 min-w-[220px] items-center justify-center gap-2 rounded-xl bg-court-lime px-10 text-base font-black text-court-ink"
                >
                  {queueIndex < queue.length - 1 ? (
                    <>
                      Next player <ChevronRight size={22} />
                    </>
                  ) : (
                    "Finish category"
                  )}
                </button>
                <p className="text-center text-sm text-white/55">
                  Press <kbd className="rounded bg-white/10 px-2 py-1">space</kbd> or{" "}
                  <kbd className="rounded bg-white/10 px-2 py-1">→</kbd> for next
                </p>
              </div>
            </footer>
          </>
        ) : null}
      </div>
    </div>
  );
}
