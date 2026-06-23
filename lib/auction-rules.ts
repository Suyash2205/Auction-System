import { categoryConfig } from "@/lib/demo-data";
import type { PlayerCategory } from "@/lib/types";

type SoldLot = {
  category: PlayerCategory;
  status: string;
  soldToTeamId: string | null;
};

type TeamBudget = {
  id: string;
  budget: number;
  spent: number;
};

export function getRequiredReserve(lots: SoldLot[], teamId: string, currentCategory?: PlayerCategory) {
  return Object.entries(categoryConfig).reduce((total, [category, config]) => {
    const typedCategory = category as PlayerCategory;
    const soldCount = getCategoryOwnedCount(lots, teamId, typedCategory);
    const currentLotWouldFillSlot = currentCategory === typedCategory ? 1 : 0;
    const remainingSlots = Math.max(config.required - soldCount - currentLotWouldFillSlot, 0);

    return total + remainingSlots * config.basePrice;
  }, 0);
}

export function getMaxAllowedBid(team: TeamBudget, lots: SoldLot[], currentCategory: PlayerCategory) {
  return Math.max(team.budget - team.spent - getRequiredReserve(lots, team.id, currentCategory), 0);
}

export function getCategoryOwnedCount(lots: SoldLot[], teamId: string, category: PlayerCategory) {
  return lots.filter(
    (lot) => lot.category === category && ["SOLD", "UNSOLD"].includes(lot.status) && lot.soldToTeamId === teamId
  ).length;
}

export function canTeamBidInCategory(lots: SoldLot[], teamId: string, category: PlayerCategory) {
  return getCategoryOwnedCount(lots, teamId, category) < categoryConfig[category].required;
}
