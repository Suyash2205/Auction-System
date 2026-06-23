# Lush Pickleball Auction

Web software for running a pickleball league auction with a public registration link, admin tournament setup, auctioneer controls, and a clean screen-share display.

## Stack

- Next.js, React, and TypeScript
- Tailwind CSS
- Supabase free tier for Postgres, Auth, Storage, and optional realtime
- Prisma ORM
- Vercel deployment

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Database Setup

1. Create a free Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Fill in Supabase database and API keys.
4. Run:

```bash
npm run prisma:generate
npm run prisma:push
```

The current UI includes demo data so the workflow can be tested before connecting Supabase.
