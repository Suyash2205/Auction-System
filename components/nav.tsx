import Link from "next/link";
import { Gavel, History, LayoutDashboard, MonitorUp, UserPlus, UsersRound } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/players", label: "Players", icon: UsersRound },
  { href: "/admin/audit-logs", label: "Logs", icon: History },
  { href: "/register", label: "Register", icon: UserPlus },
  { href: "/admin/auction", label: "Auction", icon: Gavel },
  { href: "/display", label: "Display", icon: MonitorUp }
];

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/20 bg-court-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/admin" className="flex items-center gap-3 text-white">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-court-lime text-court-ink">
            <Gavel size={21} />
          </span>
          <span>
            <span className="block text-sm font-semibold leading-4">Lush Pickleball</span>
            <span className="block text-xs text-white/60">Auction Control</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                <Icon size={17} />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}
