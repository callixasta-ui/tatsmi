# GDS Command Trainer

A browser-based simulator of real Amadeus-style "cryptic" GDS commands
(AN, SS, NM, AP-family, TK, RF, RT, XE, DAC/DAN, FXP, FP, TTP, SM/ST, etc.)
for learning the actual syntax — including the full fare-quote → payment →
ticket-issuance flow, not just booking. Not connected to any real airline
inventory or GDS — availability is deterministic/fake, but the entries and
PNR rules mirror the real system as closely as a training tool reasonably
can.

- **CLI panel** (top/left): type commands, see terminal-style output. Scrollable.
- **Lower/right panel**, three tabs:
  - **Practice Tasks** — 10 guided exercises, from single commands up to a full
    real-world work order, with self-checking steps and hidden hints.
  - **Command List** — quick reference for every entry the engine understands.
  - **Database** — a dashboard of every PNR you've saved with `ER`/`ET`: record
    locator, passengers, route, ticketing status. Retrieve or delete straight
    from the list.
  - **Global Chat** — a public room shared by everyone using the trainer.
    First visit asks for a one-time username; messages are stored in Neon
    Postgres so everybody sees the same conversation.
- **Work areas A–F** (chips in the CLI header, or `JA`…`JF` / `JO`): each area
  holds its own booking in progress, like a real Amadeus terminal. `ET` saves a
  PNR and clears the area; `ER` saves but leaves it open; `IG` discards.
- A **chat helper** ("GDS Study Buddy") in the bottom-right corner, tailored
  to this trainer's exact command set, for when you're stuck.

## What's stored where

PNRs, saved bookings, practice progress and quiz results live only in the
browser's `localStorage` — nothing about your bookings is sent to a server.

Two features do use a server:

- **Amy (chat helper)** — messages go through `/api/chat` to Google's Gemini API.
- **Global Chat** — usernames and messages are stored in a **Neon Postgres**
  database via `/api/global-chat`. Only the hash of each browser's secret token
  is stored (it proves you own your username), and the connection string stays
  server-side in `DATABASE_URL`.

## Command coverage & real-syntax notes

This implements the actual mandatory-element rule: a PNR needs a name,
a segment, a contact, a ticketing arrangement, **and a Received From (`RF`)**
before `ER` will save it — same as the real system, and `ER` tells you
exactly which of the five you're missing. A few syntax details that are
easy to get wrong and are modeled faithfully here:

- Email is `APE`, not plain `AP` (which is phone). Mobile is `APM`, home is `APH`.
- Retrieving a saved PNR is `RT<LOCATOR>` — no punctuation, no asterisk.
- `TKTL` takes a real date **and time**: `TKTL20JAN/1700`, not just a date.
- Selling into a class showing 0 seats doesn't fail — it waitlists (`HL`
  instead of `HK`), same as a real system. A fully closed class (`C`) does
  refuse the sale.
- The `OS` entry displays as an `OSI` element on the PNR — that's correct
  behavior, not a typo.
- **Ticketing is a real two-step (now three-step) flow, not just `TKOK`/`TKTL`.**
  `TKOK`/`TKTL` is only an *arrangement* — a promise to ticket by some point.
  It never produces a fare or a ticket, on the real system or here. To
  actually issue a ticket: price the PNR with `FXP` (stores the result as a
  TST — Transitional Stored Ticket, `T01`, `T02`...), add a form of payment
  with `FP` (`FP CASH`, `FP CHEQUE`, or `FP CC<2-letter vendor><card
  number>/<MMYY>`, e.g. `FPCCVI4444333322221111/0128`), then run `TTP`
  (Ticketing Transactional Print) on the **saved** PNR. `TTP` refuses a
  PNR with no locator, no unused TST, no `FP`, or any segment still
  waitlisted (`HL`) — same constraints a real terminal enforces. On success
  it mints a real-format 13-digit ticket number per passenger (3-digit IATA
  airline numeric code + 10-digit document number, with a genuine mod-7
  check digit) and adds it to the PNR as an `FA` element, same code real
  Amadeus uses for an issued ticket line.

Real Amadeus still has more beyond this — queues (`QT`/`QC`), PNR history
(`RH`), PNR splitting/copying, traveler profiles, fare rules display, and
more — this trainer is a thorough foundational-to-intermediate subset, not
the whole system. `HE` and `HE <topic>` work in-app for quick reference.

## Local development

```bash
npm install
npm run dev
```

## Deploying

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "GDS command trainer"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### 2. Deploy to Vercel

1. Import the repo at https://vercel.com/new.
2. Deploy — no environment variables are required for the trainer itself.
3. In the deployed project's dashboard, open **Analytics** and enable it
   (one click) if you want Vercel Web Analytics page-view stats.

### 3. Enable Global Chat (Neon)

1. In Neon, copy your connection string (`postgresql://...`).
2. In Vercel, **Settings → Environment Variables**, add `DATABASE_URL`. Locally,
   put it in `.env.local`.
3. Redeploy. The tables are created automatically on first use
   (`schema.sql` shows them if you'd rather create them yourself).

### 4. (Optional) Enable the chat helper

The "GDS Study Buddy" widget needs a Gemini API key to actually respond —
without one it'll just show a friendly error when someone tries to chat.

1. Get a free key at https://aistudio.google.com/apikey.
2. In Vercel, **Settings → Environment Variables**, add `GEMINI_API_KEY`.
3. Redeploy.

To customize what the bot knows or how it looks, edit `public/config.js` —
it's the one file you need to touch. Its `systemPrompt` is already written
to match this trainer's exact command set, so it won't invent syntax that
doesn't actually work here.

## Project structure

```
app/page.tsx        the CLI + tabbed panel UI
app/layout.tsx       loads the chat widget scripts
lib/commands.ts       the command engine (all AN/SS/NM/... logic)
lib/practice.ts        the 10-task practice curriculum
lib/chat-handler.js      Gemini proxy logic (shared, used by pages/api/chat.js)
pages/api/chat.js         the Amy (Gemini) API route
pages/api/global-chat.js  the Global Chat API route (Neon)
lib/global-chat-handler.js  Global Chat logic: usernames, messages, rate limit
app/GlobalChat.tsx        the Global Chat tab UI
public/config.js         chat widget config/personality (edit this to customize)
public/widget.js           the chat widget engine (rarely needs editing)
```
