"use client";

import { useEffect, useRef, useState } from "react";
import { processCommand, newState, EngineState } from "@/lib/commands";
import { PRACTICE_TASKS } from "@/lib/practice";

const STORAGE_KEY = "gds-trainer-state-v2";

type Line = { text: string; kind: "echo" | "output" | "error" };
type Tab = "commands" | "practice";

const REFERENCE: { section: string; rows: { cmd: string; desc: string }[] }[] = [
  {
    section: "AVAILABILITY & SELL",
    rows: [
      { cmd: "AN15DECLONBKK", desc: "Air availability: 15 Dec, LON to BKK" },
      { cmd: "SS1Y1", desc: "Sell 1 seat, class Y, from availability line 1" },
    ],
  },
  {
    section: "PNR BUILD",
    rows: [
      { cmd: "NM1SMITH/JOHN MR", desc: "Add passenger name (title optional)" },
      { cmd: "AP 66-2-1234567", desc: "Add a contact/phone element" },
      { cmd: "RM VIP PAX", desc: "Add a free-text remark" },
      { cmd: "OSI CTCT AT WORK", desc: "Add other supplementary info" },
      { cmd: "FQN BA1234567", desc: "Add a frequent flyer number" },
      { cmd: "TKOK / TKTL20DEC/AGT", desc: "Ticketing arrangement (no limit / time limit)" },
    ],
  },
  {
    section: "PRICE & SEATS",
    rows: [
      { cmd: "FXP", desc: "Fare quote for every segment in the active PNR" },
      { cmd: "SM", desc: "Seat map for the most recently sold segment" },
    ],
  },
  {
    section: "TRANSACT & FIX MISTAKES",
    rows: [
      { cmd: "RT", desc: "Redisplay the active (in-progress) PNR" },
      { cmd: "XE3", desc: "Cancel element number 3 (from the RT numbering)" },
      { cmd: "ER", desc: "End transaction and retrieve -> saves PNR, gives a record locator" },
      { cmd: "RT*ABC123", desc: "Retrieve a previously saved PNR by locator" },
      { cmd: "IG", desc: "Ignore / discard the active PNR without saving" },
    ],
  },
  {
    section: "REFERENCE",
    rows: [
      { cmd: "DACLON", desc: "Decode a city code (small built-in demo table)" },
      { cmd: "HE", desc: "Show the in-app help / command list" },
    ],
  },
];

export default function Page() {
  const [lines, setLines] = useState<Line[]>([
    { text: "GDS COMMAND TRAINER -- SIMULATED, LEARNING PURPOSES ONLY", kind: "output" },
    { text: "TYPE  HE  FOR COMMANDS, OR OPEN THE PRACTICE TAB BELOW FOR GUIDED TASKS", kind: "output" },
  ]);
  const [input, setInput] = useState("");
  const [engine, setEngine] = useState<EngineState>(() => newState());
  const [history, setHistory] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("practice");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.lines) setLines(parsed.lines);
        if (parsed.engine) setEngine(parsed.engine);
        if (parsed.history) setHistory(parsed.history);
        if (parsed.revealed) setRevealed(parsed.revealed);
      }
    } catch {
      // ignore corrupt storage
    }

    try {
      fetch("/api/log-visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          screen: `${window.screen.width}x${window.screen.height}`,
          language: navigator.language,
        }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, engine, history, revealed }));
    } catch {
      // storage full or unavailable -- non-fatal
    }
  }, [lines, engine, history, revealed]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  function runCommand(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const echo: Line = { text: `> ${trimmed}`, kind: "echo" };
    const { lines: outLines, state } = processCommand(trimmed, engine);
    const isError = outLines.some((l) => /INVALID|UNKNOWN|NOT FOUND|INCOMPLETE|CLOSED|NO ELEMENT|NO SEGMENTS|NO SEGMENT/i.test(l));
    const rendered: Line[] = outLines.map((l) => ({ text: l, kind: isError ? "error" : "output" }));
    setEngine(state);
    setLines((prev) => [...prev, echo, ...rendered]);
    setHistory((prev) => [...prev, trimmed.toUpperCase()]);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    runCommand(input);
    setInput("");
  }

  function toggleHint(key: string) {
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div id="root-wrap" onClick={(e) => {
      if ((e.target as HTMLElement).closest(".scroll-area, button, .modal")) return;
      inputRef.current?.focus();
    }}>
      <div className="topbar">
        <span>GDS COMMAND TRAINER v1.1</span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span>SIMULATED DATA -- NOT CONNECTED TO ANY LIVE GDS</span>
          <button className="privacy-link" onClick={() => setPrivacyOpen(true)}>
            🔒 Your Privacy
          </button>
        </div>
      </div>

      <div className="panels">
        <section className="panel cli-panel">
          <div className="panel-header">CLI</div>
          <div className="scroll-area" ref={scrollRef}>
            {lines.map((l, i) => (
              <div key={i} className={`cli-line ${l.kind}`}>
                {l.text}
              </div>
            ))}
          </div>
          <form className="input-row" onSubmit={onSubmit}>
            <span className="prompt">&gt;</span>
            <input
              ref={inputRef}
              className="cli-input"
              value={input}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. AN15DECLONBKK"
            />
          </form>
        </section>

        <section className="panel instructions-panel">
          <div className="panel-header tabs">
            <button className={tab === "practice" ? "tab active" : "tab"} onClick={() => setTab("practice")}>
              PRACTICE TASKS
            </button>
            <button className={tab === "commands" ? "tab active" : "tab"} onClick={() => setTab("commands")}>
              COMMAND LIST
            </button>
          </div>
          <div className="scroll-area">
            {tab === "commands" && (
              <>
                {REFERENCE.map((block) => (
                  <div key={block.section}>
                    <div className="instr-section">{block.section}</div>
                    {block.rows.map((row) => (
                      <div className="instr-row" key={row.cmd}>
                        <span className="instr-cmd">{row.cmd}</span>
                        <div className="instr-desc">{row.desc}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}

            {tab === "practice" && (
              <>
                <div className="practice-intro">
                  Work through these in order. Type the commands into the CLI on the left -- each
                  step checks itself off automatically once you get it right. Stuck? Tap "Show hint"
                  for the exact command.
                </div>
                {PRACTICE_TASKS.map((task) => {
                  const doneCount = task.steps.filter((st) => history.some((h) => st.matcher.test(h))).length;
                  const complete = doneCount === task.steps.length;
                  return (
                    <div className="task-card" key={task.id}>
                      <div className="task-title">
                        {task.title} {complete && <span className="task-done">✓ DONE</span>}
                      </div>
                      <div className="task-goal">{task.goal}</div>
                      {task.steps.map((step, i) => {
                        const stepDone = history.some((h) => step.matcher.test(h));
                        const key = `${task.id}-${i}`;
                        return (
                          <div className={stepDone ? "step-row step-done" : "step-row"} key={key}>
                            <span className="step-check">{stepDone ? "☑" : "☐"}</span>
                            <div className="step-body">
                              <div>{step.instruction}</div>
                              {!stepDone && (
                                <button className="hint-btn" onClick={() => toggleHint(key)}>
                                  {revealed[key] ? "Hide hint" : "Show hint"}
                                </button>
                              )}
                              {revealed[key] && !stepDone && <div className="hint-text">{step.hint}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </section>
      </div>

      <footer className="disclosure">
        Session diagnostics (general device/browser info) are logged for this demo. PNR data and your
        progress stay in your browser's local storage. Tap "Your Privacy" above for details.
      </footer>

      {privacyOpen && (
        <div className="modal-backdrop" onClick={() => setPrivacyOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Your Privacy, Explained Plainly</div>
            <div className="modal-body">
              <p>This little trainer was built just for you to practice on, so here's exactly what happens with your data:</p>
              <p><strong>What stays on your device, always:</strong> everything you type, every PNR you build, and your practice progress. It lives in your browser's local storage and is never sent anywhere.</p>
              <p><strong>What gets logged:</strong> basic technical details when you open the page -- things like your browser, operating system, rough timezone, and IP address. That's it. No names, no accounts, no tracking across other sites.</p>
              <p><strong>Why:</strong> only so the person who built this can see it's actually being used and make it better for you. Nothing here is sold, shared, or used against you in any way.</p>
              <p>This space is yours to practice in without worrying. If anything about that ever changes, you'll be told.</p>
            </div>
            <button className="modal-close" onClick={() => setPrivacyOpen(false)}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
