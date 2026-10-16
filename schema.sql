-- Global Chat tables (Neon Postgres).
--
-- You do NOT have to run this by hand: pages/api/global-chat.js creates these
-- tables automatically on the first request. It's here for reference, or if you
-- prefer to create them yourself in the Neon SQL editor.

CREATE TABLE IF NOT EXISTS chat_users (
  username_key TEXT PRIMARY KEY,            -- lower-cased username, enforces uniqueness
  username     TEXT NOT NULL,               -- as the person typed it
  token_hash   TEXT NOT NULL,               -- SHA-256 of the browser's secret token (proves who owns the name)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         BIGSERIAL PRIMARY KEY,
  username   TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
