import { handleChatRequest, DEFAULT_MODEL } from "../../lib/chat-handler.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const { status, json } = await handleChatRequest(req.body, { apiKey, model });
  return res.status(status).json(json);
}
