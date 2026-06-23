"use client";

import Image from "next/image";
import { Camera, Pencil, Phone, Trash2 } from "lucide-react";

type Player = {
  id: string;
  name: string;
  phone: string;
  photoUrl: string | null;
  experience: string;
  city: string | null;
  dominantHand: string | null;
  createdAt: string;
};

type PlayerAdminTableProps = {
  players: Player[];
};

export function PlayerAdminTable({ players }: PlayerAdminTableProps) {
  async function updatePlayer(player: Player) {
    const name = window.prompt("Player name", player.name);
    if (!name) return;
    const phone = window.prompt("Mobile number", player.phone);
    if (!phone) return;
    const experience = window.prompt("Playing experience", player.experience);
    if (!experience) return;
    const city = window.prompt("City", player.city ?? "") ?? "";
    const dominantHand = window.prompt("Dominant hand", player.dominantHand ?? "") ?? "";

    const response = await fetch(`/api/admin/players/${player.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, phone, experience, city, dominantHand })
    });
    const data = await response.json();

    if (!response.ok) {
      window.alert(data.error ?? "Could not update player.");
      return;
    }

    window.location.reload();
  }

  async function deletePlayer(player: Player) {
    if (!window.confirm(`Delete ${player.name}? This also removes them from tournaments.`)) return;

    const response = await fetch(`/api/admin/players/${player.id}`, { method: "DELETE" });
    const data = await response.json();

    if (!response.ok) {
      window.alert(data.error ?? "Could not delete player.");
      return;
    }

    window.location.reload();
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse text-left">
        <thead className="bg-[#f6fbf7] text-sm text-court-ink/60">
          <tr>
            <th className="px-5 py-3 font-semibold">Player</th>
            <th className="px-5 py-3 font-semibold">Mobile</th>
            <th className="px-5 py-3 font-semibold">Experience</th>
            <th className="px-5 py-3 font-semibold">City</th>
            <th className="px-5 py-3 font-semibold">Hand</th>
            <th className="px-5 py-3 font-semibold">Registered</th>
            <th className="px-5 py-3 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-court-ink/10">
          {players.map((player) => (
            <tr key={player.id} className="align-middle">
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-court-mint text-court-ink">
                    {player.photoUrl ? (
                      <Image src={player.photoUrl} alt={player.name} fill className="object-cover" sizes="56px" />
                    ) : (
                      <Camera size={20} />
                    )}
                  </div>
                  <div>
                    <p className="font-bold">{player.name}</p>
                    <p className="text-sm text-court-ink/50">ID {player.id.slice(-6)}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4">
                <span className="inline-flex items-center gap-2 font-semibold">
                  <Phone size={15} /> {player.phone}
                </span>
              </td>
              <td className="px-5 py-4 text-court-ink/70">{player.experience}</td>
              <td className="px-5 py-4 text-court-ink/70">{player.city || "-"}</td>
              <td className="px-5 py-4 text-court-ink/70">{player.dominantHand || "-"}</td>
              <td className="px-5 py-4 text-court-ink/70">
                {new Intl.DateTimeFormat("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                }).format(new Date(player.createdAt))}
              </td>
              <td className="px-5 py-4">
                <div className="flex gap-2">
                  <button onClick={() => updatePlayer(player)} className="grid h-9 w-9 place-items-center rounded-md border border-court-ink/15" title="Edit player">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => deletePlayer(player)} className="grid h-9 w-9 place-items-center rounded-md border border-court-clay/30 text-court-clay" title="Delete player">
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
