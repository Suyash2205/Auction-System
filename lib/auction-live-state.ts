import type { AuctionLot, PlayerCategory } from "@/lib/types";

export const AUCTION_LIVE_STATE_KEY = "lush-pickleball-live-auction";

export type AuctionLiveState = {
  category: PlayerCategory;
  lotIndex: number;
  lots: AuctionLot[];
  updatedAt: string;
};
