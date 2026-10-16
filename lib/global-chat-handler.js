// Global chat logic, kept separate from the Next.js route so it's easy to test
// and so the Neon connection string only ever lives on the server
// (DATABASE_URL -- never sent to the browser).
//
// Identity model: the first time someone opens Global Chat they claim a
// username. The browser generates a random secret token, and only its SHA-256
// hash is stored next to the username. To post, the browser must send the
// matching token -- so nobody can type someone else's name and speak as them,
// and even a leaked database doesn't reveal usable tokens.

import { createHash } from "node:crypto";

const USERNAME_RE = /^[A-Za-z0-9_.-]{3,20}$/;
const RESERVED = new Set(["admin", "administrator", "system", "moderator", "mod", "amy", "staff", "support"]);
const MAX_BODY = 500;
const PAGE_SIZE = 50;
const KEEP_LAST = 2000; // older messages get pruned so a free-tier DB never bloats

let schemaReady = null;

export function ensureSchema(sql) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS chat_users (
        username_key TEXT PRIMARY KEY,
        username     TEXT NOT NULL,
        token_hash   TEXT NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS chat_messages (
        id         BIGSERIAL PRIMARY KEY,
        username   TEXT NOT NULL,
        body       TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    })().catch((err) => {
      schemaReady = null; // let the next request retry
      throw err;
    });
  }
  return schemaReady;
}

export function resetSchemaCache() {
  schemaReady = null;
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function validToken(token) {
  return typeof token === "string" && token.length >= 24 && token.length <= 128;
}

function cleanUsername(raw) {
  return typeof raw === "string" ? raw.trim() : "";
}

function cleanBody(raw) {
  if (typeof raw !== "string") return "";
  // collapse newlines/control chars into single spaces, trim
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function toMessage(row) {
  return {
    id: Number(row.id),
    username: row.username,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function handleGlobalChat({ method, query = {}, body = {} }, sql) {
  await ensureSchema(sql);

  if (method === "GET") {
    const after = Number.parseInt(query.after, 10);
    let rows;
    if (Number.isFinite(after) && after >= 0) {
      rows = await sql`
        SELECT id, username, body, created_at FROM chat_messages
        WHERE id > ${after} ORDER BY id ASC LIMIT 100`;
    } else {
      rows = await sql`
        SELECT id, username, body, created_at FROM (
          SELECT id, username, body, created_at FROM chat_messages ORDER BY id DESC LIMIT ${PAGE_SIZE}
        ) recent ORDER BY id ASC`;
    }
    return { status: 200, json: { messages: rows.map(toMessage) } };
  }

  if (method !== "POST") {
    return { status: 405, json: { error: "Method not allowed" } };
  }

  const { action, token } = body || {};
  const username = cleanUsername(body?.username);

  if (!validToken(token)) {
    return { status: 400, json: { error: "Missing or invalid session token." } };
  }
  if (!USERNAME_RE.test(username)) {
    return {
      status: 400,
      json: { error: "Username must be 3-20 characters: letters, numbers, dot, dash or underscore." },
    };
  }
  const key = username.toLowerCase();
  const tokenHash = hashToken(token);

  if (action === "register") {
    if (RESERVED.has(key)) {
      return { status: 400, json: { error: "That name is reserved. Please pick another." } };
    }
    const inserted = await sql`
      INSERT INTO chat_users (username_key, username, token_hash)
      VALUES (${key}, ${username}, ${tokenHash})
      ON CONFLICT (username_key) DO NOTHING
      RETURNING username`;
    if (inserted.length > 0) return { status: 200, json: { ok: true, username } };

    // Name already exists -- fine only if it's the same browser re-registering.
    const existing = await sql`SELECT username, token_hash FROM chat_users WHERE username_key = ${key}`;
    if (existing[0]?.token_hash === tokenHash) {
      return { status: 200, json: { ok: true, username: existing[0].username } };
    }
    return { status: 409, json: { error: "That username is already taken. Try another one." } };
  }

  if (action === "send") {
    const text = cleanBody(body?.body);
    if (!text) return { status: 400, json: { error: "Message is empty." } };
    if (text.length > MAX_BODY) {
      return { status: 400, json: { error: `Message too long (max ${MAX_BODY} characters).` } };
    }

    const owner = await sql`SELECT username, token_hash FROM chat_users WHERE username_key = ${key}`;
    if (!owner[0] || owner[0].token_hash !== tokenHash) {
      return { status: 403, json: { error: "This username isn't registered to this browser. Please set your name again." } };
    }

    const recent = await sql`
      SELECT 1 FROM chat_messages
      WHERE username = ${owner[0].username} AND created_at > now() - interval '1 second' LIMIT 1`;
    if (recent.length > 0) {
      return { status: 429, json: { error: "Slow down a little." } };
    }

    const saved = await sql`
      INSERT INTO chat_messages (username, body) VALUES (${owner[0].username}, ${text})
      RETURNING id, username, body, created_at`;

    if (Math.random() < 0.05) {
      // opportunistic pruning, best-effort
      try {
        await sql`DELETE FROM chat_messages WHERE id <= (SELECT COALESCE(MAX(id), 0) - ${KEEP_LAST} FROM chat_messages)`;
      } catch {
        // non-fatal
      }
    }
    return { status: 200, json: { message: toMessage(saved[0]) } };
  }

  return { status: 400, json: { error: "Unknown action." } };
}
