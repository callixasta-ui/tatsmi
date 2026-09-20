"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const NAME_KEY = "gds-globalchat-username";
const TOKEN_KEY = "gds-globalchat-token";
const POLL_MS = 3000;
const MAX_LEN = 500;

interface ChatMessage {
  id: number;
  username: string;
  body: string;
  createdAt: string;
}

function makeToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function GlobalChat() {
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [setupError, setSetupError] = useState("");
  const [joining, setJoining] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState("");
  const [connError, setConnError] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);
  const stickToBottom = useRef(true);

  // One-time identity: read what this browser already registered (if anything).
  useEffect(() => {
    try {
      let t = localStorage.getItem(TOKEN_KEY);
      if (!t) {
        t = makeToken();
        localStorage.setItem(TOKEN_KEY, t);
      }
      setToken(t);
      setUsername(localStorage.getItem(NAME_KEY));
    } catch {
      setToken(makeToken()); // storage blocked -- works for this visit only
    }
    setReady(true);
  }, []);

  const mergeMessages = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      if (fresh.length === 0) return prev;
      const next = [...prev, ...fresh].sort((a, b) => a.id - b.id);
      lastIdRef.current = next[next.length - 1].id;
      return next;
    });
  }, []);

  // Everyone can read; only registered names can post. Poll while the tab is
  // open and the page is visible.
  useEffect(() => {
    if (!ready || !username) return;
    let cancelled = false;

    async function poll() {
      if (document.hidden) return;
      try {
        const url = lastIdRef.current > 0 ? `/api/global-chat?after=${lastIdRef.current}` : "/api/global-chat";
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setConnError(data?.error || "Can't reach the chat server right now.");
          return;
        }
        setConnError("");
        mergeMessages(data.messages || []);
      } catch {
        if (!cancelled) setConnError("Can't reach the chat server right now. Retrying...");
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ready, username, mergeMessages]);

  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onListScroll() {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    const name = nameDraft.trim();
    if (!name || joining) return;
    setJoining(true);
    setSetupError("");
    try {
      const res = await fetch("/api/global-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", username: name, token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSetupError(data?.error || "Couldn't set your name. Try again.");
        return;
      }
      try {
        localStorage.setItem(NAME_KEY, data.username);
        localStorage.setItem(TOKEN_KEY, token);
      } catch {
        // non-fatal
      }
      setUsername(data.username);
    } catch {
      setSetupError("Can't reach the chat server right now.");
    } finally {
      setJoining(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending || !username) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/global-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", username, token, body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        // Name isn't registered to this browser (e.g. the database was reset).
        try {
          localStorage.removeItem(NAME_KEY);
        } catch {
          // ignore
        }
        setUsername(null);
        setSetupError(data?.error || "Please set your name again.");
        return;
      }
      if (!res.ok) {
        setSendError(data?.error || "Message didn't send. Try again.");
        return;
      }
      setDraft("");
      stickToBottom.current = true;
      mergeMessages([data.message]);
    } catch {
      setSendError("Can't reach the chat server right now.");
    } finally {
      setSending(false);
    }
  }

  if (!ready) return <div className="gc-wrap" />;

  if (!username) {
    return (
      <div className="gc-wrap">
        <form className="gc-setup" onSubmit={join}>
          <div className="gc-setup-title">Welcome to Global Chat</div>
          <p className="gc-setup-text">
            Everyone using the trainer shares this room. Pick the name others will see next to your messages. You only do
            this once on this browser, and it can&apos;t be used by anyone else.
          </p>
          <input
            className="gc-input"
            value={nameDraft}
            autoFocus
            maxLength={20}
            placeholder="e.g. agent_jane"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setNameDraft(e.target.value)}
          />
          <div className="gc-hint">3-20 characters: letters, numbers, dot, dash, underscore.</div>
          {setupError && <div className="gc-error">{setupError}</div>}
          <button type="submit" className="modal-close" disabled={joining || nameDraft.trim().length < 3}>
            {joining ? "Saving..." : "Join chat"}
          </button>
          <div className="gc-hint">
            Messages here are public and stored on a server, unlike your PNRs. Don&apos;t share personal details.
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="gc-wrap">
      <div className="gc-status">
        <span>
          GLOBAL CHAT &middot; you are <strong>{username}</strong>
        </span>
        <span className="gc-public">public room</span>
      </div>
      {connError && <div className="gc-error gc-conn">{connError}</div>}
      <div className="gc-list" ref={listRef} onScroll={onListScroll}>
        {messages.length === 0 && !connError && <div className="gc-empty">No messages yet. Say hi!</div>}
        {messages.map((m) => (
          <div className={m.username === username ? "gc-msg gc-mine" : "gc-msg"} key={m.id}>
            <div className="gc-meta">
              <span className="gc-user">{m.username}</span>
              <span className="gc-time">{fmtTime(m.createdAt)}</span>
            </div>
            <div className="gc-body">{m.body}</div>
          </div>
        ))}
      </div>
      {sendError && <div className="gc-error">{sendError}</div>}
      <form className="gc-form" onSubmit={send}>
        <input
          className="gc-input"
          value={draft}
          maxLength={MAX_LEN}
          autoComplete="off"
          placeholder="Message everyone..."
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="modal-close" disabled={sending || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
