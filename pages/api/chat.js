import { handleChatRequest } from "../../lib/chat-handler.js";

// Allow time for falling back across several models, and allow image/PDF
// attachments (Vercel's hard request limit is ~4.5 MB; the widget stays under it).
export const config = {
  maxDuration: 30,
  api: { bodyParser: { sizeLimit: "4.5mb" } },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { status, json } = await handleChatRequest(req.body, {
    apiKey: process.env.GEMINI_API_KEY,
    models: process.env.GEMINI_MODELS, // e.g. "gemini-3.1-flash-lite,gemini-3.5-flash"
    model: process.env.GEMINI_MODEL,   // legacy single-model setting still honoured
  });
  return res.status(status).json(json);
}
