import { NextResponse } from "next/server";
import { categoryConfig, categoryOrder } from "@/lib/demo-data";
import { lpl4Players } from "@/lib/lpl4-players";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const EXCLUDED_DB_NAMES = new Set(["suyash", "siddharth jain"]);

export async function GET() {
  try {
    const dbPlayers = await prisma.player.findMany({
      select: {
        id: true,
        name: true,
        photoUrl: true,
        experience: true,
        city: true,
        dominantHand: true
      }
    });

    const dbByName = new Map(
      dbPlayers
        .filter((player) => !EXCLUDED_DB_NAMES.has(normalizePlayerName(player.name)))
        .map((player) => [normalizePlayerName(player.name), player])
    );

    const players = categoryOrder.flatMap((category) => {
      const categoryPlayers = lpl4Players.filter((player) => player.category === category);
      return categoryPlayers.map((player, index) => {
        const match = player.dbName ? dbByName.get(normalizePlayerName(player.dbName)) ?? null : null;
        return {
          id: player.id,
          listName: player.name,
          dbName: match?.name ?? player.dbName ?? null,
          category,
          categoryLabel: categoryConfig[category].label,
          indexInCategory: index + 1,
          totalInCategory: categoryPlayers.length,
          isOwner: Boolean(player.isOwner),
          photoUrl: match?.photoUrl ?? null,
          experience: match?.experience ?? null,
          city: match?.city ?? null,
          dominantHand: match?.dominantHand ?? null
        };
      });
    });

    const categories = categoryOrder.map((category) => ({
      category,
      label: categoryConfig[category].label,
      count: players.filter((player) => player.category === category).length,
      startIndex: players.findIndex((player) => player.category === category)
    }));

    return NextResponse.json(
      { players, categories, total: players.length },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("Screen-share player list failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load players." },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }
}

function normalizePlayerName(value: string) {
  return value
    .toLowerCase()
    .replace(/^(mr|mrs|ms|dr)\.?\s+/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
