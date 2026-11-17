# Sprinto Outreach

An outbound pipeline for Sprinto's Growth Lead (MESA Case 02). Every week it finds SaaS companies that fit Sprinto's ICP,
researches them with a scraper loop, qualifies them Go / No-go with sourced reasons, finds the right person with Hunter.io,
and leaves a personalised Gmail draft. The Growth Lead edits and sends in Gmail; every edit is remembered and shapes the
next draft. Pilot mode: every draft is addressed to our own inbox (`SEND_TO_EMAIL`).

Full requirements: `Sprinto - PRD (Outreach App).docx` (v1.1) in the case folder.

## Stack

Next.js 16 on Vercel · Neon Postgres + pgvector · Gemini · Hunter.io · HubSpot · Gmail API · Jina Reader

## Run locally

```bash
cp .env.example .env      # fill in values; never commit .env
npm install
npm run db:migrate        # applies db/migrations once each
npm run dev               # http://localhost:3000
```

## Checks

```bash
npm run check             # typecheck + lint + unit tests (no live APIs)
npm run build && npm run check:bundle   # no secret reaches the browser
```

CI runs the same checks plus a gitleaks scan on every push. Tests never call live APIs (`LIVE_APIS=off`); Hunter's free
quota is protected by the test budget in PRD §12.

## Secrets

- Local: `.env` (git-ignored). Production: Vercel environment variables marked Sensitive.
- Read only through `src/lib/env.ts`, which is `server-only`; importing it from client code fails the build.
- No page or API response ever returns a key value. Settings shows "configured" and live test results only.

## Layout

| Path | What |
|---|---|
| `src/app/` | Pages: This week, Pipeline, Drafts and Why, Results, Health, Settings |
| `src/components/` | UI built from the Sprinto Ops design system |
| `src/lib/` | env, database, queries, connection checks |
| `db/migrations/` | SQL schema (PRD §9) |
| `design/sprinto-ops-design/` | Design system: tokens, components, previews (`app-screen.html`, `component-library.html`) |
| `test/` | Unit tests (Vitest) |

## Milestones

M0 setup ✓ · **M1 foundations ✓** · M2 research + qualify · M3 person + draft · M4 console · M5 Gmail + memory · M6 kill switch + learning · M7 ship
