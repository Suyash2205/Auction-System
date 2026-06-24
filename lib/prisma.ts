import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getPooledDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;

  try {
    const parsed = new URL(url);

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

    return parsed.toString();
  } catch {
    return url;
  }
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
