# GDS Command Trainer

A browser-based simulator of real Amadeus-style "cryptic" GDS commands
(AN, SS, NM, AP-family, TK, RF, RT, XE, DAC/DAN, FXP, SM/ST, etc.) for
learning the actual syntax. Not connected to any real airline inventory or
GDS — availability is deterministic/fake, but the entries and PNR rules
mirror the real system as closely as a training tool reasonably can.

- **CLI panel** (top/left): type commands, see terminal-style output. Scrollable.
- **Lower/right panel**, three tabs:
  - **Practice Tasks** — 9 guided exercises, from single commands up to a full
    real-world work order, with self-checking steps and hidden hints.
  - **Command List** — quick reference for every entry the engine understands.
  - **Database** — a dashboard of every PNR you've saved with `ER`: record
    locator, passengers, route, ticketing status. Retrieve or delete straight
    from the list.
- A **chat helper** ("GDS Study Buddy") in the bottom-right corner, tailored
  to this trainer's exact command set, for when you're stuck.

## Everything is local — no database, no connection string

All PNR data, saved bookings, and practice progress live only in the
browser's `localStorage`. Nothing about your bookings is ever sent to a
server. There is **no database to set up** — if you've used an earlier
version of this project that mentioned Neon/Postgres, that's gone; it's not
needed.

The one thing that *does* leave the browser is chat messages, if you use the
chat helper — see below.

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

Real Amadeus has far more beyond this (ticketing/payment, queues, profiles,
fare rules, PNR splitting, and a lot more) — this trainer is the
foundational subset, not the whole system. `HE` and `HE <topic>` work
in-app for quick reference.

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

### 3. (Optional) Enable the chat helper

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
lib/practice.ts        the 9-task practice curriculum
lib/chat-handler.js      Gemini proxy logic (shared, used by pages/api/chat.js)
pages/api/chat.js         the chat API route
public/config.js         chat widget config/personality (edit this to customize)
public/widget.js           the chat widget engine (rarely needs editing)
```
