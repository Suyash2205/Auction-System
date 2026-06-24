import fs from "fs";

const keys = [
  "ADMIN_PASSWORD",
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXTAUTH_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
];

const lines = [
  "# Local development — synced from Vercel production",
  "# Note: Sensitive env vars cannot be decrypted locally by the Vercel CLI.",
  "# Screen-share and other features use PRODUCTION_APP_URL from .env.development.local when needed."
];
const synced = [];

for (const key of keys) {
  const value = process.env[key]?.trim();
  if (!value) continue;
  lines.push(`${key}=${JSON.stringify(value)}`);
  synced.push(key);
}

fs.writeFileSync(".env.local", `${lines.join("\n")}\n`);
console.log(`Wrote .env.local with ${synced.length} keys: ${synced.join(", ") || "(none — sensitive vars unavailable locally)"}`);
