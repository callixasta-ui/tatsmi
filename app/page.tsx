"use client";

import { useEffect, useRef, useState } from "react";
import { processCommand, newState, EngineState } from "@/lib/commands";

const STORAGE_KEY = "gds-trainer-state-v1";

type Line = { text: string; kind: "echo" | "output" | "error" };

const REFERENCE: { section: string; rows: { cmd: string; desc: string }[] }[] = [
  {
    section: "AVAILABILITY & SELL",
    rows: [
      { cmd: "AN15DECLONBKK", desc: "Air availability: 15 Dec, LON to BKK" },
      { cmd: "SS1Y1", desc: "Sell 1 seat, class Y, from availability line 1" },
      { cmd: "SS2M3", desc: "Sell 2 seats, class M, from line 3" },
    ],
  },
  {
    section: "PNR BUILD",
    rows: [
      { cmd: "NM1SMITH/JOHN MR", desc: "Add passenger name (title optional)" },
      { cmd: "AP 66-2-1234567", desc: "Add a contact/phone element" },
      { cmd: "TKOK", desc: "Ticketing arrangement: no time limit" },
      { cmd: "TKTL20DEC/AGT", desc: "Ticketing time limit: 20 Dec, office AGT" },
    ],
  },
  {
    section: "TRANSACT",
    rows: [
      { cmd: "RT", desc: "Redisplay the active (in-progress) PNR" },
      { cmd: "ER", desc: "End transaction and retrieve -> saves PNR, returns a record locator" },
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
    { text: "TYPE  HE  FOR A LIST OF COMMANDS", kind: "output" },
  ]);
  const [input, setInput] = useState("");
  const [engine, setEngine] = useState<EngineState>(() => newState());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load any saved session (command output + PNR state) from localStorage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.lines) setLines(parsed.lines);
        if (parsed.engine) setEngine(parsed.engine);
      }
    } catch {
      // ignore corrupt storage
    }

    // Fire-and-forget device/session logging. See README for what this
    // collects and why, and footer.disclosure below for the on-page note.
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, engine }));
    } catch {
      // storage full or unavailable -- non-fatal
    }
  }, [lines, engine]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  function runCommand(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const echo: Line = { text: `> ${trimmed}`, kind: "echo" };
    const { lines: outLines, state } = processCommand(trimmed, engine);
    const isError = outLines.some((l) => /INVALID|UNKNOWN|NOT FOUND|INCOMPLETE|CLOSED/i.test(l));
    const rendered: Line[] = outLines.map((l) => ({ text: l, kind: isError ? "error" : "output" }));
    setEngine(state);
    setLines((prev) => [...prev, echo, ...rendered]);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    runCommand(input);
    setInput("");
  }

  return (
    <div id="root-wrap" onClick={() => inputRef.current?.focus()}>
      <div className="topbar">
        <span>GDS COMMAND TRAINER v1.0</span>
        <span>SIMULATED DATA -- NOT CONNECTED TO ANY LIVE GDS</span>
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
          <div className="panel-header">INSTRUCTIONS / COMMAND REFERENCE</div>
          <div className="scroll-area">
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
            <div className="instr-section">TYPICAL WORKFLOW</div>
            <div className="instr-desc">
              1. AN15DECLONBKK (see availability){"\n"}
              2. SS1Y1 (sell from a line){"\n"}
              3. NM1SMITH/JOHN MR (add the name){"\n"}
              4. AP 66-2-1234567 (add contact){"\n"}
              5. TKOK (ticketing arrangement){"\n"}
              6. RT (check it before saving){"\n"}
              7. ER (save -- returns a record locator)
            </div>
          </div>
        </section>
      </div>

      <footer className="disclosure">
        Session diagnostics (IP, browser/OS, timezone) are logged for this demo. PNR data stays in your browser's local storage.
      </footer>
    </div>
  );
}
