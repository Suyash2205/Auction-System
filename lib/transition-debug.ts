export type TransitionDebugEntry = {
  id: string;
  at: string;
  source: string;
  mode?: string;
  action?: string;
  tournament?: string;
  category?: string | null;
  lotId?: string | null;
  player?: string | null;
  amount?: number | null;
  note?: string;
};

export const TRANSITION_DEBUG_KEY = "lush-pickleball-transition-debug";
export const TRANSITION_DEBUG_EVENT = "lush-pickleball-transition-debug-update";

export function makeTransitionId(action: string, lotId?: string | null) {
  return `${action}-${lotId ?? "none"}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function appendTransitionDebug(entry: Omit<TransitionDebugEntry, "at">) {
  if (typeof window === "undefined") return;

  const nextEntry = { ...entry, at: new Date().toLocaleTimeString("en-IN", { hour12: false }) };
  try {
    const current = JSON.parse(window.localStorage.getItem(TRANSITION_DEBUG_KEY) ?? "[]") as TransitionDebugEntry[];
    const next = [nextEntry, ...current].slice(0, 80);
    window.localStorage.setItem(TRANSITION_DEBUG_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(TRANSITION_DEBUG_EVENT, { detail: nextEntry }));
  } catch {
    // Debug logging must never affect the live auction flow.
  }
}
