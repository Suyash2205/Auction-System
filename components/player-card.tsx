import Image from "next/image";
import { BadgeIndianRupee, MapPin, Trophy } from "lucide-react";
import { categoryConfig, formatPoints } from "@/lib/demo-data";
import type { Player, PlayerCategory } from "@/lib/types";

type PlayerCardProps = {
  player: Player;
  category?: PlayerCategory;
  basePrice?: number;
  compact?: boolean;
};

export function PlayerCard({ player, category, basePrice, compact }: PlayerCardProps) {
  return (
    <article className="overflow-hidden rounded-lg border border-court-ink/10 bg-white shadow-sm">
      <div className={compact ? "relative h-36" : "relative h-64"}>
        <Image src={player.photoUrl} alt={player.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 420px" />
        {category ? (
          <div className="absolute left-3 top-3 rounded-md bg-court-lime px-3 py-1 text-xs font-bold text-court-ink">
            {category} · {categoryConfig[category].label}
          </div>
        ) : null}
      </div>
      <div className="p-4">
        <h3 className="text-xl font-semibold text-court-ink">{player.name}</h3>
        <div className="mt-3 grid gap-2 text-sm text-court-ink/65">
          <span className="flex items-center gap-2"><Trophy size={16} /> {player.experience} experience</span>
          <span className="flex items-center gap-2"><MapPin size={16} /> {player.city} · {player.dominantHand} hand</span>
          {basePrice ? (
            <span className="flex items-center gap-2"><BadgeIndianRupee size={16} /> Base {formatPoints(basePrice)} pts</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
