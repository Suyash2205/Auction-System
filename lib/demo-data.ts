import type { Player, PlayerCategory, Team, Tournament } from "@/lib/types";

export const categoryConfig: Record<PlayerCategory, { label: string; basePrice: number; required: number }> = {
  M1: { label: "Male 1", basePrice: 10000, required: 1 },
  M2: { label: "Male 2", basePrice: 5000, required: 1 },
  M3: { label: "Male 3", basePrice: 5000, required: 1 },
  M4: { label: "Male 4", basePrice: 5000, required: 2 },
  F1: { label: "Female 1", basePrice: 10000, required: 1 }
};

export const categoryOrder: PlayerCategory[] = ["M1", "F1", "M2", "M3", "M4"];

export const demoPlayers: Player[] = [
  {
    id: "p1",
    name: "Aarav Mehta",
    photoUrl: "https://images.unsplash.com/photo-1543132220-3ec99c6094dc?auto=format&fit=crop&w=500&q=80",
    experience: "4 years",
    city: "Mumbai",
    dominantHand: "Right"
  },
  {
    id: "p2",
    name: "Riya Shah",
    photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80",
    experience: "3 years",
    city: "Ahmedabad",
    dominantHand: "Right"
  },
  {
    id: "p3",
    name: "Kabir Sethi",
    photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=80",
    experience: "2.5 years",
    city: "Pune",
    dominantHand: "Left"
  },
  {
    id: "p4",
    name: "Nikhil Rao",
    photoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=500&q=80",
    experience: "2 years",
    city: "Surat",
    dominantHand: "Right"
  },
  {
    id: "p5",
    name: "Dev Arora",
    photoUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=500&q=80",
    experience: "18 months",
    city: "Mumbai",
    dominantHand: "Right"
  },
  {
    id: "p6",
    name: "Ishaan Patel",
    photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=500&q=80",
    experience: "1 year",
    city: "Vadodara",
    dominantHand: "Left"
  }
];

export const demoTeams: Team[] = [
  { id: "t1", name: "Lush Smashers", ownerName: "Sahil Mehta", ownerPhone: "9820000001", color: "#1f8f64", budget: 90000, spent: 32000 },
  { id: "t2", name: "Court Kings", ownerName: "Priya Jain", ownerPhone: "9820000002", color: "#1677a8", budget: 90000, spent: 22000 },
  { id: "t3", name: "Dink Dynasty", ownerName: "Rahul Shah", ownerPhone: "9820000003", color: "#d8643f", budget: 90000, spent: 18000 },
  { id: "t4", name: "Spin Squad", ownerName: "Neha Kapoor", ownerPhone: "9820000004", color: "#7f56d9", budget: 90000, spent: 26000 }
];

export const demoTournament: Tournament = {
  id: "tour-1",
  name: "Lush Pickleball League 4.0",
  date: "2026-07-18",
  kitty: 90000,
  bidIncrement: 1000,
  teams: demoTeams,
  players: demoPlayers,
  lots: [
    { playerId: "p1", category: "M1", basePrice: 10000, status: "live", bids: [{ teamId: "t1", amount: 12000, createdAt: new Date().toISOString() }] },
    { playerId: "p2", category: "F1", basePrice: 10000, status: "queued", bids: [] },
    { playerId: "p3", category: "M2", basePrice: 5000, status: "queued", bids: [] },
    { playerId: "p4", category: "M3", basePrice: 5000, status: "queued", bids: [] },
    { playerId: "p5", category: "M4", basePrice: 5000, status: "queued", bids: [] },
    { playerId: "p6", category: "M4", basePrice: 5000, status: "queued", bids: [] }
  ]
};

export function formatPoints(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}
