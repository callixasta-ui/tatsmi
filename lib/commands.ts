// A learning-purpose simulator of classic Amadeus Basic Access (Cryptic)
// commands and screen output. Not connected to any real inventory --
// availability is deterministically generated so results are repeatable.

export interface FlightRow {
  line: number;
  carrier: string;
  flightNo: string;
  bookClass: string;
  status: string; // e.g. "9" seats or "C" closed
  depTime: string;
  arrTime: string;
  origin: string;
  dest: string;
  date: string;
}

export interface Segment {
  carrier: string;
  flightNo: string;
  bookClass: string;
  date: string;
  origin: string;
  dest: string;
  depTime: string;
  arrTime: string;
  status: string; // HK, GK...
}

export interface Name {
  last: string;
  first: string;
  title?: string;
}

export interface PNR {
  locator?: string;
  names: Name[];
  segments: Segment[];
  contacts: string[];
  remarks: string[];
  osi: string[];
  frequentFlyer?: string;
  ticketing?: string;
  received?: string;
}

export interface EngineState {
  lastAvailability: FlightRow[];
  activePNR: PNR;
  savedPNRs: Record<string, PNR>;
}

export function newState(): EngineState {
  return {
    lastAvailability: [],
    activePNR: emptyPNR(),
    savedPNRs: {},
  };
}

function emptyPNR(): PNR {
  return { names: [], segments: [], contacts: [], remarks: [], osi: [] };
}

const CARRIERS = ["BA", "LH", "AF", "TG", "SQ", "EK", "QF", "CX"];

function seededRand(seed: string, i: number) {
  let h = 0;
  const s = seed + i;
  for (let c = 0; c < s.length; c++) h = (h * 31 + s.charCodeAt(c)) >>> 0;
  return h;
}

function buildAvailability(dateCode: string, origin: string, dest: string): FlightRow[] {
  const rows: FlightRow[] = [];
  for (let i = 1; i <= 8; i++) {
    const r = seededRand(dateCode + origin + dest, i);
    const carrier = CARRIERS[r % CARRIERS.length];
    const flightNo = String(100 + (r % 800));
    const classes = ["Y", "B", "M", "H", "Q", "K"];
    const bookClass = classes[(r >> 3) % classes.length];
    const seatCount = (r >> 6) % 10;
    const status = seatCount === 0 ? "C" : String(seatCount);
    const depHour = (r >> 9) % 22;
    const depMin = (r >> 4) % 2 === 0 ? "00" : "30";
    const durationH = 1 + ((r >> 12) % 12);
    const arrHour = (depHour + durationH) % 24;
    rows.push({
      line: i,
      carrier,
      flightNo,
      bookClass,
      status,
      depTime: `${String(depHour).padStart(2, "0")}${depMin}`,
      arrTime: `${String(arrHour).padStart(2, "0")}${depMin}`,
      origin,
      dest,
      date: dateCode,
    });
  }
  return rows;
}

function pad(s: string, n: number) {
  return (s + " ".repeat(n)).slice(0, n);
}

function genLocator(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export interface CmdResult {
  lines: string[];
  state: EngineState;
}

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

// Unified, numbered element list -- mirrors how a real PNR shows every
// element (names, segments, contacts, remarks, OSI, FQN) in one running
// numbered list, so XE<n> can cancel any of them by number.
type ElementType = "NM" | "SEG" | "AP" | "RM" | "OSI" | "FQN";
interface Element {
  index: number;
  type: ElementType;
  text: string;
}

function getElements(pnr: PNR): Element[] {
  const els: Element[] = [];
  let i = 1;
  pnr.names.forEach((n) => els.push({ index: i++, type: "NM", text: `${n.last}/${n.first}${n.title ? " " + n.title : ""}` }));
  pnr.segments.forEach((seg) =>
    els.push({
      index: i++,
      type: "SEG",
      text: `${seg.carrier} ${pad(seg.flightNo, 4)} ${seg.bookClass}  ${seg.date}  ${seg.origin}${seg.dest}  ${seg.status}  ${seg.depTime}  ${seg.arrTime}`,
    })
  );
  pnr.contacts.forEach((c) => els.push({ index: i++, type: "AP", text: `AP ${c}` }));
  pnr.remarks.forEach((r) => els.push({ index: i++, type: "RM", text: `RM ${r}` }));
  pnr.osi.forEach((o) => els.push({ index: i++, type: "OSI", text: `OSI ${o}` }));
  if (pnr.frequentFlyer) els.push({ index: i++, type: "FQN", text: `FQN ${pnr.frequentFlyer}` });
  return els;
}

function removeElement(pnr: PNR, index: number): boolean {
  const els = getElements(pnr);
  const target = els.find((e) => e.index === index);
  if (!target) return false;
  if (target.type === "NM") {
    const pos = els.filter((e) => e.type === "NM").findIndex((e) => e.index === index);
    pnr.names.splice(pos, 1);
  } else if (target.type === "SEG") {
    const segEls = els.filter((e) => e.type === "SEG");
    const pos = segEls.findIndex((e) => e.index === index);
    pnr.segments.splice(pos, 1);
  } else if (target.type === "AP") {
    const pos = els.filter((e) => e.type === "AP").findIndex((e) => e.index === index);
    pnr.contacts.splice(pos, 1);
  } else if (target.type === "RM") {
    const pos = els.filter((e) => e.type === "RM").findIndex((e) => e.index === index);
    pnr.remarks.splice(pos, 1);
  } else if (target.type === "OSI") {
    const pos = els.filter((e) => e.type === "OSI").findIndex((e) => e.index === index);
    pnr.osi.splice(pos, 1);
  } else if (target.type === "FQN") {
    pnr.frequentFlyer = undefined;
  }
  return true;
}

export function processCommand(raw: string, state: EngineState): CmdResult {
  const input = raw.trim();
  const cmd = input.toUpperCase();
  const out: string[] = [];
  const s: EngineState = {
    lastAvailability: state.lastAvailability,
    activePNR: {
      ...state.activePNR,
      names: [...state.activePNR.names],
      segments: [...state.activePNR.segments],
      contacts: [...state.activePNR.contacts],
      remarks: [...state.activePNR.remarks],
      osi: [...state.activePNR.osi],
    },
    savedPNRs: { ...state.savedPNRs },
  };

  if (!cmd) {
    return { lines: [], state: s };
  }

  // HE / HELP
  if (cmd === "HE" || cmd === "HELP" || cmd === "?") {
    out.push(
      "AVAILABLE ENTRIES ------------------------------",
      "AN<ddMMM><ORIG><DEST>   AVAILABILITY   e.g. AN15DECLONBKK",
      "SS<n><CLASS><LINE>      SELL SEGMENT   e.g. SS1Y1",
      "NM1<LAST>/<FIRST> <TTL> ADD NAME       e.g. NM1SMITH/JOHN MR",
      "AP <PHONE>              ADD CONTACT    e.g. AP 66-2-1234567",
      "TKOK  |  TKTL<date>/<office>  TICKETING ARRANGEMENT",
      "RM <TEXT>               ADD REMARK     e.g. RM VIP PAX",
      "OSI <TEXT>               OTHER SERVICE INFO e.g. OSI CTCT AT WORK",
      "FQN <NUMBER>             FREQUENT FLYER NO. e.g. FQN BA1234567",
      "FXP                      FARE QUOTE FOR ACTIVE PNR",
      "SM                       SEAT MAP FOR LAST SEGMENT",
      "XE<n>                    CANCEL ELEMENT NUMBER n",
      "RT                       DISPLAY ACTIVE PNR",
      "RT*<LOCATOR>             RETRIEVE SAVED PNR",
      "ER                       END TRANSACT + RETRIEVE (SAVE)",
      "IG                       IGNORE / CLEAR ACTIVE PNR",
      "DAC<CITY>                DECODE CITY CODE",
      "HE                       THIS HELP SCREEN",
      "--------------------------------------------------"
    );
    return { lines: out, state: s };
  }

  // AN command: AN15DECLONBKK
  const anMatch = cmd.match(/^AN(\d{2})([A-Z]{3})([A-Z]{3})([A-Z]{3})$/);
  if (anMatch) {
    const [, dd, mon, origin, dest] = anMatch;
    if (!MONTHS.includes(mon)) {
      out.push("INVALID MONTH - USE 3 LETTER CODE (JAN,FEB,...)");
      return { lines: out, state: s };
    }
    const dateCode = `${dd}${mon}`;
    const rows = buildAvailability(dateCode, origin, dest);
    s.lastAvailability = rows;
    out.push(`** AMADEUS AVAILABILITY - AN ** ${origin}-${dest} ${dateCode}`);
    out.push(` ${dateCode}  ${origin}/${dest}  ${rows.length} FLIGHTS`);
    rows.forEach((r) => {
      out.push(
        ` ${String(r.line).padStart(2, " ")} ${r.carrier} ${pad(r.flightNo, 4)} ${r.bookClass}${r.status}  ` +
          `${r.origin} ${r.depTime}  ${r.dest} ${r.arrTime}  E0/${1 + (r.line % 2)}`
      );
    });
    return { lines: out, state: s };
  }

  // SS command: SS1Y1  (sell n, class, from availability line)
  const ssMatch = cmd.match(/^SS(\d+)([A-Z])(\d+)$/);
  if (ssMatch) {
    const [, nStr, cls, lineStr] = ssMatch;
    const line = parseInt(lineStr, 10);
    const row = s.lastAvailability.find((r) => r.line === line);
    if (!row) {
      out.push("INVALID LINE NUMBER - DISPLAY AVAILABILITY (AN) FIRST");
      return { lines: out, state: s };
    }
    if (row.status === "C") {
      out.push(`CLASS ${cls} CLOSED ON LINE ${line} - NO AVAILABILITY`);
      return { lines: out, state: s };
    }
    const seg: Segment = {
      carrier: row.carrier,
      flightNo: row.flightNo,
      bookClass: cls,
      date: row.date,
      origin: row.origin,
      dest: row.dest,
      depTime: row.depTime,
      arrTime: row.arrTime,
      status: "HK",
    };
    s.activePNR.segments.push(seg);
    const idx = getElements(s.activePNR).find((e) => e.type === "SEG" && e.text.includes(seg.flightNo))?.index;
    out.push(` ${idx}  ${seg.carrier} ${pad(seg.flightNo, 4)} ${seg.bookClass}  ${seg.date}  ${nStr}  ${seg.origin}${seg.dest}  HK${nStr}  ${seg.depTime}  ${seg.arrTime}`);
    return { lines: out, state: s };
  }

  // NM1SMITH/JOHN MR
  const nmMatch = raw.match(/^NM1([A-Za-z]+)\/([A-Za-z]+)(?:\s+([A-Za-z]+))?$/);
  if (nmMatch) {
    const [, last, first, title] = nmMatch;
    s.activePNR.names.push({ last: last.toUpperCase(), first: first.toUpperCase(), title: title?.toUpperCase() });
    const idx = getElements(s.activePNR).filter((e) => e.type === "NM").slice(-1)[0]?.index;
    out.push(` ${idx}.${last.toUpperCase()}/${first.toUpperCase()}${title ? " " + title.toUpperCase() : ""}`);
    return { lines: out, state: s };
  }

  // AP <phone>
  const apMatch = raw.match(/^AP\s+(.+)$/i);
  if (apMatch) {
    s.activePNR.contacts.push(apMatch[1].trim());
    const idx = getElements(s.activePNR).filter((e) => e.type === "AP").slice(-1)[0]?.index;
    out.push(` ${idx}.AP ${apMatch[1].trim()}`);
    return { lines: out, state: s };
  }

  // RM <text>
  const rmMatch = raw.match(/^RM\s+(.+)$/i);
  if (rmMatch) {
    s.activePNR.remarks.push(rmMatch[1].trim());
    const idx = getElements(s.activePNR).filter((e) => e.type === "RM").slice(-1)[0]?.index;
    out.push(` ${idx}.RM ${rmMatch[1].trim()}`);
    return { lines: out, state: s };
  }

  // OSI <text>
  const osiMatch = raw.match(/^OSI\s+(.+)$/i);
  if (osiMatch) {
    s.activePNR.osi.push(osiMatch[1].trim());
    const idx = getElements(s.activePNR).filter((e) => e.type === "OSI").slice(-1)[0]?.index;
    out.push(` ${idx}.OSI ${osiMatch[1].trim()}`);
    return { lines: out, state: s };
  }

  // FQN <number>
  const fqnMatch = raw.match(/^FQN\s+(.+)$/i);
  if (fqnMatch) {
    s.activePNR.frequentFlyer = fqnMatch[1].trim().toUpperCase();
    const idx = getElements(s.activePNR).find((e) => e.type === "FQN")?.index;
    out.push(` ${idx}.FQN ${s.activePNR.frequentFlyer}`);
    return { lines: out, state: s };
  }

  // TKOK / TKTL
  if (cmd === "TKOK") {
    s.activePNR.ticketing = "TKOK";
    out.push(" TKOK - TICKET ON OR BEFORE DEPARTURE, NO TIME LIMIT");
    return { lines: out, state: s };
  }
  const tktlMatch = cmd.match(/^TKTL(\d{2}[A-Z]{3})\/(.+)$/);
  if (tktlMatch) {
    s.activePNR.ticketing = `TKTL${tktlMatch[1]}/${tktlMatch[2]}`;
    out.push(` TKTL ${tktlMatch[1]} / ${tktlMatch[2]}`);
    return { lines: out, state: s };
  }

  // FXP - fare quote (fake, deterministic-ish based on segments)
  if (cmd === "FXP") {
    if (s.activePNR.segments.length === 0) {
      out.push("NO SEGMENTS IN PNR - SELL (SS) BEFORE PRICING");
      return { lines: out, state: s };
    }
    let base = 0;
    s.activePNR.segments.forEach((seg, i) => {
      const r = seededRand(seg.flightNo + seg.bookClass, i);
      base += 120 + (r % 480);
    });
    const tax = Math.round(base * 0.18);
    out.push("** FARE QUOTE - FXP **");
    s.activePNR.segments.forEach((seg) => out.push(`  ${seg.carrier}${seg.flightNo} ${seg.bookClass}  ${seg.origin}${seg.dest}`));
    out.push(`  FARE  USD ${base.toFixed(2)}`);
    out.push(`  TAX   USD ${tax.toFixed(2)}`);
    out.push(`  TOTAL USD ${(base + tax).toFixed(2)}`);
    return { lines: out, state: s };
  }

  // SM - seat map for last segment
  if (cmd === "SM") {
    const seg = s.activePNR.segments[s.activePNR.segments.length - 1];
    if (!seg) {
      out.push("NO SEGMENT TO MAP - SELL (SS) FIRST");
      return { lines: out, state: s };
    }
    out.push(`** SEAT MAP ** ${seg.carrier}${seg.flightNo} ${seg.origin}${seg.dest} ${seg.date}`);
    const cols = ["A", "B", "C", "D", "E", "F"];
    for (let row = 10; row <= 14; row++) {
      const r = seededRand(seg.flightNo, row);
      const seatRow = cols.map((c, i) => (((r >> i) & 1) === 0 ? c : "X")).join(" ");
      out.push(`  ${row}  ${seatRow}`);
    }
    out.push("  (letter = open seat, X = occupied)");
    return { lines: out, state: s };
  }

  // XE<n> - cancel element
  const xeMatch = cmd.match(/^XE(\d+)$/);
  if (xeMatch) {
    const idx = parseInt(xeMatch[1], 10);
    const ok = removeElement(s.activePNR, idx);
    out.push(ok ? `ELEMENT ${idx} CANCELLED` : `NO ELEMENT NUMBER ${idx} TO CANCEL`);
    return { lines: out, state: s };
  }

  // RT - redisplay active PNR
  if (cmd === "RT") {
    out.push(...renderPNR(s.activePNR));
    return { lines: out, state: s };
  }

  // RT*LOCATOR - retrieve saved
  const rtStar = cmd.match(/^RT\*([A-Z0-9]{6})$/);
  if (rtStar) {
    const loc = rtStar[1];
    const found = s.savedPNRs[loc];
    if (!found) {
      out.push(`NOT FOUND - RECORD LOCATOR ${loc}`);
      return { lines: out, state: s };
    }
    s.activePNR = found;
    out.push(...renderPNR(found));
    return { lines: out, state: s };
  }

  // ER - end transact and retrieve
  if (cmd === "ER") {
    if (s.activePNR.names.length === 0 || s.activePNR.segments.length === 0) {
      out.push("PNR INCOMPLETE - NAME AND SEGMENT REQUIRED BEFORE ER");
      return { lines: out, state: s };
    }
    const locator = s.activePNR.locator ?? genLocator();
    s.activePNR.locator = locator;
    s.activePNR.received = "SIMULATOR";
    s.savedPNRs[locator] = s.activePNR;
    out.push(`END OF TRANSACTION COMPLETE - ${locator}`);
    out.push(...renderPNR(s.activePNR));
    return { lines: out, state: s };
  }

  // IG - ignore
  if (cmd === "IG") {
    s.activePNR = emptyPNR();
    out.push("IGNORED - ACTIVE PNR CLEARED");
    return { lines: out, state: s };
  }

  // DAC city decode (tiny built-in table, else echo unknown)
  const dacMatch = cmd.match(/^DAC([A-Z]{3})$/);
  if (dacMatch) {
    const table: Record<string, string> = {
      LON: "LONDON, UNITED KINGDOM",
      BKK: "BANGKOK, THAILAND",
      NYC: "NEW YORK, USA",
      HKG: "HONG KONG",
      SIN: "SINGAPORE",
      PAR: "PARIS, FRANCE",
      MNL: "MANILA, PHILIPPINES",
      CEB: "CEBU, PHILIPPINES",
      TYO: "TOKYO, JAPAN",
      SYD: "SYDNEY, AUSTRALIA",
    };
    const city = dacMatch[1];
    out.push(table[city] ? `${city} ${table[city]}` : `${city} UNKNOWN CITY CODE (DEMO TABLE LIMITED)`);
    return { lines: out, state: s };
  }

  out.push(`FORMAT INVALID OR UNKNOWN ENTRY: ${cmd}  -  TYPE HE FOR HELP`);
  return { lines: out, state: s };
}

function renderPNR(pnr: PNR): string[] {
  const out: string[] = [];
  out.push(`--- RT ---  ${pnr.locator ? "RLOC: " + pnr.locator : "(NOT YET SAVED - USE ER)"}`);
  const els = getElements(pnr);
  if (els.length === 0) out.push(" (EMPTY - NO ELEMENTS YET)");
  els.forEach((e) => out.push(` ${e.index}.${e.text}`));
  if (pnr.ticketing) out.push(` TK.${pnr.ticketing}`);
  return out;
}
