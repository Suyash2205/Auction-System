export type PlayerCategory = "M1" | "M2" | "M3" | "M4" | "F1";

export type Player = {
  id: string;
  name: string;
  phone?: string;
  photoUrl: string;
  experience: string;
  city: string;
  dominantHand: "Right" | "Left";
};

export type Team = {
  id: string;
  name: string;
  ownerName: string;
  ownerPhone: string;
  color: string;
  budget: number;
  spent: number;
};

export type Bid = {
  teamId: string;
  amount: number;
  createdAt: string;
};

export type AuctionLot = {
  playerId: string;
  category: PlayerCategory;
  basePrice: number;
  status: "queued" | "live" | "sold" | "unsold";
  bids: Bid[];
  soldToTeamId?: string;
  soldAmount?: number;
};

export type Tournament = {
  id: string;
  name: string;
  date: string;
  kitty: number;
  bidIncrement: number;
  teams: Team[];
  players: Player[];
  lots: AuctionLot[];
};
