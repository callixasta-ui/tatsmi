import { neon } from "@neondatabase/serverless";
import { handleGlobalChat } from "../../lib/global-chat-handler.js";

let sql;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return res.status(503).json({ error: "Global chat isn't set up yet (DATABASE_URL is missing on the server)." });
  }

  try {
    sql = sql || neon(connectionString);
    const { status, json } = await handleGlobalChat(
      { method: req.method, query: req.query, body: req.body },
      sql
    );
    return res.status(status).json(json);
  } catch (err) {
    console.error("global-chat error:", err);
    return res.status(500).json({ error: "Chat server error. Please try again in a moment." });
  }
}
