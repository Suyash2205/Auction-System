export const productionAppUrl =
  process.env.PRODUCTION_APP_URL?.trim() || "https://auction-system-eosin.vercel.app";

export async function fetchProductionJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${productionAppUrl}${path}`, {
      cache: "no-store",
      headers: { "x-local-fallback": "1" }
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    console.error(`Production fallback failed for ${path}`, error);
    return null;
  }
}
