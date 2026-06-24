"use client";

import { useEffect, useState } from "react";
import { TRANSITION_DEBUG_EVENT, TRANSITION_DEBUG_KEY, type TransitionDebugEntry } from "@/lib/transition-debug";

export function TransitionDebugPanel({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<TransitionDebugEntry[]>([]);

  useEffect(() => {
    function readEntries() {
      try {
        setEntries(JSON.parse(window.localStorage.getItem(TRANSITION_DEBUG_KEY) ?? "[]"));
      } catch {
        setEntries([]);
      }
    }

    readEntries();
    const listener = () => readEntries();
    window.addEventListener(TRANSITION_DEBUG_EVENT, listener);
    window.addEventListener("storage", listener);

    return () => {
      window.removeEventListener(TRANSITION_DEBUG_EVENT, listener);
      window.removeEventListener("storage", listener);
    };
  }, []);

  return (
    <aside className="fixed bottom-3 right-3 z-50 max-w-[calc(100vw-1.5rem)] text-court-ink">
      <button
        onClick={() => setOpen((current) => !current)}
        className="rounded-md bg-court-lime px-3 py-2 text-xs font-black shadow-lg"
      >
        Debug {label} · {entries.length}
      </button>
      {open ? (
        <div className="mt-2 max-h-[42vh] w-[min(760px,calc(100vw-1.5rem))] overflow-auto rounded-lg border border-white/20 bg-white/95 p-3 text-xs shadow-2xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-black">Transition Debug Log</p>
            <button
              onClick={() => {
                window.localStorage.removeItem(TRANSITION_DEBUG_KEY);
                setEntries([]);
              }}
              className="rounded border border-court-ink/15 px-2 py-1 font-bold"
            >
              Clear
            </button>
          </div>
          <div className="grid gap-2">
            {entries.slice(0, 30).map((entry, index) => (
              <div key={`${entry.id}-${index}`} className="rounded-md bg-court-mint/60 p-2">
                <div className="flex flex-wrap items-center gap-2 font-bold">
                  <span>{entry.at}</span>
                  <span>{entry.source}</span>
                  <span>{entry.mode ?? entry.action ?? "-"}</span>
                  <span className="text-court-green">{entry.id}</span>
                </div>
                <p className="mt-1 text-court-ink/70">
                  {[entry.tournament, entry.category, entry.player, entry.amount ? `${entry.amount} pts` : null, entry.note]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
