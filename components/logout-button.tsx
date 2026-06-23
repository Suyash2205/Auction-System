"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <button
      onClick={logout}
      className="flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
    >
      <LogOut size={17} />
      <span className="hidden sm:inline">Logout</span>
    </button>
  );
}
