"use client";

import { useEffect, useRef, useState } from "react";
import { processCommand, newState, normalizeState, pnrHasContent, WORK_AREAS, EngineState, PNR } from "@/lib/commands";
import { PRACTICE_TASKS, PracticeStep } from "@/lib/practice";
import { FLASHCARDS } from "@/lib/flashcards";
import { QUIZ_LEVELS } from "@/lib/quiz";
import { drawBadge, downloadCanvasPng } from "@/lib/badge";
import GlobalChat from "./GlobalChat";

const STORAGE_KEY = "gds-trainer-state-v3";

type Line = { text: string; kind: "echo" | "output" | "error" };
type Tab = "practice" | "commands" | "flashcards" | "quiz" | "database" | "chat";

interface QuizResult {
  score: number;
  total: number;
  passed: boolean;
}

interface ActiveQuiz {
  levelId: string;
  qIndex: number;
  selected: number | null;
  submitted: boolean;
  correctCount: number;
  finished: boolean;
}

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
      { cmd: "SM / SM2", desc: "Seat map (last segment, or segment n)" },
      { cmd: "ST/24A/P1", desc: "Assign seat 24A to passenger 1" },
    ],
  },
  {
    section: "TRANSACT & FIX MISTAKES",
    rows: [
      { cmd: "RT", desc: "Redisplay the active (in-progress) PNR, elements numbered" },
      { cmd: "XE3", desc: "Cancel element number 3 (from the RT numbering)" },
      { cmd: "ER", desc: "End & redisplay -- saves the PNR, gives a record locator, PNR stays open on screen" },
      { cmd: "ET", desc: "End transaction -- saves the PNR, then clears the area for the next booking" },
      { cmd: "RT7F3K2Q", desc: "Retrieve a saved PNR by locator (no punctuation)" },
      { cmd: "IG", desc: "Discard the active PNR without saving" },
    ],
  },
  {
    section: "PRICE, PAY & ISSUE THE TICKET (needs a SAVED PNR)",
    rows: [
      { cmd: "FXP", desc: "Fare quote for the active PNR -- stores the price as a TST (T01, T02...)" },
      { cmd: "FP CASH", desc: "Form of payment -- cash (or FP CHEQUE)" },
      { cmd: "FP CCVI4444333322221111/0128", desc: "Form of payment -- credit card (2-letter vendor + number + MMYY)" },
      { cmd: "TTP", desc: "Issue the ticket(s), using the TST + FP on file -- this is what actually produces a ticket number, unlike TKOK/TKTL" },
    ],
  },
  {
    section: "WORK AREAS (SEVERAL BOOKINGS AT ONCE)",
    rows: [
      { cmd: "JB", desc: "Jump to work area B (JA-JF). Each area keeps its own PNR in progress" },
      { cmd: "JO", desc: "Show which areas are empty, in progress, or holding a saved PNR" },
    ],
  },
  {
    section: "REFERENCE & TRAINER-ONLY",
    rows: [
      { cmd: "DACLON / DAN BANGKOK", desc: "Decode a city code / encode a city name" },
      { cmd: "FQC100USD/PHP", desc: "Currency conversion (BSR) -- FQC100USD converts to the office currency (USD) if no second currency is given" },
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
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [quizResults, setQuizResults] = useState<Record<string, QuizResult>>({});
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz | null>(null);
  const [userName, setUserName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [badgeLevelId, setBadgeLevelId] = useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const badgeCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.lines) setLines(parsed.lines);
        if (parsed.engine) setEngine(normalizeState(parsed.engine));
        if (parsed.history) setHistory(parsed.history);
        if (parsed.revealed) setRevealed(parsed.revealed);
        if (parsed.quizResults) setQuizResults(parsed.quizResults);
        if (parsed.userName) setUserName(parsed.userName);
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ lines, engine, history, revealed, quizResults, userName })
      );
    } catch {
      // storage full or unavailable -- non-fatal
    }
  }, [lines, engine, history, revealed, quizResults, userName]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  useEffect(() => {
    if (!badgeLevelId || !userName || editingName) return;
    const canvas = badgeCanvasRef.current;
    if (!canvas) return;
    const level = QUIZ_LEVELS.find((l) => l.id === badgeLevelId);
    if (!level) return;
    drawBadge(canvas, {
      name: userName,
      levelOrder: level.order,
      levelTitle: level.title,
      dateEarned: new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
    });
  }, [badgeLevelId, userName, editingName]);

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
    if (!window.confirm("Reset everything? This clears your PNR, command history, practice progress, and quiz/badge progress. This can't be undone.")) {
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
    setQuizResults({});
    setActiveQuiz(null);
    setUserName("");
    setBadgeLevelId(null);
  }

  function toggleHint(key: string) {
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleFlip(key: string) {
    setFlipped((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function isLevelUnlocked(level: (typeof QUIZ_LEVELS)[number]): boolean {
    if (level.order === 1) return true;
    const prevLevel = QUIZ_LEVELS.find((l) => l.order === level.order - 1);
    return !!(prevLevel && quizResults[prevLevel.id]?.passed);
  }

  function startQuiz(levelId: string) {
    setActiveQuiz({ levelId, qIndex: 0, selected: null, submitted: false, correctCount: 0, finished: false });
  }

  function selectOption(idx: number) {
    setActiveQuiz((prev) => (prev && !prev.submitted ? { ...prev, selected: idx } : prev));
  }

  function checkAnswer() {
    setActiveQuiz((prev) => {
      if (!prev || prev.selected === null || prev.submitted) return prev;
      const level = QUIZ_LEVELS.find((l) => l.id === prev.levelId);
      if (!level) return prev;
      const q = level.questions[prev.qIndex];
      const correct = prev.selected === q.correctIndex;
      return { ...prev, submitted: true, correctCount: prev.correctCount + (correct ? 1 : 0) };
    });
  }

  function nextQuestion() {
    setActiveQuiz((prev) => {
      if (!prev) return prev;
      const level = QUIZ_LEVELS.find((l) => l.id === prev.levelId);
      if (!level) return prev;
      const isLast = prev.qIndex >= level.questions.length - 1;
      if (isLast) {
        const total = level.questions.length;
        const passedNow = prev.correctCount / total >= level.passFraction;
        setQuizResults((results) => {
          const existing = results[level.id];
          return {
            ...results,
            [level.id]: {
              score: Math.max(existing?.score ?? 0, prev.correctCount),
              total,
              passed: !!existing?.passed || passedNow,
            },
          };
        });
        return { ...prev, finished: true };
      }
      return { ...prev, qIndex: prev.qIndex + 1, selected: null, submitted: false };
    });
  }

  function exitQuiz() {
    setActiveQuiz(null);
  }

  function openBadge(levelId: string) {
    setNameDraft(userName);
    setEditingName(!userName);
    setBadgeLevelId(levelId);
  }

  function closeBadge() {
    setBadgeLevelId(null);
    setEditingName(false);
  }

  function saveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setUserName(trimmed);
    setEditingName(false);
  }

  function downloadBadge() {
    const canvas = badgeCanvasRef.current;
    const level = QUIZ_LEVELS.find((l) => l.id === badgeLevelId);
    if (!canvas || !level) return;
    downloadCanvasPng(canvas, `gds-trainer-level${level.order}-badge.png`);
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
  const ticketed = savedList.filter((p) => p.tickets && p.tickets.length > 0).length;

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
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div className="area-chips" title="Work areas: each holds its own booking in progress. Green = has a PNR.">
                <span className="area-chips-label">AREA</span>
                {WORK_AREAS.map((a) => {
                  const pnr = a === engine.area ? engine.activePNR : engine.parked?.[a]?.activePNR;
                  const used = !!pnr && pnrHasContent(pnr);
                  const cls = "area-chip" + (a === engine.area ? " on" : used ? " used" : "");
                  return (
                    <button
                      key={a}
                      type="button"
                      className={cls}
                      onClick={() => a !== engine.area && runCommand(`J${a}`)}
                      title={a === engine.area ? `Area ${a} (current)` : `Jump to area ${a} (J${a})`}
                    >
                      {a}
                    </button>
                  );
                })}
              </div>
              <button className="clear-btn" onClick={clearScreen} title="Clear screen (CLS) -- keeps your PNR and progress">
                Clear screen
              </button>
            </div>
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
            <button className={tab === "flashcards" ? "tab active" : "tab"} onClick={() => setTab("flashcards")}>
              FLASHCARDS
            </button>
            <button className={tab === "quiz" ? "tab active" : "tab"} onClick={() => setTab("quiz")}>
              QUIZ
            </button>
            <button className={tab === "database" ? "tab active" : "tab"} onClick={() => setTab("database")}>
              DATABASE
            </button>
            <button className={tab === "chat" ? "tab active" : "tab"} onClick={() => setTab("chat")}>
              GLOBAL CHAT
            </button>
          </div>
          <div className={tab === "chat" ? "scroll-area chat-mode" : "scroll-area"}>
            {tab === "chat" && <GlobalChat />}

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

            {tab === "flashcards" && (
              <>
                <div className="practice-intro">
                  Tap a card to flip it. Front: the entry code and what it means. Back: when to use it, a full
                  worked command, and a token-by-token breakdown of that command.
                </div>
                {FLASHCARDS.map((block) => (
                  <div key={block.section}>
                    <div className="instr-section">{block.section}</div>
                    <div className="flash-grid">
                      {block.cards.map((card) => {
                        const key = `${block.section}-${card.code}`;
                        const isFlipped = !!flipped[key];
                        return (
                          <button
                            type="button"
                            className={isFlipped ? "flash-card is-flipped" : "flash-card"}
                            key={key}
                            onClick={() => toggleFlip(key)}
                            aria-label={`Flashcard for ${card.code}, tap to flip`}
                          >
                            <div className="flash-card-inner">
                              <div className="flash-face flash-front">
                                <div className="flash-code">{card.code}</div>
                                <div className="flash-meaning">{card.meaning}</div>
                                <div className="flash-tap-hint">tap to flip</div>
                              </div>
                              <div className="flash-face flash-back">
                                <div className="flash-back-label">WHEN TO USE</div>
                                <div className="flash-when">{card.whenToUse}</div>
                                <div className="flash-back-label">FULL COMMAND</div>
                                <div className="flash-full-cmd">{card.fullCommand}</div>
                                <div className="flash-back-label">DISSECTION</div>
                                <div className="flash-dissection">
                                  {card.dissection.map((d, i) => (
                                    <div className="flash-dissect-row" key={i}>
                                      <span className="flash-dissect-part">{d.part}</span>
                                      <span className="flash-dissect-desc">{d.desc}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}

            {tab === "quiz" && (
              <>
                {!activeQuiz && (
                  <>
                    <div className="practice-intro">
                      Five leveled quizzes, one per command group. Pass a level (70%+) to unlock the next one and
                      earn a downloadable badge with your name on it.
                    </div>
                    {QUIZ_LEVELS.map((level) => {
                      const unlocked = isLevelUnlocked(level);
                      const result = quizResults[level.id];
                      return (
                        <div
                          className={unlocked ? "task-card level-card" : "task-card level-card level-locked"}
                          key={level.id}
                        >
                          <div className="task-title">
                            LEVEL {level.order}: {level.title}
                            {result?.passed && <span className="task-done">✓ PASSED</span>}
                          </div>
                          <div className="task-goal">{level.tagline}</div>
                          {result && (
                            <div className="level-score">
                              Best score: {result.score}/{result.total}
                            </div>
                          )}
                          <div className="level-actions">
                            {unlocked ? (
                              <button className="hint-btn" onClick={() => startQuiz(level.id)}>
                                {result ? "Retake quiz" : "Start quiz"}
                              </button>
                            ) : (
                              <span className="level-lock-note">🔒 Pass level {level.order - 1} to unlock</span>
                            )}
                            {result?.passed && (
                              <button className="hint-btn" onClick={() => openBadge(level.id)}>
                                🏅 View / download badge
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {activeQuiz &&
                  !activeQuiz.finished &&
                  (() => {
                    const level = QUIZ_LEVELS.find((l) => l.id === activeQuiz.levelId)!;
                    const q = level.questions[activeQuiz.qIndex];
                    return (
                      <div className="task-card">
                        <div className="task-title">
                          LEVEL {level.order}: {level.title} -- Q{activeQuiz.qIndex + 1}/{level.questions.length}
                        </div>
                        <div className="quiz-progress-track">
                          <div
                            className="quiz-progress-fill"
                            style={{
                              width: `${((activeQuiz.qIndex + (activeQuiz.submitted ? 1 : 0)) / level.questions.length) * 100}%`,
                            }}
                          />
                        </div>
                        <div className="quiz-prompt">{q.prompt}</div>
                        <div className="quiz-options">
                          {q.options.map((opt, i) => {
                            let cls = "option-btn";
                            if (activeQuiz.submitted) {
                              if (i === q.correctIndex) cls += " option-correct";
                              else if (i === activeQuiz.selected) cls += " option-incorrect";
                            } else if (i === activeQuiz.selected) {
                              cls += " option-selected";
                            }
                            return (
                              <button
                                type="button"
                                className={cls}
                                key={i}
                                disabled={activeQuiz.submitted}
                                onClick={() => selectOption(i)}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                        {activeQuiz.submitted && (
                          <div
                            className={
                              activeQuiz.selected === q.correctIndex
                                ? "quiz-feedback quiz-feedback-correct"
                                : "quiz-feedback quiz-feedback-incorrect"
                            }
                          >
                            {activeQuiz.selected === q.correctIndex ? "Correct. " : "Not quite. "}
                            {q.explanation}
                          </div>
                        )}
                        <div className="level-actions">
                          <button className="hint-btn" onClick={exitQuiz}>
                            Exit quiz
                          </button>
                          {!activeQuiz.submitted ? (
                            <button className="hint-btn" disabled={activeQuiz.selected === null} onClick={checkAnswer}>
                              Check answer
                            </button>
                          ) : (
                            <button className="hint-btn" onClick={nextQuestion}>
                              {activeQuiz.qIndex + 1 >= level.questions.length ? "See results" : "Next question"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                {activeQuiz &&
                  activeQuiz.finished &&
                  (() => {
                    const level = QUIZ_LEVELS.find((l) => l.id === activeQuiz.levelId)!;
                    const total = level.questions.length;
                    const passed = activeQuiz.correctCount / total >= level.passFraction;
                    return (
                      <div className="task-card">
                        <div className="task-title">
                          LEVEL {level.order}: {level.title} -- Result
                        </div>
                        <div className="quiz-result-score">
                          {activeQuiz.correctCount}/{total}
                        </div>
                        <div className={passed ? "quiz-result-verdict quiz-result-pass" : "quiz-result-verdict quiz-result-fail"}>
                          {passed ? "PASSED -- badge unlocked!" : "NOT YET -- try again"}
                        </div>
                        <div className="level-actions">
                          <button className="hint-btn" onClick={exitQuiz}>
                            Back to levels
                          </button>
                          <button className="hint-btn" onClick={() => startQuiz(level.id)}>
                            Retake quiz
                          </button>
                          {passed && (
                            <button
                              className="hint-btn"
                              onClick={() => {
                                setActiveQuiz(null);
                                openBadge(level.id);
                              }}
                            >
                              🏅 Claim badge
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
              </>
            )}

            {tab === "practice" && (
              <>
                <div className="practice-intro">
                  Work through these roughly in order -- 1&ndash;6 build up the individual commands, 7&ndash;9 are one
                  real work order end to end, and 10 shows how to juggle several bookings with work areas. Each step checks itself off once you type it correctly. Stuck? Tap
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
                  <div className="db-stat"><span className="db-stat-num">{ticketed}</span>ticketed</div>
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
                    {pnr.tickets && pnr.tickets.length > 0 ? (
                      <div className="db-row db-dim">
                        TICKETED: {pnr.tickets.map((t) => `${t.number} (${t.passenger})`).join(", ")}
                      </div>
                    ) : (
                      <div className="db-row db-dim">
                        {pnr.tst && pnr.tst.some((t) => !t.used) ? "PRICED (FXP) - NOT YET TICKETED" : "NOT PRICED / NOT TICKETED"}
                      </div>
                    )}
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
        including the two features that do use a server: the chat helper and Global Chat.
      </footer>

      {badgeLevelId && (() => {
        const level = QUIZ_LEVELS.find((l) => l.id === badgeLevelId);
        if (!level) return null;
        return (
          <div className="modal-backdrop" onClick={closeBadge}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">Level {level.order} Badge</div>

              {editingName ? (
                <form className="badge-name-form" onSubmit={saveName}>
                  <p className="modal-body" style={{ marginBottom: 8 }}>
                    Enter the name you'd like printed on the badge:
                  </p>
                  <input
                    className="badge-name-input"
                    value={nameDraft}
                    autoFocus
                    maxLength={40}
                    placeholder="e.g. Jane Doe"
                    onChange={(e) => setNameDraft(e.target.value)}
                  />
                  <div className="level-actions" style={{ marginTop: 10 }}>
                    <button type="submit" className="modal-close" disabled={!nameDraft.trim()}>
                      Save &amp; show badge
                    </button>
                    {userName && (
                      <button type="button" className="hint-btn" onClick={() => setEditingName(false)}>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <>
                  <canvas ref={badgeCanvasRef} className="badge-canvas" />
                  <div className="level-actions" style={{ marginTop: 12 }}>
                    <button className="modal-close" onClick={downloadBadge}>
                      ⬇ Download PNG
                    </button>
                    <button
                      className="hint-btn"
                      onClick={() => {
                        setNameDraft(userName);
                        setEditingName(true);
                      }}
                    >
                      Change name
                    </button>
                    <button className="hint-btn" onClick={closeBadge}>
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {privacyOpen && (
        <div className="modal-backdrop" onClick={() => setPrivacyOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Your Privacy, Explained Plainly</div>
            <div className="modal-body">
              <p>This trainer was built just for you to practice on, so here's exactly what happens with your data:</p>
              <p><strong>Everything stays on your device:</strong> every command you type, every PNR you build or save, and your practice progress. It all lives in this browser's local storage and is never sent to any server, ever.</p>
              <p><strong>Exception 1 -- the chat helper:</strong> if you use the "Amy" chat bubble, whatever you type there is sent through this site's server to Google's Gemini API to generate a reply.</p>
              <p><strong>Exception 2 -- Global Chat:</strong> if you open the Global Chat tab, the username you pick and the messages you send are stored in a database and shown to everyone else using the trainer. Your PNRs and practice progress are never part of that.</p>
              <p>Those are the only things that ever leave your browser, and only when you choose to use them.</p>
              <p><strong>Why:</strong> so you can practice, make mistakes, and get help without worrying about any of it being tracked, sold, or used against you. This space is yours.</p>
            </div>
            <button className="modal-close" onClick={() => setPrivacyOpen(false)}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
