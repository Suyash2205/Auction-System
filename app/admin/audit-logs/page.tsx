import { History } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court-green">Security Trail</p>
        <h1 className="mt-2 text-3xl font-bold">Audit Logs</h1>
        <p className="mt-2 text-court-ink/60">Recent admin corrections and auction actions saved in the online database.</p>
      </div>

      <section className="mt-6 rounded-lg border border-court-ink/10 bg-white shadow-sm">
        {logs.length === 0 ? (
          <div className="grid place-items-center px-5 py-16 text-center">
            <History className="text-court-green" size={42} />
            <h2 className="mt-4 text-2xl font-semibold">No audit logs yet</h2>
            <p className="mt-2 text-court-ink/60">Create or edit tournament data and actions will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="bg-[#f6fbf7] text-sm text-court-ink/60">
                <tr>
                  <th className="px-5 py-3 font-semibold">Time</th>
                  <th className="px-5 py-3 font-semibold">Action</th>
                  <th className="px-5 py-3 font-semibold">Entity</th>
                  <th className="px-5 py-3 font-semibold">Summary</th>
                  <th className="px-5 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-court-ink/10">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-5 py-4 text-sm text-court-ink/70">
                      {new Intl.DateTimeFormat("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                      }).format(log.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-md bg-court-mint px-3 py-1 text-xs font-bold">{log.action}</span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold">{log.entityType}</td>
                    <td className="px-5 py-4 text-sm text-court-ink/80">{log.summary}</td>
                    <td className="max-w-md px-5 py-4 text-xs text-court-ink/55">
                      <code className="break-words">{log.details ? JSON.stringify(log.details) : "-"}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
