// Core Gemini proxy logic, shared between the Vercel serverless function
// (api/chat.js) and the local Express server (server.js). This is what
// keeps your GEMINI_API_KEY on the server and out of the browser.

export async function handleChatRequest(body, { apiKey, model }) {
  if (!apiKey) {
    return { status: 500, json: { error: 'API key not configured' } };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const message = response.status === 429
        ? '429 Too Many Requests'
        : data?.error?.message || 'Gemini error';
      return { status: response.status, json: { error: message } };
    }

    return { status: 200, json: data };
  } catch (err) {
    return { status: 500, json: { error: 'Server error: ' + err.message } };
  }
}

export const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
