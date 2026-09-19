// A learning-purpose simulator of Amadeus Basic Access ("cryptic") commands.
// Entry syntax, mandatory-element rules, and screen shapes are modeled on
// real Amadeus cryptic entries (AN/SS/NM/AP-family/TK/RF/RT/XE/DAC-DAN/
// FXP/SM-ST, etc). It's a simplified training subset, not the full system --
// see the in-app HE listing for what's covered. All data stays local;
// nothing here is connected to any live GDS or airline inventory.

export interface FlightRow {
  line: number;
  carrier: string;
  flightNo: string;
  bookClass: string;
  status: string; // "C" closed | "0" open, waitlist-only | "1".."9" open seats
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
  status: string; // HK confirmed, HL waitlisted
}

export interface Name {
  last: string;
  first: string;
  title?: string;
}

export type ContactType = "AP" | "APM" | "APH" | "APE";
export interface Contact {
  type: ContactType;
  value: string;
}

export interface SeatAssignment {
  seat: string;
  pax: number;
}

export interface PNR {
  locator?: string;
  names: Name[];
  segments: Segment[];
  contacts: Contact[];
  remarks: string[];
  osi: string[];
  frequentFlyer?: string;
  ticketing?: string;
  receivedFrom?: string;
  seatAssignments: SeatAssignment[];
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
  return { names: [], segments: [], contacts: [], remarks: [], osi: [], seatAssignments: [] };
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
    const bookClass = classes[(r >>> 3) % classes.length];
    const seatCount = (r >>> 6) % 10;
    const closedBit = (r >>> 15) & 1;
    // 0 seats splits into two real-world cases: class not offered at all
    // ("C", closed) vs. class offered but sold out -- which is where a
    // real system lets you sell into a waitlist (status "0" here, HL once sold).
    const status = seatCount === 0 ? (closedBit ? "C" : "0") : String(seatCount);
    const depHour = (r >>> 9) % 22;
    const depMin = (r >>> 4) % 2 === 0 ? "00" : "30";
    const durationH = 1 + ((r >>> 12) % 12);
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

const CITY_TABLE: Record<string, string> = {
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
  KUL: "KUALA LUMPUR, MALAYSIA",
  HKT: "PHUKET, THAILAND",
  DXB: "DUBAI, UNITED ARAB EMIRATES",
  DPS: "DENPASAR/BALI, INDONESIA",
  ICN: "SEOUL, SOUTH KOREA",
  DOH: "DOHA, QATAR",
};

// Unified, numbered element list -- mirrors how a real PNR shows every
// element (names, segments, contacts, remarks, OSI, FFN, seat assignments)
// in one running numbered list, so XE<n> can cancel any of them by number.
// RF and the ticketing arrangement are real but stay outside this numbering,
// same as a real Amadeus display.
type ElementType = "NM" | "SEG" | "AP" | "RM" | "OSI" | "FFN" | "ST";
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
  pnr.contacts.forEach((c) => els.push({ index: i++, type: "AP", text: `${c.type} ${c.value}` }));
  pnr.remarks.forEach((r) => els.push({ index: i++, type: "RM", text: `RM ${r}` }));
  pnr.osi.forEach((o) => els.push({ index: i++, type: "OSI", text: `OSI ${o}` }));
  if (pnr.frequentFlyer) els.push({ index: i++, type: "FFN", text: `FFN ${pnr.frequentFlyer}` });
  pnr.seatAssignments.forEach((sa) => els.push({ index: i++, type: "ST", text: `ST ${sa.seat} - P${sa.pax}` }));
  return els;
}

function removeElement(pnr: PNR, index: number): boolean {
  const els = getElements(pnr);
  const target = els.find((e) => e.index === index);
  if (!target) return false;
  const pos = els.filter((e) => e.type === target.type).findIndex((e) => e.index === index);
  if (target.type === "NM") pnr.names.splice(pos, 1);
  else if (target.type === "SEG") pnr.segments.splice(pos, 1);
  else if (target.type === "AP") pnr.contacts.splice(pos, 1);
  else if (target.type === "RM") pnr.remarks.splice(pos, 1);
  else if (target.type === "OSI") pnr.osi.splice(pos, 1);
  else if (target.type === "FFN") pnr.frequentFlyer = undefined;
  else if (target.type === "ST") pnr.seatAssignments.splice(pos, 1);
  return true;
}

const SEAT_COLS_ECONOMY = ["A", "B", "C", "D", "E", "F"];

function seatMapRows(seg: Segment): { row: number; seats: { seat: string; occupied: boolean }[] }[] {
  const out: { row: number; seats: { seat: string; occupied: boolean }[] }[] = [];
  for (let row = 10; row <= 14; row++) {
    const r = seededRand(seg.flightNo, row);
    const seats = SEAT_COLS_ECONOMY.map((c, i) => ({ seat: `${row}${c}`, occupied: ((r >>> i) & 1) === 1 }));
    out.push({ row, seats });
  }
  return out;
}

function helpTopic(topic: string): string[] {
  const t: Record<string, string> = {
    AN: "AN<ddMMM><ORIG><DEST> -- air availability. e.g. AN15DECLONBKK",
    SN: "SN<ddMMM><ORIG><DEST> -- schedule display (same data as AN here).",
    SS: "SS<n><CLASS><LINE> -- sell n seats, class, from an availability line. e.g. SS1Y1",
    NM: "NM<n><LAST>/<FIRST> <TITLE> -- add a passenger name. e.g. NM1SMITH/JOHN MR",
    AP: "AP <phone> | APM <mobile> | APH <home> | APE <email> -- contact elements.",
    TK: "TKOK -- no time limit. TKTL<ddMMM>/<hhmm> -- ticketing time limit.",
    RF: "RF <name/initials> -- Received From. Your signature, required before ER.",
    RM: "RM <text> -- a free-text remark.",
    OS: "OS <text> -- Other Service Information (displays as an OSI element).",
    FFN: "FFN <CARRIER-NUMBER> -- attach a frequent flyer number. e.g. FFN BA-1234567",
    RT: "RT -- redisplay the active PNR. RT<LOCATOR> -- retrieve a saved PNR.",
    ER: "ER -- End & Retrieve: saves the PNR, hands back a record locator. Requires the 5 mandatory elements.",
    IG: "IG -- ignore/discard the active PNR without saving.",
    XE: "XE<n> -- cancel element number n, using the numbering shown by RT.",
    DAC: "DAC<code> -- decode a city/airport code to its name.",
    DAN: "DAN <text> -- encode a city name to its code.",
    FXP: "FXP -- fare quote for every segment in the active PNR.",
    SM: "SM<n> -- seat map for segment n (defaults to the last segment sold).",
    ST: "ST/<seat>/P<n> -- assign a seat to passenger n. e.g. ST/24A/P1",
    CLS: "CLS -- clear the screen. Trainer convenience, not a real Amadeus entry.",
  };
  return t[topic] ? [t[topic]] : [`NO HELP AVAILABLE FOR "${topic}" -- TYPE HE FOR THE FULL LIST`];
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
      seatAssignments: [...state.activePNR.seatAssignments],
    },
    savedPNRs: { ...state.savedPNRs },
  };

  if (!cmd) return { lines: [], state: s };

  // HE / HELP [topic]
  const heMatch = cmd.match(/^(HE|HELP|\?)(\s+(\S+))?$/);
  if (heMatch) {
    if (heMatch[3]) {
      out.push(...helpTopic(heMatch[3]));
      return { lines: out, state: s };
    }
    out.push(
      "AVAILABLE ENTRIES ------------------------------",
      "AN / SN <ddMMM><ORIG><DEST>   AVAILABILITY / SCHEDULE",
      "SS<n><CLASS><LINE>            SELL SEGMENT",
      "NM<n><LAST>/<FIRST> <TTL>     ADD NAME",
      "AP / APM / APH / APE <text>   CONTACT (PHONE/MOBILE/HOME/EMAIL)",
      "TKOK | TKTL<ddMMM>/<hhmm>     TICKETING ARRANGEMENT",
      "RF <NAME>                     RECEIVED FROM (mandatory before ER)",
      "RM <TEXT>                     REMARK",
      "OS <TEXT>                     OTHER SERVICE INFO (shows as OSI)",
      "FFN <CARRIER-NUMBER>          FREQUENT FLYER NUMBER",
      "FXP                           FARE QUOTE FOR ACTIVE PNR",
      "SM<n>                         SEAT MAP (n = segment, default last)",
      "ST/<SEAT>/P<n>                ASSIGN A SEAT",
      "XE<n>                         CANCEL ELEMENT NUMBER n",
      "RT                            DISPLAY ACTIVE PNR",
      "RT<LOCATOR>                   RETRIEVE A SAVED PNR",
      "ER                            END TRANSACTION -- SAVE (5 mandatory elements)",
      "IG                            IGNORE / CLEAR ACTIVE PNR",
      "DAC<CODE> / DAN <TEXT>        DECODE / ENCODE A CITY",
      "CLS                           CLEAR SCREEN (trainer convenience only)",
      "HE <TOPIC>                    HELP ON ONE ENTRY, e.g. HE TKTL",
      "--------------------------------------------------"
    );
    return { lines: out, state: s };
  }

  // AN / SN command: AN15DECLONBKK
  const anMatch = cmd.match(/^(AN|SN)(\d{2})([A-Z]{3})([A-Z]{3})([A-Z]{3})$/);
  if (anMatch) {
    const [, kind, dd, mon, origin, dest] = anMatch;
    if (!MONTHS.includes(mon)) {
      out.push("INVALID MONTH - USE 3 LETTER CODE (JAN,FEB,...)");
      return { lines: out, state: s };
    }
    const dateCode = `${dd}${mon}`;
    const rows = buildAvailability(dateCode, origin, dest);
    s.lastAvailability = rows;
    out.push(`** AMADEUS ${kind === "SN" ? "SCHEDULE" : "AVAILABILITY"} - ${kind} ** ${origin}-${dest} ${dateCode}`);
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
    const waitlist = row.status === "0";
    const seg: Segment = {
      carrier: row.carrier,
      flightNo: row.flightNo,
      bookClass: cls,
      date: row.date,
      origin: row.origin,
      dest: row.dest,
      depTime: row.depTime,
      arrTime: row.arrTime,
      status: waitlist ? "HL" : "HK",
    };
    s.activePNR.segments.push(seg);
    const idx = getElements(s.activePNR).find((e) => e.type === "SEG" && e.text.includes(seg.flightNo))?.index;
    out.push(
      ` ${idx}  ${seg.carrier} ${pad(seg.flightNo, 4)} ${seg.bookClass}  ${seg.date}  ${nStr}  ${seg.origin}${seg.dest}  ${seg.status}${nStr}  ${seg.depTime}  ${seg.arrTime}`
    );
    if (waitlist) out.push(" *** SOLD INTO WAITLIST - CLASS SHOWED 0 SEATS ***");
    return { lines: out, state: s };
  }

  // NM<n>SMITH/JOHN MR
  const nmMatch = raw.match(/^NM\d+([A-Za-z]+)\/([A-Za-z]+)(?:\s+(.+))?$/);
  if (nmMatch) {
    const [, last, first, title] = nmMatch;
    s.activePNR.names.push({ last: last.toUpperCase(), first: first.toUpperCase(), title: title?.toUpperCase() });
    const idx = getElements(s.activePNR).filter((e) => e.type === "NM").slice(-1)[0]?.index;
    out.push(` ${idx}.${last.toUpperCase()}/${first.toUpperCase()}${title ? " " + title.toUpperCase() : ""}`);
    return { lines: out, state: s };
  }

  // Contacts: APE (email) / APM (mobile) / APH (home) / AP (phone) --
  // check the 3-letter variants before the bare 2-letter AP.
  const contactMatch = raw.match(/^(APE|APM|APH|AP)\s+(.+)$/i);
  if (contactMatch) {
    const type = contactMatch[1].toUpperCase() as ContactType;
    const value = contactMatch[2].trim();
    s.activePNR.contacts.push({ type, value });
    const idx = getElements(s.activePNR).filter((e) => e.type === "AP").slice(-1)[0]?.index;
    out.push(` ${idx}.${type} ${value}`);
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

  // OS <text> -- entry is OS, element displays as OSI (real Amadeus behavior)
  const osMatch = raw.match(/^OS\s+(.+)$/i);
  if (osMatch) {
    s.activePNR.osi.push(osMatch[1].trim());
    const idx = getElements(s.activePNR).filter((e) => e.type === "OSI").slice(-1)[0]?.index;
    out.push(` ${idx}.OSI ${osMatch[1].trim()}`);
    return { lines: out, state: s };
  }

  // FFN <carrier-number>
  const ffnMatch = raw.match(/^FFN\s+(.+)$/i);
  if (ffnMatch) {
    s.activePNR.frequentFlyer = ffnMatch[1].trim().toUpperCase();
    const idx = getElements(s.activePNR).find((e) => e.type === "FFN")?.index;
    out.push(` ${idx}.FFN ${s.activePNR.frequentFlyer}`);
    return { lines: out, state: s };
  }

  // RF <name>
  const rfMatch = raw.match(/^RF\s*(.+)$/i);
  if (rfMatch) {
    s.activePNR.receivedFrom = rfMatch[1].trim().toUpperCase();
    out.push(` RF.${s.activePNR.receivedFrom}`);
    return { lines: out, state: s };
  }

  // TKOK / TKTL
  if (cmd === "TKOK") {
    s.activePNR.ticketing = "TKOK";
    out.push(" TKOK - TICKET ON OR BEFORE DEPARTURE, NO TIME LIMIT");
    return { lines: out, state: s };
  }
  const tktlMatch = cmd.match(/^TKTL(\d{2}[A-Z]{3})\/(\d{4})$/);
  if (tktlMatch) {
    s.activePNR.ticketing = `TKTL${tktlMatch[1]}/${tktlMatch[2]}`;
    out.push(` TKTL ${tktlMatch[1]} / ${tktlMatch[2]} -- QUEUED TO Q8 CAT C1 ON SAVE`);
    return { lines: out, state: s };
  }

  // FXP - fare quote (simplified: computes and prints directly)
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

  // SM<n> - seat map for a given segment (default: last)
  const smMatch = cmd.match(/^SM(\d*)$/);
  if (smMatch) {
    const segs = s.activePNR.segments;
    if (segs.length === 0) {
      out.push("NO SEGMENT TO MAP - SELL (SS) FIRST");
      return { lines: out, state: s };
    }
    const segIdx = smMatch[1] ? parseInt(smMatch[1], 10) - 1 : segs.length - 1;
    const seg = segs[segIdx];
    if (!seg) {
      out.push(`NO SUCH SEGMENT NUMBER - PNR HAS ${segs.length} SEGMENT(S)`);
      return { lines: out, state: s };
    }
    out.push(`** SEAT MAP ** ${seg.carrier}${seg.flightNo} ${seg.origin}${seg.dest} ${seg.date}`);
    seatMapRows(seg).forEach((r) => {
      out.push(`  ${r.row}  ${r.seats.map((x) => (x.occupied ? "X" : x.seat.slice(-1))).join(" ")}`);
    });
    out.push("  (letter = open seat, X = occupied)");
    return { lines: out, state: s };
  }

  // ST/<seat>/P<n> - seat assignment
  const stMatch = cmd.match(/^ST\/(\d{1,2}[A-F])(?:\/P(\d+))?$/);
  if (stMatch) {
    const [, seat, paxStr] = stMatch;
    const pax = paxStr ? parseInt(paxStr, 10) : 1;
    const segs = s.activePNR.segments;
    if (segs.length === 0) {
      out.push("NO SEGMENT ON FILE - SELL (SS) BEFORE ASSIGNING A SEAT");
      return { lines: out, state: s };
    }
    const seg = segs[segs.length - 1];
    const rowNum = parseInt(seat, 10);
    const map = seatMapRows(seg);
    const rowEntry = map.find((r) => r.row === rowNum);
    if (!rowEntry) {
      out.push(`SEAT ${seat} NOT VALID IN THIS CABIN (ROWS 10-14)`);
      return { lines: out, state: s };
    }
    const seatEntry = rowEntry.seats.find((x) => x.seat === seat);
    if (!seatEntry) {
      out.push(`SEAT ${seat} NOT VALID IN THIS CABIN (COLUMNS A-F)`);
      return { lines: out, state: s };
    }
    if (seatEntry.occupied) {
      out.push(`SEAT ${seat} ALREADY OCCUPIED - CHOOSE ANOTHER`);
      return { lines: out, state: s };
    }
    if (s.activePNR.seatAssignments.some((sa) => sa.seat === seat)) {
      out.push(`SEAT ${seat} ALREADY ASSIGNED IN THIS PNR - CHOOSE ANOTHER`);
      return { lines: out, state: s };
    }
    s.activePNR.seatAssignments.push({ seat, pax });
    const idx = getElements(s.activePNR).filter((e) => e.type === "ST").slice(-1)[0]?.index;
    out.push(` ${idx}.ST ${seat} - P${pax} CONFIRMED`);
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

  // RT<LOCATOR> - retrieve saved (no separator -- real Amadeus syntax)
  const rtLoc = cmd.match(/^RT([A-Z0-9]{6})$/);
  if (rtLoc) {
    const loc = rtLoc[1];
    const found = s.savedPNRs[loc];
    if (!found) {
      out.push(`NOT FOUND - RECORD LOCATOR ${loc}`);
      return { lines: out, state: s };
    }
    s.activePNR = found;
    out.push(...renderPNR(found));
    return { lines: out, state: s };
  }

  // ER - end transact and retrieve. Real Amadeus requires 5 mandatory
  // elements before it will save: name, segment, a contact, a ticketing
  // arrangement, and Received From.
  if (cmd === "ER") {
    const missing: string[] = [];
    if (s.activePNR.names.length === 0) missing.push("NAME (NM)");
    if (s.activePNR.segments.length === 0) missing.push("SEGMENT (SS)");
    if (s.activePNR.contacts.length === 0) missing.push("CONTACT (AP/APM/APH/APE)");
    if (!s.activePNR.ticketing) missing.push("TICKETING ARRANGEMENT (TKOK/TKTL)");
    if (!s.activePNR.receivedFrom) missing.push("RECEIVED FROM (RF)");
    if (missing.length > 0) {
      out.push("PNR INCOMPLETE - MISSING MANDATORY ELEMENT(S):");
      missing.forEach((m) => out.push(`  - ${m}`));
      return { lines: out, state: s };
    }
    const locator = s.activePNR.locator ?? genLocator();
    s.activePNR.locator = locator;
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

  // DAC city decode
  const dacMatch = cmd.match(/^DAC([A-Z]{3})$/);
  if (dacMatch) {
    const city = dacMatch[1];
    out.push(CITY_TABLE[city] ? `${city} ${CITY_TABLE[city]}` : `${city} UNKNOWN CITY CODE (DEMO TABLE LIMITED)`);
    return { lines: out, state: s };
  }

  // DAN city encode (name -> code), reverse lookup on the same table
  const danMatch = raw.match(/^DAN\s+(.+)$/i);
  if (danMatch) {
    const needle = danMatch[1].trim().toUpperCase();
    const found = Object.entries(CITY_TABLE).find(([, name]) => name.includes(needle));
    out.push(found ? `${needle} ${found[0]}` : `${needle} NO MATCH (DEMO TABLE LIMITED)`);
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
  if (pnr.receivedFrom) out.push(` RF.${pnr.receivedFrom}`);
  return out;
}
