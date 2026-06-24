"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Download, Gavel, RotateCcw, SkipForward, Trophy, CheckCircle2, Loader2 } from "lucide-react";
import { TransitionDebugPanel } from "@/components/transition-debug-panel";
import { categoryConfig, categoryOrder, formatPoints } from "@/lib/demo-data";
import { canTeamBidInCategory, getMaxAllowedBid, getRequiredReserve } from "@/lib/auction-rules";
import { supabase } from "@/lib/supabase";
import { appendTransitionDebug, makeTransitionId } from "@/lib/transition-debug";
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
  ownerTeamIds?: string[];
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

type DisplayMode = "WAITING" | "LIVE_PLAYER" | "SOLD_ANIMATION" | "OWNER_ANIMATION" | "CATEGORY_COMPLETED" | "AUCTION_ENDED";

const INSTANT_DISPLAY_KEY = "lush-pickleball-instant-display";
const INSTANT_DISPLAY_CHANNEL = "lush-pickleball-display";
const SUPABASE_BROADCAST_CHANNEL = "auction-display-broadcast";
const SUPABASE_BROADCAST_EVENT = "state";

async function readJson(response: Response) {
  return response.json().catch(() => ({}));
}

function getNextOpenLot(lots: Lot[], currentLotId: string) {
  const queuedLots = lots.filter((lot) => lot.status === "QUEUED" && lot.id !== currentLotId);
  const skippedLots = lots.filter((lot) => lot.status === "SKIPPED" && lot.id !== currentLotId);
  const nextPool = queuedLots.length ? queuedLots : skippedLots;

  return nextPool.length ? nextPool[Math.floor(Math.random() * nextPool.length)] : null;
}

function publishInstantDisplay(
  tournament: Tournament,
  liveLot: Lot | null,
  realtimeChannel: RealtimeChannel | null,
  completedCategory: PlayerCategory | null = null,
  saleEvents: SaleEvent[] = [],
  auctionEnded = false,
  transitionId = makeTransitionId("display", liveLot?.id ?? completedCategory)
) {
  const mode: DisplayMode = auctionEnded
    ? "AUCTION_ENDED"
    : saleEvents[0]?.kind === "owner"
      ? "OWNER_ANIMATION"
      : saleEvents.length
        ? "SOLD_ANIMATION"
        : liveLot
          ? "LIVE_PLAYER"
          : completedCategory
            ? "CATEGORY_COMPLETED"
            : "WAITING";
  const payload = {
    transitionId,
    mode,
    sentAt: Date.now(),
    tournament: {
      name: tournament.name,
      teams: tournament.teams,
      lots: tournament.lots.map((lot) => ({
        id: lot.id,
        category: lot.category,
        status: lot.status,
        soldToTeamId: lot.soldToTeamId,
        soldAmount: lot.soldAmount,
        player: { name: lot.player.name }
      }))
    },
    liveLot,
    completedCategory,
    saleEvents,
    auctionEnded
  };

  appendTransitionDebug({
    id: transitionId,
    source: "admin-publish",
    mode,
    tournament: tournament.name,
    category: liveLot?.category ?? completedCategory,
    lotId: liveLot?.id ?? null,
    player: liveLot?.player.name ?? saleEvents[0]?.playerName ?? null,
    amount: saleEvents[0]?.amount ?? liveLot?.bids.at(-1)?.amount ?? null,
    note: saleEvents.length ? `saleEvents=${saleEvents.map((event) => event.id).join(",")}` : undefined
  });

  try {
    if (mode === "LIVE_PLAYER" || mode === "AUCTION_ENDED") {
      window.localStorage.setItem(INSTANT_DISPLAY_KEY, JSON.stringify({ ...payload, saleEvents: [] }));
    } else if (mode === "WAITING") {
      window.localStorage.removeItem(INSTANT_DISPLAY_KEY);
    }
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
  const [category, setCategory] = useState<PlayerCategory | "">("");
  const [customTeamId, setCustomTeamId] = useState("");
  const [ownerTeamId, setOwnerTeamId] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [pendingSoldLotId, setPendingSoldLotId] = useState("");
  const [pendingOwnerLotId, setPendingOwnerLotId] = useState("");
  const [soldFeedback, setSoldFeedback] = useState<{
    phase: "selling" | "confirmed" | "failed";
    playerName: string;
    teamName?: string;
    amount?: number;
    message?: string;
  } | null>(null);
  const realtimeBroadcastRef = useRef<RealtimeChannel | null>(null);
  const realtimeReadyRef = useRef(false);
  const pendingDisplayPayloadRef = useRef<Parameters<typeof publishInstantDisplay>[0] | null>(null);
  const pendingDisplayLotRef = useRef<Lot | null>(null);
  const pendingCompletedCategoryRef = useRef<PlayerCategory | null>(null);
  const pendingSaleEventsRef = useRef<SaleEvent[]>([]);
  const latestActionRequestRef = useRef(0);
  const latestBidByLotRef = useRef<Record<string, number>>({});
  const bidInFlightRef = useRef<Set<Promise<boolean>>>(new Set());

  const selectedTournament = useMemo(
    () => tournaments.find((tournament) => tournament.id === selectedTournamentId) ?? tournaments[0],
    [selectedTournamentId, tournaments]
  );
  const selectedCategory = category || null;
  const categoryLots = selectedCategory ? selectedTournament?.lots.filter((lot) => lot.category === selectedCategory) ?? [] : [];
  const categoryHasOpenLots = categoryLots.some((lot) => ["LIVE", "QUEUED", "SKIPPED"].includes(lot.status));
  const categoryIsCompleted = Boolean(selectedTournament && categoryLots.length > 0 && !categoryHasOpenLots);
  const activeCategory = selectedTournament?.lots.find((lot) => lot.status === "LIVE")?.category ?? selectedCategory;
  const activeCategoryLots = selectedTournament?.lots.filter((lot) => lot.category === activeCategory) ?? [];
  const activeCategoryIsOpen = activeCategoryLots.some((lot) => ["LIVE", "QUEUED", "SKIPPED"].includes(lot.status));
  const canChangeCategory = !activeCategoryIsOpen || activeCategory === selectedCategory;
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
  const eligibleCustomTeams = selectedTournament && currentLot
    ? selectedTournament.teams.filter((team) => canTeamBidInCategory(selectedTournament.lots, team.id, currentLot.category))
    : [];
  const reservedOwnerTeamIds = new Set([
    ...(selectedTournament?.ownerTeamIds ?? []),
    ...(selectedTournament?.lots.filter((lot) => lot.status === "UNSOLD" && lot.soldToTeamId).map((lot) => lot.soldToTeamId as string) ?? [])
  ]);
  const eligibleOwnerTeams = selectedTournament && currentLot
    ? selectedTournament.teams.filter((team) => canTeamBidInCategory(selectedTournament.lots, team.id, currentLot.category) && !reservedOwnerTeamIds.has(team.id))
    : [];
  const selectedCustomTeam = selectedTournament?.teams.find((team) => team.id === customTeamId);
  const selectedCustomMax = selectedCustomTeam && currentLot && selectedTournament ? getMaxAllowedBid(selectedCustomTeam, selectedTournament.lots, currentLot.category) : 0;
  const customAmountNumber = Number(customAmount);
  const customBidError =
    customAmount && customAmountNumber > selectedCustomMax
      ? `${selectedCustomTeam?.name ?? "Selected team"} can bid up to ${formatPoints(selectedCustomMax)} pts.`
      : "";
  const auctionCanEnd = Boolean(selectedTournament?.lots.length && selectedTournament.lots.every((lot) => lot.status === "SOLD"));

  function mergeLatestBids(incomingTournament: Tournament) {
    return {
      ...incomingTournament,
      lots: incomingTournament.lots.map((lot) => {
        const guardedAmount = latestBidByLotRef.current[lot.id] ?? 0;
        const serverLatestAmount = lot.bids.at(-1)?.amount ?? 0;
        if (serverLatestAmount >= guardedAmount) {
          if (serverLatestAmount) latestBidByLotRef.current[lot.id] = serverLatestAmount;
          return lot;
        }

        const currentLot = selectedTournament?.lots.find((item) => item.id === lot.id);
        const currentLatestAmount = currentLot?.bids.at(-1)?.amount ?? 0;
        return currentLatestAmount >= guardedAmount ? { ...lot, bids: currentLot?.bids ?? lot.bids } : lot;
      })
    };
  }

  async function load(options?: { trustServer?: boolean; lotId?: string }) {
    try {
      const response = await fetch("/api/admin/tournaments");
      const data = await readJson(response);
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not refresh auction data.");
        return null;
      }
      if (options?.trustServer && options.lotId) {
        delete latestBidByLotRef.current[options.lotId];
      }
      const incoming = (data.tournaments ?? []) as Tournament[];
      if (!incoming.length) return null;
      setTournaments(options?.trustServer ? incoming : incoming.map((tournament) => mergeLatestBids(tournament)));
      setSelectedTournamentId((current) => current || data.tournaments?.[0]?.id || "");
      setCustomTeamId((current) => current || data.tournaments?.[0]?.teams?.[0]?.id || "");
      setOwnerTeamId((current) => current || data.tournaments?.[0]?.teams?.[0]?.id || "");
      return incoming;
    } catch {
      setError("Could not refresh auction data. Please try again.");
      return null;
    }
  }

  function publishServerDisplay(tournament: Tournament, actionCategory: PlayerCategory | null) {
    const liveLot = tournament.lots.find((lot) => lot.status === "LIVE") ?? null;
    const categoryLots = actionCategory ? tournament.lots.filter((lot) => lot.category === actionCategory) : [];
    const categoryOpen = categoryLots.some((lot) => ["LIVE", "QUEUED", "SKIPPED"].includes(lot.status));
    const completedCategory = liveLot || !actionCategory || categoryOpen ? null : actionCategory;
    publishInstantDisplay(
      tournament,
      liveLot,
      realtimeReadyRef.current ? realtimeBroadcastRef.current : null,
      completedCategory,
      []
    );
  }

  async function syncDisplayFromServer(targetLotId: string, actionCategory: PlayerCategory | null) {
    const incoming = await load({ trustServer: true, lotId: targetLotId });
    const tournament = incoming?.find((item) => item.id === selectedTournament?.id) ?? incoming?.[0];
    if (tournament) {
      publishServerDisplay(tournament, actionCategory);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (soldFeedback?.phase !== "confirmed") return;
    const timeout = window.setTimeout(() => setSoldFeedback(null), 10000);
    return () => window.clearTimeout(timeout);
  }, [soldFeedback]);

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
        publishInstantDisplay(pendingDisplayPayloadRef.current, pendingDisplayLotRef.current, channel, pendingCompletedCategoryRef.current, pendingSaleEventsRef.current);
        pendingDisplayPayloadRef.current = null;
        pendingDisplayLotRef.current = null;
        pendingCompletedCategoryRef.current = null;
        pendingSaleEventsRef.current = [];
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
    let optimisticCompletedCategory: PlayerCategory | null = null;
    let optimisticSaleEvents: SaleEvent[] = [];
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

      if (actionType === "live") {
        lots.forEach((lot, index) => {
          if (lot.status === "LIVE") {
            lots[index] = { ...lot, status: "QUEUED" };
          }
        });
        lots[targetIndex] = { ...lots[targetIndex], status: "LIVE" };
        optimisticLiveLot = lots[targetIndex];
      }

      if (actionType === "bid") {
        const team = tournament.teams.find((item) => item.id === payload.teamId);
        const amount = Number(payload.amount);
        if (team && Number.isFinite(amount)) {
          latestBidByLotRef.current[targetLotId] = Math.max(latestBidByLotRef.current[targetLotId] ?? 0, amount);
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
          const team = tournament.teams.find((item) => item.id === latest?.teamId);
          if (latest && team) {
            optimisticSaleEvents = [
              {
                id: `${targetLotId}-${latest.amount}`,
                playerName: lots[targetIndex].player.name,
                playerPhotoUrl: lots[targetIndex].player.photoUrl,
                category: lots[targetIndex].category,
                teamName: team.name,
                teamColor: team.color,
                amount: latest.amount,
                kind: "sold"
              }
            ];
          }
          optimisticLiveLot = lots[targetIndex];
          optimisticTournament = tournament;
          return optimisticTournament;
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

      if (actionType === "owner") {
        const teamId = String(payload.teamId ?? "");
        lots[targetIndex] = {
          ...lots[targetIndex],
          status: "UNSOLD",
          soldToTeamId: teamId,
          soldAmount: null,
          orderIndex: maxOrderIndex + 1,
          bids: []
        };
        if (nextOpenLot) {
          const nextIndex = lots.findIndex((lot) => lot.id === nextOpenLot.id);
          lots[nextIndex] = { ...lots[nextIndex], status: "LIVE" };
          optimisticLiveLot = lots[nextIndex];
        }
      }

      if (actionType === "unsell") {
        const teams = tournament.teams.map((team) =>
          team.id === lots[targetIndex].soldToTeamId
            ? { ...team, spent: Math.max(team.spent - (lots[targetIndex].soldAmount ?? 0), 0) }
            : team
        );
        lots[targetIndex] = {
          ...lots[targetIndex],
          status: "LIVE",
          soldToTeamId: null,
          soldAmount: null,
          bids: []
        };
        optimisticLiveLot = lots[targetIndex];
        optimisticTournament = { ...tournament, teams, lots };
        return optimisticTournament;
      }

      optimisticTournament = { ...tournament, lots };
      return optimisticTournament;
    });

    setTournaments(nextTournaments);

    if (optimisticTournament) {
      publishInstantDisplay(optimisticTournament, optimisticLiveLot, realtimeReadyRef.current ? realtimeBroadcastRef.current : null, optimisticCompletedCategory, optimisticSaleEvents);
      if (!realtimeReadyRef.current) {
        pendingDisplayPayloadRef.current = optimisticTournament;
        pendingDisplayLotRef.current = optimisticLiveLot;
        pendingCompletedCategoryRef.current = optimisticCompletedCategory;
        pendingSaleEventsRef.current = optimisticSaleEvents;
      }
    }
  }

  async function action(payload: Record<string, unknown>, targetLotId = currentLot?.id, actionCategory = selectedCategory): Promise<boolean> {
    if (!selectedTournament || !targetLotId) return false;

    const run = async (): Promise<boolean> => {
    const transitionId = makeTransitionId(String(payload.action ?? "action"), targetLotId);
    const requestId = latestActionRequestRef.current + 1;
    latestActionRequestRef.current = requestId;
    const isBid = payload.action === "bid";
    setError("");
    if (!["sold", "owner"].includes(String(payload.action ?? ""))) setStatusMessage("");
    appendTransitionDebug({
      id: transitionId,
      source: "admin-click",
      action: String(payload.action ?? ""),
      tournament: selectedTournament.name,
      category: actionCategory,
      lotId: targetLotId,
      player: selectedTournament.lots.find((lot) => lot.id === targetLotId)?.player.name ?? null,
      amount: typeof payload.amount === "number" ? payload.amount : null
    });
    applyOptimisticAction(payload, targetLotId);
    let response: Response;
    let data: { error?: string; tournament?: Tournament; saleEvents?: SaleEvent[]; transitionId?: string };
    try {
      response = await fetch(`/api/admin/tournaments/${selectedTournament.id}/auction`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lotId: targetLotId, currentCategory: actionCategory, transitionId, ...payload })
      });
      data = await readJson(response);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Auction action failed.");
      if (payload.action === "sold") {
        setSoldFeedback({
          phase: "failed",
          playerName: selectedTournament.lots.find((lot) => lot.id === targetLotId)?.player.name ?? "Player",
          message: fetchError instanceof Error ? fetchError.message : "Auction action failed."
        });
      }
      if (payload.action === "sold" || payload.action === "owner") {
        await syncDisplayFromServer(targetLotId, actionCategory);
      } else {
        await load({ trustServer: true, lotId: targetLotId });
      }
      return false;
    }
    if (!isBid && requestId !== latestActionRequestRef.current) return false;

      if (!response.ok) {
      const guardedAmount = targetLotId ? latestBidByLotRef.current[targetLotId] ?? 0 : 0;
      const isStaleBidError =
        payload.action === "bid" &&
        typeof data.error === "string" &&
        data.error.startsWith("Bid must be at least") &&
        guardedAmount > 0;
      if (isStaleBidError) return false;

      appendTransitionDebug({
        id: transitionId,
        source: "admin-error",
        action: String(payload.action ?? ""),
        tournament: selectedTournament.name,
        category: actionCategory,
        lotId: targetLotId,
        note: data.error ?? "Auction action failed."
      });
      setError(data.error ?? "Auction action failed.");
      setStatusMessage("");
      if (payload.action === "sold") {
        setSoldFeedback({
          phase: "failed",
          playerName: selectedTournament.lots.find((lot) => lot.id === targetLotId)?.player.name ?? "Player",
          message: data.error ?? "Auction action failed."
        });
      }
      if (payload.action === "sold" || payload.action === "owner") {
        await syncDisplayFromServer(targetLotId, actionCategory);
      } else {
        await load({ trustServer: true, lotId: targetLotId });
      }
      return false;
    }
    if (!data.tournament) {
      const incoming = await load({ trustServer: true, lotId: targetLotId });
      const refreshedTournament =
        incoming?.find((item) => item.id === selectedTournament.id) ??
        incoming?.find((item) => item.id === selectedTournamentId) ??
        incoming?.[0];
      if (!refreshedTournament) {
        setError("Action saved but tournament data could not be refreshed. Please reload the page.");
        if (payload.action === "sold") {
          setSoldFeedback({
            phase: "failed",
            playerName: selectedTournament.lots.find((lot) => lot.id === targetLotId)?.player.name ?? "Player",
            message: "Could not refresh tournament data after sold."
          });
        }
        return false;
      }
      const mergedTournament = mergeLatestBids(refreshedTournament);
      const responseLiveLot = mergedTournament.lots.find((lot: Lot) => lot.status === "LIVE") ?? null;
      const categoryLots = actionCategory ? mergedTournament.lots.filter((lot) => lot.category === actionCategory) : [];
      const categoryOpen = categoryLots.some((lot) => ["LIVE", "QUEUED", "SKIPPED"].includes(lot.status));
      const completedCategory = responseLiveLot || !actionCategory || categoryOpen ? null : actionCategory;
      setTournaments((current) => current.map((tournament) => (tournament.id === mergedTournament.id ? mergedTournament : tournament)));
      publishInstantDisplay(
        mergedTournament,
        responseLiveLot,
        realtimeReadyRef.current ? realtimeBroadcastRef.current : null,
        completedCategory,
        data.saleEvents ?? [],
        false,
        data.transitionId ?? transitionId
      );
      if (payload.action === "sold") {
        const saleEvent = data.saleEvents?.[0];
        if (saleEvent) {
          setSoldFeedback({
            phase: "confirmed",
            playerName: saleEvent.playerName,
            teamName: saleEvent.teamName,
            amount: saleEvent.amount
          });
          setStatusMessage(`Sold confirmed: ${saleEvent.playerName} to ${saleEvent.teamName} for ${formatPoints(saleEvent.amount)} pts.`);
          appendTransitionDebug({
            id: data.transitionId ?? transitionId,
            source: "admin-success",
            action: "sold",
            tournament: selectedTournament.name,
            category: actionCategory,
            lotId: targetLotId,
            player: saleEvent.playerName,
            amount: saleEvent.amount,
            note: `Sold to ${saleEvent.teamName}`
          });
        } else {
          setSoldFeedback({
            phase: "confirmed",
            playerName: selectedTournament.lots.find((lot) => lot.id === targetLotId)?.player.name ?? "Player"
          });
          setStatusMessage("Sold confirmed.");
        }
      }
      if (payload.action === "owner") {
        const targetLot = mergedTournament.lots.find((lot) => lot.id === targetLotId);
        const team = mergedTournament.teams.find((item) => item.id === payload.teamId);
        setStatusMessage(
          targetLot && team
            ? `Owner confirmed: ${targetLot.player.name} reserved for ${team.name}.`
            : "Owner player confirmed."
        );
      }
      return true;
    }
    if (data.tournament) {
      const responseTournament = data.tournament;
      const mergedTournament = mergeLatestBids(responseTournament);
      const responseLiveLot = mergedTournament.lots.find((lot: Lot) => lot.status === "LIVE") ?? null;
      setTournaments((current) => current.map((tournament) => (tournament.id === mergedTournament.id ? mergedTournament : tournament)));
      setSelectedTournamentId(responseTournament.id);
      setCustomTeamId((current) => current || responseTournament.teams?.[0]?.id || "");
      setOwnerTeamId((current) => current || responseTournament.teams?.[0]?.id || "");
      publishInstantDisplay(
        mergedTournament,
        responseLiveLot,
        realtimeReadyRef.current ? realtimeBroadcastRef.current : null,
        responseLiveLot ? null : actionCategory,
        data.saleEvents ?? [],
        false,
        data.transitionId ?? transitionId
      );
      if (payload.action === "sold") {
        const saleEvent = data.saleEvents?.[0];
        if (saleEvent) {
          setSoldFeedback({
            phase: "confirmed",
            playerName: saleEvent.playerName,
            teamName: saleEvent.teamName,
            amount: saleEvent.amount
          });
          setStatusMessage(`Sold confirmed: ${saleEvent.playerName} to ${saleEvent.teamName} for ${formatPoints(saleEvent.amount)} pts.`);
          appendTransitionDebug({
            id: data.transitionId ?? transitionId,
            source: "admin-success",
            action: "sold",
            tournament: selectedTournament.name,
            category: actionCategory,
            lotId: targetLotId,
            player: saleEvent.playerName,
            amount: saleEvent.amount,
            note: `Sold to ${saleEvent.teamName}`
          });
        } else {
          setSoldFeedback({
            phase: "confirmed",
            playerName: selectedTournament.lots.find((lot) => lot.id === targetLotId)?.player.name ?? "Player"
          });
          setStatusMessage("Sold confirmed.");
        }
      }
      if (payload.action === "owner") {
        const targetLot = responseTournament.lots.find((lot) => lot.id === targetLotId);
        const team = responseTournament.teams.find((item) => item.id === payload.teamId);
        setStatusMessage(
          targetLot && team
            ? `Owner confirmed: ${targetLot.player.name} reserved for ${team.name}.`
            : "Owner player confirmed."
        );
      }
      return true;
    }

    return true;
    };

    if (payload.action === "bid") {
      const promise = run();
      bidInFlightRef.current.add(promise);
      promise.finally(() => bidInFlightRef.current.delete(promise));
      return true;
    }

    return run();
  }

  async function waitForPendingBids() {
    const pending = [...bidInFlightRef.current];
    if (!pending.length) return;
    await Promise.allSettled(pending);
  }

  async function addBid(teamId: string, amount: number, autoStepFastTap = true) {
    if (!openCurrentLot) {
      setError("This player is already closed. Use Re-auction if you need to restart.");
      return;
    }
    const team = selectedTournament?.teams.find((item) => item.id === teamId);
    if (team && currentLot && selectedTournament && !canTeamBidInCategory(selectedTournament.lots, team.id, currentLot.category)) {
      setError(`${team.name} already has the required player count for ${currentLot.category}.`);
      return;
    }
    const latestKnownAmount = currentLot ? Math.max(latestBidByLotRef.current[currentLot.id] ?? 0, currentLot.bids.at(-1)?.amount ?? 0) : 0;
    const safeAmount = currentLot
      ? Math.max(amount, autoStepFastTap ? latestKnownAmount + selectedTournament.bidIncrement : amount, currentLot.basePrice)
      : amount;
    if (!autoStepFastTap && safeAmount < latestKnownAmount + selectedTournament.bidIncrement) {
      setError(`Bid must be at least ${formatPoints(latestKnownAmount + selectedTournament.bidIncrement)} pts.`);
      return;
    }
    const maxAllowedBid = team && currentLot ? getMaxAllowedBid(team, selectedTournament.lots, currentLot.category) : 0;
    if (team && safeAmount > maxAllowedBid) {
      setError(`${team.name} can bid up to ${formatPoints(maxAllowedBid)} pts. Required category slots must stay reserved.`);
      return;
    }
    void action({ action: "bid", teamId, amount: safeAmount });
  }

  async function addCustomBid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(customAmount);
    if (!amount || amount < defaultNextAmount) {
      setError(`Bid must be at least ${formatPoints(defaultNextAmount)} pts.`);
      return;
    }
    if (!customTeamId) {
      setError(`No eligible teams can bid for ${currentLot?.category ?? "this category"}.`);
      return;
    }
    const team = selectedTournament?.teams.find((item) => item.id === customTeamId);
    if (team && currentLot && selectedTournament && !canTeamBidInCategory(selectedTournament.lots, team.id, currentLot.category)) {
      setError(`${team.name} already has the required player count for ${currentLot.category}.`);
      return;
    }
    const maxAllowedBid = team && currentLot && selectedTournament ? getMaxAllowedBid(team, selectedTournament.lots, currentLot.category) : 0;
    if (team && amount > maxAllowedBid) {
      setError(`${team.name} can bid up to ${formatPoints(maxAllowedBid)} pts. Required category slots must stay reserved.`);
      return;
    }
    await addBid(customTeamId, amount, false);
    setCustomAmount("");
  }

  async function sellCurrentLot() {
    if (!latestBid || !currentLot) return;
    await waitForPendingBids();
    const soldAmount = Math.max(latestBid.amount, latestBidByLotRef.current[currentLot.id] ?? 0);
    const soldTeamName = latestBid.team.name;
    setError("");
    setPendingSoldLotId(currentLot.id);
    setSoldFeedback({
      phase: "selling",
      playerName: currentLot.player.name,
      teamName: soldTeamName,
      amount: soldAmount
    });
    setStatusMessage(`Selling ${currentLot.player.name} to ${soldTeamName} for ${formatPoints(soldAmount)} pts...`);
    try {
      await action({ action: "sold", expectedBidAmount: soldAmount });
    } finally {
      setPendingSoldLotId("");
    }
  }

  async function skipPlayer() {
    if (!currentLot) return;
    await action({ action: "skip" });
  }

  async function markOwnerPlayer() {
    if (!currentLot || !ownerTeamId) return;
    const team = selectedTournament?.teams.find((item) => item.id === ownerTeamId);
    if (team && selectedTournament && !canTeamBidInCategory(selectedTournament.lots, team.id, currentLot.category)) {
      setError(`${team.name} already has the required player count for ${currentLot.category}.`);
      return;
    }
    setPendingOwnerLotId(currentLot.id);
    setStatusMessage(`Marking ${currentLot.player.name} as owner player for ${team?.name ?? "selected team"}...`);
    try {
      await action({ action: "owner", teamId: ownerTeamId });
    } finally {
      setPendingOwnerLotId("");
    }
  }

  async function unsellPlayer(lot: Lot) {
    await action({ action: "unsell" }, lot.id, lot.category);
  }

  async function endAuction() {
    if (!selectedTournament || !auctionCanEnd) return;
    setError("");
    const response = await fetch(`/api/admin/tournaments/${selectedTournament.id}/end`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not end auction.");
      return;
    }
    if (data.tournament) {
      setTournaments((current) => current.map((tournament) => (tournament.id === data.tournament.id ? data.tournament : tournament)));
      publishInstantDisplay(data.tournament, null, realtimeReadyRef.current ? realtimeBroadcastRef.current : null, null, [], true, makeTransitionId("end-auction", selectedTournament.id));
    }
  }

  function selectCategory(nextCategory: PlayerCategory) {
    if (activeCategory && nextCategory !== activeCategory && activeCategoryIsOpen) {
      setError(`Finish ${activeCategory} before moving to another category.`);
      return;
    }
    setCategory(nextCategory);
    setError("");

    const openLots = selectedTournament?.lots.filter((lot) => lot.category === nextCategory && ["QUEUED", "SKIPPED"].includes(lot.status)) ?? [];
    const alreadyLive = selectedTournament?.lots.find((lot) => lot.category === nextCategory && lot.status === "LIVE");
    if (!alreadyLive && openLots.length) {
      const randomLot = openLots[Math.floor(Math.random() * openLots.length)];
      void action({ action: "live" }, randomLot.id, nextCategory);
    }
  }

  useEffect(() => {
    if (eligibleCustomTeams.length && !eligibleCustomTeams.some((team) => team.id === customTeamId)) {
      setCustomTeamId(eligibleCustomTeams[0].id);
    }
    if (!eligibleCustomTeams.length && customTeamId) {
      setCustomTeamId("");
    }
  }, [customTeamId, eligibleCustomTeams]);

  useEffect(() => {
    if (eligibleOwnerTeams.length && !eligibleOwnerTeams.some((team) => team.id === ownerTeamId)) {
      setOwnerTeamId(eligibleOwnerTeams[0].id);
    }
    if (!eligibleOwnerTeams.length && ownerTeamId) {
      setOwnerTeamId("");
    }
  }, [eligibleOwnerTeams, ownerTeamId]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <TransitionDebugPanel label="Admin" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court-green">Live control room</p>
          <h1 className="mt-2 text-3xl font-bold">Auctioneer Panel</h1>
          <p className="mt-2 text-court-ink/60">Bids, sold status, and live display state now save to the database.</p>
        </div>
        <div className="flex gap-2">
          {auctionCanEnd ? (
            <button onClick={endAuction} className="inline-flex items-center justify-center rounded-md bg-court-green px-4 py-3 text-sm font-semibold text-white">
              End Auction
            </button>
          ) : null}
          <a href="/api/exports/summary" className="inline-flex items-center justify-center gap-2 rounded-md border border-court-ink/15 px-4 py-3 text-sm font-semibold">
            <Download size={17} /> Summary CSV
          </a>
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
      {statusMessage ? <p className="mt-5 rounded-md bg-court-mint px-4 py-3 text-sm font-semibold text-court-green">{statusMessage}</p> : null}

      {!selectedTournament ? (
        <section className="mt-8 rounded-lg border border-court-ink/10 bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold">No auction lots ready</h2>
          <p className="mt-2 text-court-ink/60">Create a tournament and add players first.</p>
        </section>
      ) : !selectedCategory ? (
        <section className="mt-8 rounded-lg border border-court-ink/10 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court-green">Category Selection</p>
          <h2 className="mt-2 text-3xl font-bold">Select a category to start</h2>
          <p className="mt-2 text-court-ink/60">The display will keep showing that the auctioneer is selecting a category until you choose one.</p>
        </section>
      ) : !currentLot ? (
        <section className="mt-8 rounded-lg border border-court-ink/10 bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold">No players in {selectedCategory}</h2>
          <p className="mt-2 text-court-ink/60">Select another category or add players to this tournament.</p>
        </section>
      ) : categoryIsCompleted ? (
        <section className="mt-8 rounded-lg border border-court-ink/10 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court-green">{categoryConfig[selectedCategory].label}</p>
          <h2 className="mt-2 text-3xl font-bold">{selectedCategory} Category Completed</h2>
          <p className="mt-2 text-court-ink/60">Select another category above. A random open player from that category will go live automatically.</p>
          <div className="mx-auto mt-6 max-w-3xl rounded-lg bg-[#f6fbf7] p-4 text-left">
            <h3 className="text-lg font-semibold">Re-auction Sold Players</h3>
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
                <button onClick={sellCurrentLot} disabled={!latestBid || currentLot.status !== "LIVE" || pendingSoldLotId === currentLot.id} className="rounded-md bg-court-green px-5 py-3 text-sm font-bold text-white disabled:opacity-40">
                  {pendingSoldLotId === currentLot.id ? "Selling..." : "Sold"}
                </button>
                <button onClick={skipPlayer} disabled={currentLot.status !== "LIVE" || pendingSoldLotId === currentLot.id} className="inline-flex items-center justify-center gap-2 rounded-md border border-court-ink/15 px-5 py-3 text-sm font-bold disabled:opacity-40">
                  <SkipForward size={17} /> Skip
                </button>
                <button onClick={() => action({ action: "unsold" })} disabled={currentLot.status !== "LIVE" || pendingSoldLotId === currentLot.id} className="rounded-md bg-court-clay px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Unsold</button>
              </div>
              {soldFeedback ? (
                <div
                  className={`mt-4 flex items-start gap-3 rounded-md px-4 py-3 text-sm font-semibold ${
                    soldFeedback.phase === "selling"
                      ? "bg-amber-50 text-amber-950 ring-1 ring-amber-200"
                      : soldFeedback.phase === "confirmed"
                        ? "bg-court-green text-white"
                        : "bg-court-clay/10 text-court-clay"
                  }`}
                >
                  {soldFeedback.phase === "selling" ? <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin" /> : null}
                  {soldFeedback.phase === "confirmed" ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : null}
                  <span>
                    {soldFeedback.phase === "selling"
                      ? `Selling ${soldFeedback.playerName} to ${soldFeedback.teamName} for ${formatPoints(soldFeedback.amount ?? 0)} pts...`
                      : soldFeedback.phase === "confirmed"
                        ? `Sold — ${soldFeedback.playerName} to ${soldFeedback.teamName} for ${formatPoints(soldFeedback.amount ?? 0)} pts`
                        : `Sell failed for ${soldFeedback.playerName}: ${soldFeedback.message ?? "Please try again."}`}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="mt-5 rounded-lg border border-court-ink/10 bg-[#f6fbf7] p-4">
              <h2 className="text-lg font-semibold">Owner Player</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                <select value={ownerTeamId} onChange={(event) => setOwnerTeamId(event.target.value)} className="focus-ring h-12 rounded-md border border-court-ink/15 bg-white px-3">
                  {eligibleOwnerTeams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
                <button
                  onClick={markOwnerPlayer}
                  disabled={
                    currentLot.status !== "LIVE" ||
                    !ownerTeamId ||
                    pendingOwnerLotId === currentLot.id ||
                    !canTeamBidInCategory(selectedTournament.lots, ownerTeamId, currentLot.category)
                  }
                  className="inline-flex h-12 items-center justify-center rounded-md bg-court-green px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pendingOwnerLotId === currentLot.id ? "Marking..." : "Mark Owner"}
                </button>
              </div>
              <p className="mt-3 text-sm text-court-ink/55">
                {eligibleOwnerTeams.length
                  ? "Owner players wait until this category completes, then sell to their own team at the category average."
                  : "No eligible owner teams remain for this category."}
              </p>
            </div>

            <div className="mt-5">
              <h2 className="text-lg font-semibold">Quick Bid</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {selectedTournament.teams.map((team) => {
                  const canBidInCategory = canTeamBidInCategory(selectedTournament.lots, team.id, currentLot.category);
                  const maxAllowedBid = getMaxAllowedBid(team, selectedTournament.lots, currentLot.category);
                  const reserveAfterThisCategory = getRequiredReserve(selectedTournament.lots, team.id, currentLot.category);

                  return (
                    <button key={team.id} disabled={!openCurrentLot || !canBidInCategory || defaultNextAmount > maxAllowedBid} onClick={() => addBid(team.id, defaultNextAmount)} className="rounded-lg border border-court-ink/10 p-4 text-left transition hover:border-court-green hover:bg-court-mint/30 disabled:cursor-not-allowed disabled:opacity-40">
                      <span className="flex items-center gap-2 font-semibold">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: team.color ?? "#1f8f64" }} />
                        {team.name}
                      </span>
                      <span className="mt-2 block text-sm text-court-ink/55">
                        {canBidInCategory ? `Bid ${formatPoints(defaultNextAmount)} · max ${formatPoints(maxAllowedBid)}` : `Already has ${currentLot.category} player`}
                      </span>
                      <span className="mt-1 block text-xs text-court-ink/45">{formatPoints(team.budget - team.spent)} left · {formatPoints(reserveAfterThisCategory)} reserved</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={addCustomBid} className="mt-5 rounded-lg border border-court-ink/10 bg-[#f6fbf7] p-4">
              <h2 className="text-lg font-semibold">Custom Bid</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <select value={customTeamId} onChange={(event) => setCustomTeamId(event.target.value)} className="focus-ring h-12 rounded-md border border-court-ink/15 bg-white px-3">
                  {eligibleCustomTeams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
                <input value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} min={defaultNextAmount} type="number" step={selectedTournament.bidIncrement} placeholder={`Eg. ${defaultNextAmount}`} className="focus-ring h-12 rounded-md border border-court-ink/15 bg-white px-3" />
                <button disabled={!openCurrentLot || !eligibleCustomTeams.length} className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-court-ink px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Gavel size={17} /> Add Bid</button>
              </div>
              <p className={`mt-3 text-sm ${customBidError ? "font-semibold text-court-clay" : "text-court-ink/55"}`}>
                {customBidError ||
                  (eligibleCustomTeams.length
                    ? `Minimum valid custom bid is ${formatPoints(defaultNextAmount)} pts. Selected team max is ${formatPoints(selectedCustomMax)} pts.`
                    : `No eligible teams can bid for ${currentLot.category}.`)}
              </p>
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
              <h2 className="text-lg font-semibold">Sold Players in {selectedCategory}</h2>
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
