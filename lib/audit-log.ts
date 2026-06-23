import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  tournamentId?: string | null;
  summary: string;
  details?: Prisma.InputJsonValue;
};

export async function writeAuditLog(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        tournamentId: input.tournamentId ?? null,
        summary: input.summary,
        details: input.details
      }
    });
  } catch (error) {
    console.error("Audit log write failed", error);
  }
}
