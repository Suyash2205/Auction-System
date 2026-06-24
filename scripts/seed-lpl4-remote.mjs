import { existsSync, readFileSync } from "fs";

function loadAdminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;

  for (const fileName of [".env.local", ".env"]) {
    if (!existsSync(fileName)) continue;
    for (const line of readFileSync(fileName, "utf8").split("\n")) {
      if (!line.startsWith("ADMIN_PASSWORD=")) continue;
      let value = line.slice("ADMIN_PASSWORD=".length).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (value) return value;
    }
  }

  return null;
}

async function main() {
  const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
  const force = process.argv.includes("--force");
  const password = loadAdminPassword();

  if (!password) {
    console.error("ADMIN_PASSWORD not found in environment or .env.local");
    process.exit(1);
  }

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password })
  });

  if (!loginResponse.ok) {
    console.error("Login failed:", await loginResponse.text());
    process.exit(1);
  }

  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) {
    console.error("Login succeeded but no session cookie was returned.");
    process.exit(1);
  }

  const seedResponse = await fetch(`${baseUrl}/api/admin/seed-lpl4`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie
    },
    body: JSON.stringify({ force })
  });

  const payload = await seedResponse.json();
  if (!seedResponse.ok) {
    console.error("Seed failed:", payload.error ?? payload);
    process.exit(1);
  }

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
