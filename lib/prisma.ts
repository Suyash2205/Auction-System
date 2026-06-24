import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getPooledDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim();
  if (!rawUrl) return undefined;

  try {
    const parsed = new URL(rawUrl);

    // Supabase session pooler (5432) exhausts quickly on serverless — use transaction pooler.
    if (parsed.hostname.includes("pooler.supabase.com") && (parsed.port === "5432" || parsed.port === "")) {
      parsed.port = "6543";
    }

    if (!parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true");
    }

    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "1");
    }

    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "30");
    }

    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "15");
    }

    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim());
}

const databaseUrl = getPooledDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(
    databaseUrl
      ? {
          datasources: { db: { url: databaseUrl } }
        }
      : undefined
  );

globalForPrisma.prisma = prisma;

export const prismaTransactionOptions = {
  maxWait: 15000,
  timeout: 20000
};
