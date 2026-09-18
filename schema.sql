-- Run this once in the Neon SQL editor (or via psql) before first deploy.

CREATE TABLE IF NOT EXISTS visits (
  id             SERIAL PRIMARY KEY,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip             TEXT,
  user_agent     TEXT,
  browser        TEXT,
  os             TEXT,
  device_type    TEXT,
  device_vendor  TEXT,
  device_model   TEXT,
  timezone       TEXT,
  screen_res     TEXT,
  language       TEXT
);

-- Optional: table to persist PNRs server-side instead of (or in addition to)
-- the browser's localStorage. Not wired up by default -- the app currently
-- keeps PNR history in localStorage only, per the "store data locally" spec.
CREATE TABLE IF NOT EXISTS pnrs (
  id             SERIAL PRIMARY KEY,
  record_locator TEXT UNIQUE NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload        JSONB NOT NULL
);
