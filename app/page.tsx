"use client";

import { useEffect, useRef, useState } from "react";
import { processCommand, newState, EngineState, PNR } from "@/lib/commands";
import { PRACTICE_TASKS, PracticeStep } from "@/lib/practice";

const STORAGE_KEY = "gds-trainer-state-v3";

type Line = { text: string; kind: "echo" | "output" | "error" };
type Tab = "practice" | "commands" | "database";

// Matches each step to the earliest history entry that satisfies it and
// hasn't already been claimed by an earlier step -- so if the same exact
// command legitimately repeats across steps (e.g. selling the same class
// on several legs), each occurrence only completes one step, not all of them.
function computeStepDone(steps: PracticeStep[], history: string[]): boolean[] {
  const consumed = new Array(history.length).fill(false);
  return steps.map((step) => {
    for (let i = 0; i < history.length; i++) {
      if (!consumed[i] && step.matcher.test(history[i])) {
        consumed[i] = true;
        return true;
      }
    }
    return false;
  });
}

function pnrRoute(pnr: PNR): string {
  if (pnr.segments.length === 0) return "(no segments)";
  const first = pnr.segments[0];
  const last = pnr.segments[pnr.segments.length - 1];
  return `${first.origin} \u2192 ${last.dest}  (${pnr.segments.length} leg${pnr.segments.length > 1 ? "s" : ""})`;
}

const REFERENCE: { section: string; rows: { cmd: string; desc: string }[] }[] = [
  {
    section: "AVAILABILITY & SELL",
    rows: [
      { cmd: "AN15DECLONBKK", desc: "Air availability: 15 Dec, LON to BKK (SN is an alias)" },
      { cmd: "SS1Y1", desc: "Sell 1 seat, class Y, from availability line 1" },
    ],
  },
  {
    section: "PNR BUILD (5 mandatory before ER)",
    rows: [
      { cmd: "NM1SMITH/JOHN MR", desc: "Add passenger name (title optional)" },
      { cmd: "AP 6621234567", desc: "Phone contact" },
      { cmd: "APM 09171234567", desc: "Mobile contact" },
      { cmd: "APH 021234567", desc: "Home contact" },
      { cmd: "APE john@mail.com", desc: "Email contact (not plain AP)" },
      { cmd: "TKOK / TKTL20JAN/1700", desc: "Ticketing arrangement: no limit / real date+time deadline" },
      { cmd: "RF JDOE", desc: "Received From -- your signature, mandatory" },
    ],
  },
  {
    section: "OPTIONAL ELEMENTS",
    rows: [
      { cmd: "RM VIP PAX", desc: "Free-text remark" },
      { cmd: "OS CTC AT WORK", desc: "Other service info (shows as OSI on the PNR)" },
      { cmd: "FFN BA1234567", desc: "Frequent flyer number" },
      { cmd: "FXP", desc: "Fare quote for every segment in the active PNR" },
      { cmd: "SM / SM2", desc: "Seat map (last segment, or segment n)" },
      { cmd: "ST/24A/P1", desc: "Assign seat 24A to passenger 1" },
    ],
  },
  {
    section: "TRANSACT & FIX MISTAKES",
    rows: [
      { cmd: "RT", desc: "Redisplay the active (in-progress) PNR, elements numbered" },
      { cmd: "XE3", desc: "Cancel element number 3 (from the RT numbering)" },
      { cmd: "ER", desc: "End transaction -- saves PNR, gives a record locator" },
      { cmd: "RT7F3K2Q", desc: "Retrieve a saved PNR by locator (no punctuation)" },
      { cmd: "IG", desc: "Discard the active PNR without saving" },
    ],
  },
  {
    section: "REFERENCE & TRAINER-ONLY",
    rows: [
      { cmd: "DACLON / DAN BANGKOK", desc: "Decode a city code / encode a city name" },
      { cmd: "HE / HE TKTL", desc: "Help list, or help on one entry" },
      { cmd: "CLS", desc: "Clear the screen (trainer convenience, not real Amadeus)" },
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

    if (trimmed.toUpperCase() === "CLS") {
      setLines([{ text: "SCREEN CLEARED", kind: "output" }]);
      setHistory((prev) => [...prev, "CLS"]);
      return;
    }

    const echo: Line = { text: `> ${trimmed}`, kind: "echo" };
    const { lines: outLines, state } = processCommand(trimmed, engine);
    const isError = outLines.some((l) => /INVALID|UNKNOWN|NOT FOUND|INCOMPLETE|CLOSED|NO ELEMENT|NO SEGMENT|NOT VALID|ALREADY OCCUPIED|MISSING/i.test(l));
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

  function clearScreen() {
    runCommand("CLS");
  }

  function resetSession() {
    if (!window.confirm("Reset everything? This clears your PNR, command history, and practice progress. This can't be undone.")) {
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setLines([
      { text: "GDS COMMAND TRAINER -- SIMULATED, LEARNING PURPOSES ONLY", kind: "output" },
      { text: "TYPE  HE  FOR COMMANDS, OR OPEN THE PRACTICE TAB BELOW FOR GUIDED TASKS", kind: "output" },
    ]);
    setEngine(newState());
    setHistory([]);
    setRevealed({});
    setInput("");
  }

  function toggleHint(key: string) {
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function retrieveFromDashboard(locator: string) {
    setTab("commands");
    runCommand(`RT${locator}`);
    inputRef.current?.focus();
  }

  function deleteFromDashboard(locator: string) {
    if (!window.confirm(`Remove saved PNR ${locator}? This only removes it from the Database view -- it's a dashboard action, not a real Amadeus entry.`)) {
      return;
    }
    setEngine((prev) => {
      const next = { ...prev, savedPNRs: { ...prev.savedPNRs } };
      delete next.savedPNRs[locator];
      return next;
    });
  }

  const savedList = Object.values(engine.savedPNRs).sort((a, b) => (a.locator! > b.locator! ? 1 : -1));
  const totalPax = savedList.reduce((sum, p) => sum + p.names.length, 0);
  const withDeadline = savedList.filter((p) => p.ticketing?.startsWith("TKTL")).length;

  return (
    <div id="root-wrap" onClick={(e) => {
      if ((e.target as HTMLElement).closest(".scroll-area, button, .modal")) return;
      inputRef.current?.focus();
    }}>
      <div className="topbar">
        <span>GDS COMMAND TRAINER v1.2</span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span>SIMULATED DATA -- NOT CONNECTED TO ANY LIVE GDS</span>
          <button className="privacy-link" onClick={resetSession} title="Wipe PNR, history, and practice progress">
            ↺ Reset Session
          </button>
          <button className="privacy-link" onClick={() => setPrivacyOpen(true)}>
            🔒 Your Privacy
          </button>
        </div>
      </div>

      <div className="panels">
        <section className="panel cli-panel">
          <div className="panel-header cli-header">
            <span>CLI</span>
            <button className="clear-btn" onClick={clearScreen} title="Clear screen (CLS) -- keeps your PNR and progress">
              Clear screen
            </button>
          </div>
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
            <button className={tab === "database" ? "tab active" : "tab"} onClick={() => setTab("database")}>
              DATABASE
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
                  Work through these roughly in order -- 1&ndash;6 build up the individual commands, 7&ndash;9 are one
                  real work order end to end. Each step checks itself off once you type it correctly. Stuck? Tap
                  "Show hint" for the exact command.
                </div>
                {PRACTICE_TASKS.map((task) => {
                  const doneFlags = computeStepDone(task.steps, history);
                  const complete = doneFlags.every(Boolean);
                  return (
                    <div className="task-card" key={task.id}>
                      <div className="task-title">
                        {task.title} {complete && <span className="task-done">✓ DONE</span>}
                      </div>
                      <div className="task-goal">{task.goal}</div>
                      {task.steps.map((step, i) => {
                        const stepDone = doneFlags[i];
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

            {tab === "database" && (
              <>
                <div className="practice-intro">
                  Every PNR you've saved with ER, stored only in this browser's local storage. Nothing here has ever
                  been sent to a server.
                </div>
                <div className="db-stats">
                  <div className="db-stat"><span className="db-stat-num">{savedList.length}</span>bookings</div>
                  <div className="db-stat"><span className="db-stat-num">{totalPax}</span>passengers</div>
                  <div className="db-stat"><span className="db-stat-num">{withDeadline}</span>with a deadline</div>
                </div>
                {savedList.length === 0 && (
                  <div className="task-goal" style={{ marginTop: 10 }}>
                    No saved bookings yet -- build one in the CLI and finish with ER.
                  </div>
                )}
                {savedList.map((pnr) => (
                  <div className="task-card" key={pnr.locator}>
                    <div className="task-title">{pnr.locator}</div>
                    <div className="db-row">{pnr.names.map((n) => `${n.last}/${n.first}`).join(", ") || "(no names)"}</div>
                    <div className="db-row db-dim">{pnrRoute(pnr)}</div>
                    <div className="db-row db-dim">{pnr.ticketing ?? "no ticketing arrangement"} &middot; RF {pnr.receivedFrom ?? "--"}</div>
                    <div className="db-actions">
                      <button className="hint-btn" onClick={() => retrieveFromDashboard(pnr.locator!)}>View / Retrieve</button>
                      <button className="hint-btn db-delete" onClick={() => deleteFromDashboard(pnr.locator!)}>Delete</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>
      </div>

      <footer className="disclosure">
        Everything here -- your PNR, saved bookings, and practice progress -- lives only in this browser's local
        storage. Nothing about your bookings is ever sent anywhere. Tap "Your Privacy" above for the full picture,
        including what happens if you use the chat helper.
      </footer>

      {privacyOpen && (
        <div className="modal-backdrop" onClick={() => setPrivacyOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Your Privacy, Explained Plainly</div>
            <div className="modal-body">
              <p>This trainer was built just for you to practice on, so here's exactly what happens with your data:</p>
              <p><strong>Everything stays on your device:</strong> every command you type, every PNR you build or save, and your practice progress. It all lives in this browser's local storage and is never sent to any server, ever.</p>
              <p><strong>The one exception -- the chat helper:</strong> if you use the "GDS Study Buddy" chat bubble, whatever you type there is sent through this site's server to Google's Gemini API to generate a reply. That's the only data that ever leaves your browser, and only when you choose to use it.</p>
              <p><strong>Why:</strong> so you can practice, make mistakes, and get help without worrying about any of it being tracked, sold, or used against you. This space is yours.</p>
            </div>
            <button className="modal-close" onClick={() => setPrivacyOpen(false)}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
