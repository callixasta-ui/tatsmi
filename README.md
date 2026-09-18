# GDS Command Trainer

A browser-based simulator of classic Amadeus-style "cryptic" GDS commands
(AN, SS, NM, RT, ER, etc.) for learning the syntax. Not connected to any
real airline inventory or GDS — all availability is fake/deterministic.

- **CLI panel** (top/left): type commands, see terminal-style output. Scrollable.
- **Lower/right panel**: a tab toggle between a **Practice Tasks** view (5
  guided hands-on exercises with self-checking steps and hidden hints) and a
  plain **Command List** reference. Scrollable.
- PNR/session data and practice progress are kept in the browser's `localStorage`.
- Each visit also logs basic session/device info (IP, user agent, parsed
  browser/OS, timezone, screen size, language) to a Postgres table via Neon.
  This is disclosed in the page footer and in the "Your Privacy" popup.
- Vercel Web Analytics (`@vercel/analytics`) is wired in for page-view/usage
  stats — enable it in the Vercel dashboard after deploying (see step 4 below).

### Command coverage

This covers the core PNR-building loop end to end: availability (`AN`),
selling (`SS`), name/contact/remarks/OSI/frequent-flyer elements, ticketing
arrangement, a fare quote (`FXP`), a seat map (`SM`), cancelling any element
(`XE`), review/retrieve (`RT`/`RT*`), save (`ER`), discard (`IG`), and city
decode (`DAC`). Real Amadeus has a lot more beyond this (exchanges, queues,
splitting PNRs, fare rules, multi-city itineraries, etc.) — this trainer is
meant as the foundational layer, not the whole system.

## 1. Push to GitHub

```bash
git init
git add .
git commit -m "GDS command trainer"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

## 2. Create the Neon database

1. Create a project at https://neon.tech.
2. Open the SQL editor and run everything in `schema.sql` (creates the
   `visits` table used for logging, plus an unused `pnrs` table you can
   wire up later if you want PNRs stored server-side instead of locally).
3. Copy the **pooled** connection string from Neon's dashboard
   (Connection Details → looks like `postgresql://user:pass@ep-xxxx-pooler...`).

## 3. Deploy to Vercel

1. Import the GitHub repo at https://vercel.com/new.
2. In the project's **Settings → Environment Variables**, add:
   - `DATABASE_URL` = the Neon connection string from step 2.
3. Deploy.
4. In the deployed project's dashboard, open the **Analytics** tab and enable
   it (one click). `@vercel/analytics` is already wired into `app/layout.tsx`
   — it just needs the project-level toggle turned on to start collecting.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL
npm run dev
```

## Notes / things worth doing before sharing this link widely

- The footer already discloses that session diagnostics are logged — if you
  make this public, consider adding a short privacy note too, since IP
  addresses are personal data in a lot of jurisdictions (GDPR etc.).
- `visits.ip` is stored as plain text, un-hashed, as requested. If you ever
  want to reduce what you're holding, hashing the IP (or truncating it) is
  an easy change in `app/api/log-visit/route.ts`.
- The command set covers the core PNR-building flow (AN, SS, NM, AP, TK,
  RT, ER, IG, DAC, HE). It's easy to extend — add more `match`/`if` blocks
  in `lib/commands.ts`.
