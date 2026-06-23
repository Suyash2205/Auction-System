import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
};

export function StatCard({ label, value, helper, icon: Icon }: StatCardProps) {
  return (
    <section className="rounded-lg border border-court-ink/10 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-court-ink/55">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-court-ink">{value}</p>
          <p className="mt-2 text-sm text-court-ink/60">{helper}</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-md bg-court-mint text-court-ink">
          <Icon size={20} />
        </span>
      </div>
    </section>
  );
}
