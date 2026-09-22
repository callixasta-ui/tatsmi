// A learning-purpose simulator of Amadeus Basic Access ("cryptic") commands.
// Entry syntax, mandatory-element rules, and screen shapes are modeled on
// real Amadeus cryptic entries (AN/SN/TN/DO/AC/SS/NM/AP-family/TK/RF/RT/XE/
// DAC-DAN/FXP/SM-ST, etc), including the flight-information-display family
// (availability / schedule / timetable / flight info) AND the full Passenger
// Name Record chapter (mandatory SMART elements, ARNK/open/waitlisted/dual
// segments, DK/LK/SS/LL status codes, child & infant names, Name Update,
// ranged/selected XE, retrieval by name, and ignore-vs-revert semantics)
// from STI handout TH2106. It's a simplified training subset, not the full
// system -- see the in-app HE listing for what's covered. All data stays
// local; nothing here is connected to any live GDS or airline inventory.

export interface ClassStatus {
  code: string;
  status: string; // "1".."9" open seats | "0" open, waitlist-only
}

export interface FlightRow {
  line: number;
  carrier: string;
  flightNo: string;
  classes: ClassStatus[];
  depTime: string;
  arrTime: string;
  origin: string;
  originTerm: string;
  dest: string;
  destTerm: string;
  date: string; // ddMON
  stops: number;
  aircraft: string;
  elapsed: string; // "H:MM"
  access: string; // "/" full | "." sell | "*" direct | "" standard
}

export interface TimetableRow {
  line: number;
  carrier: string;
  flightNo: string;
  dow: string; // e.g. "D", "X2", "2346"
  depTime: string;
  arrTime: string;
  origin: string;
  originTerm: string;
  dest: string;
  destTerm: string;
  stops: number;
  effective: string;
  discontinue: string;
  aircraft: string;
  elapsed: string;
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
  status: string; // HK confirmed, HL waitlisted (engine logic keys off this)
  segType?: "FLIGHT" | "ARNK" | "OPEN"; // default FLIGHT
  accessCode?: string; // DK/LK/SS (confirmed, by access level) or LL (waitlisted) -- display only
  waitlistPriority?: string; // e.g. "PE" from SS2F3/PE
}

export interface Name {
  last: string;
  first: string;
  title?: string;
  paxType?: "CHD" | "INF"; // set when this name carries a (CHD/...) modifier
  childDob?: string; // ddMMMyy, from (CHD/ddMMMyy)
  infant?: { last: string; first: string; dob: string }; // from (INF/...) or (INFsurname/...)
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

// A fare quote stored against the PNR, same as a real Transitional Stored
// Ticket (TST) -- FXP creates one, TTP consumes one to actually issue.
export interface TstRecord {
  id: string; // T01, T02...
  base: number;
  tax: number;
  taxCode: string;
  total: number;
  currency: string;
  used: boolean;
}

// An actually-issued ticket document, produced by TTP.
export interface TicketRecord {
  passenger: string;
  number: string; // "125-2034567890" (3-digit airline code + 10-digit doc number)
  validatingCarrier: string;
  amount: number;
  currency: string;
  fop: string;
  issueDate: string; // ddMMMyy
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
  tst: TstRecord[];
  formOfPayment?: string;
  tickets: TicketRecord[];
}

export interface LastQuery {
  kind: "AN" | "SN";
  dateCode: string; // ddMON
  origin: string;
  dest: string;
  quals: string[]; // raw "/X..." tokens, without the slash
  afterHour?: number;
}

export interface EngineState {
  lastAvailability: FlightRow[];
  lastQuery?: LastQuery;
  previousQuery?: LastQuery;
  activePNR: PNR;
  savedPNRs: Record<string, PNR>;
  // Work areas, like a real Amadeus terminal (A-F). The top-level fields above
  // always belong to the CURRENT area; every other area you've used is parked
  // here, complete with its own PNR-in-progress and availability display.
  area: string;
  parked: Record<string, AreaSnapshot>;
}

export interface AreaSnapshot {
  lastAvailability: FlightRow[];
  lastQuery?: LastQuery;
  previousQuery?: LastQuery;
  activePNR: PNR;
}

export const WORK_AREAS = ["A", "B", "C", "D", "E", "F"];

export function newState(): EngineState {
  return {
    lastAvailability: [],
    activePNR: emptyPNR(),
    savedPNRs: {},
    area: "A",
    parked: {},
  };
}

// Backfills any PNR loaded from an older saved session (before TST/FP/ticket
// fields existed) so the rest of the engine can always assume they're arrays.
function normalizePNR(p: Partial<PNR> | undefined): PNR {
  const base = emptyPNR();
  if (!p) return base;
  return {
    ...base,
    ...p,
    names: p.names ?? [],
    segments: p.segments ?? [],
    contacts: p.contacts ?? [],
    remarks: p.remarks ?? [],
    osi: p.osi ?? [],
    seatAssignments: p.seatAssignments ?? [],
    tst: p.tst ?? [],
    tickets: p.tickets ?? [],
  };
}

// Older saved sessions (before work areas existed) won't have area/parked.
export function normalizeState(raw: Partial<EngineState> | undefined): EngineState {
  const base = newState();
  if (!raw) return base;
  const parked: Record<string, AreaSnapshot> = {};
  Object.entries(raw.parked ?? {}).forEach(([k, v]) => {
    parked[k] = { ...v, activePNR: normalizePNR(v?.activePNR) };
  });
  const savedPNRs: Record<string, PNR> = {};
  Object.entries(raw.savedPNRs ?? {}).forEach(([k, v]) => {
    savedPNRs[k] = normalizePNR(v);
  });
  return {
    ...base,
    ...raw,
    activePNR: normalizePNR(raw.activePNR),
    savedPNRs,
    area: raw.area && WORK_AREAS.includes(raw.area) ? raw.area : "A",
    parked,
  };
}

export function pnrHasContent(p: PNR): boolean {
  return (
    p.names.length > 0 ||
    p.segments.length > 0 ||
    p.contacts.length > 0 ||
    p.remarks.length > 0 ||
    p.osi.length > 0 ||
    p.seatAssignments.length > 0 ||
    !!p.frequentFlyer ||
    !!p.ticketing ||
    !!p.receivedFrom ||
    (p.tst?.length ?? 0) > 0 ||
    (p.tickets?.length ?? 0) > 0 ||
    !!p.formOfPayment
  );
}

function emptyPNR(): PNR {
  return { names: [], segments: [], contacts: [], remarks: [], osi: [], seatAssignments: [], tst: [], tickets: [] };
}

const CARRIERS = ["BA", "LH", "AF", "TG", "SQ", "EK", "QF", "CX"];
const AIRCRAFT = ["320", "321", "332", "333", "343", "359", "388", "744", "772", "773", "787"];
const ACCESS_INDICATORS = ["/", ".", "*", ""]; // full / sell / direct / standard

function seededRand(seed: string, i: number) {
  let h = 0;
  const s = seed + i;
  for (let c = 0; c < s.length; c++) h = (h * 31 + s.charCodeAt(c)) >>> 0;
  return h;
}

// All classes of service the demo can generate, tagged with the cabin they
// belong to (F/C/W/M), matching the /K option table in the handout.
const ALL_CLASSES: { code: string; cabin: "F" | "C" | "W" | "M" }[] = [
  { code: "F", cabin: "F" },
  { code: "A", cabin: "F" },
  { code: "J", cabin: "C" },
  { code: "C", cabin: "C" },
  { code: "D", cabin: "C" },
  { code: "W", cabin: "W" },
  { code: "E", cabin: "W" },
  { code: "Y", cabin: "M" },
  { code: "B", cabin: "M" },
  { code: "M", cabin: "M" },
  { code: "H", cabin: "M" },
  { code: "Q", cabin: "M" },
  { code: "K", cabin: "M" },
];
const CABIN_LETTERS = ["F", "C", "W", "M"];

interface BaseFlight {
  carrier: string;
  flightNo: string;
  depTime: string;
  arrTime: string;
  originTerm: string;
  destTerm: string;
  stops: number;
  aircraft: string;
  elapsed: string;
  access: string;
}

// Deterministic "physical" details for one carrier+flightNo+date+route --
// used by AN/SN (per line) *and* by DO (direct entry), so looking a flight
// straight up with DO gives the same times/equipment you saw on the AN
// display it came from.
function baseFlightDetails(carrier: string, flightNo: string, dateCode: string, origin: string, dest: string): BaseFlight {
  const seed = carrier + flightNo + dateCode + origin + dest;
  const r = seededRand(seed, 0);
  const depHour = (r >>> 9) % 22;
  const depMin = (r >>> 4) % 2 === 0 ? "00" : "30";
  const durationH = 1 + ((r >>> 12) % 12);
  const durationM = (r >>> 2) % 2 === 0 ? 0 : 30;
  const arrTotalMin = depHour * 60 + parseInt(depMin, 10) + durationH * 60 + durationM;
  const arrHour = Math.floor(arrTotalMin / 60) % 24;
  const arrMin = arrTotalMin % 60;
  return {
    carrier,
    flightNo,
    depTime: `${String(depHour).padStart(2, "0")}${depMin}`,
    arrTime: `${String(arrHour).padStart(2, "0")}${String(arrMin).padStart(2, "0")}`,
    originTerm: String(1 + (r % 3)),
    destTerm: String(1 + ((r >>> 6) % 3)),
    stops: 0, // this demo models non-stop flights only
    aircraft: AIRCRAFT[(r >>> 8) % AIRCRAFT.length],
    elapsed: `${durationH}:${String(durationM).padStart(2, "0")}`,
    access: ACCESS_INDICATORS[(r >>> 14) % ACCESS_INDICATORS.length],
  };
}

function classesForFlight(carrier: string, flightNo: string, dateCode: string): ClassStatus[] {
  const seed = "CLS" + carrier + flightNo + dateCode;
  const out: ClassStatus[] = [];
  ALL_CLASSES.forEach((c, i) => {
    const r = seededRand(seed, i);
    if (r % 10 < 8) {
      // included on this flight
      const seatCount = (r >>> 4) % 10;
      out.push({ code: c.code, status: String(seatCount) });
    }
  });
  return out;
}

export interface AvailQualifiers {
  carrierFilter?: string;
  classFilter?: string;
  cabinFilter?: "F" | "C" | "W" | "M";
  connectingPoint?: string;
  afterHour?: number;
  notes: string[];
}

function parseQualifiers(tokens: string[]): AvailQualifiers {
  const q: AvailQualifiers = { notes: [] };
  tokens.forEach((tok) => {
    const opt = tok[0];
    const val = tok.slice(1);
    if (opt === "A" && val) q.carrierFilter = val;
    else if (opt === "C" && val) q.classFilter = val[0];
    else if (opt === "K" && val && CABIN_LETTERS.includes(val[0])) q.cabinFilter = val[0] as "F" | "C" | "W" | "M";
    else if (opt === "X" && val) {
      q.connectingPoint = val;
      q.notes.push(`/X${val} -- CONNECTING-POINT FILTER NOT MODELED IN THIS DEMO (SHOWN UNFILTERED)`);
    } else q.notes.push(`UNRECOGNIZED OPTION "/${tok}" -- IGNORED`);
  });
  return q;
}

function buildAvailability(dateCode: string, origin: string, dest: string, q: AvailQualifiers = { notes: [] }): FlightRow[] {
  const rows: FlightRow[] = [];
  let line = 1;
  for (let i = 1; i <= 8; i++) {
    const r = seededRand(dateCode + origin + dest, i);
    const carrier = CARRIERS[r % CARRIERS.length];
    const flightNo = String(100 + (r % 800));
    if (q.carrierFilter && carrier !== q.carrierFilter.toUpperCase()) continue;

    const base = baseFlightDetails(carrier, flightNo, dateCode, origin, dest);
    if (q.afterHour !== undefined) {
      const depHour = parseInt(base.depTime.slice(0, 2), 10);
      if (depHour < Math.max(0, q.afterHour - 1)) continue;
    }

    let classes = classesForFlight(carrier, flightNo, dateCode);
    if (q.cabinFilter) classes = classes.filter((c) => ALL_CLASSES.find((a) => a.code === c.code)?.cabin === q.cabinFilter);
    if (q.classFilter) classes = classes.filter((c) => c.code === q.classFilter);
    if (classes.length === 0) continue; // nothing sellable under these filters, real AN just skips the line

    rows.push({
      line: line++,
      carrier,
      flightNo,
      classes,
      depTime: base.depTime,
      arrTime: base.arrTime,
      origin,
      originTerm: base.originTerm,
      dest,
      destTerm: base.destTerm,
      date: dateCode,
      stops: base.stops,
      aircraft: base.aircraft,
      elapsed: base.elapsed,
      access: base.access,
    });
  }
  return rows;
}

function buildTimetable(dateCode: string, origin: string, dest: string): TimetableRow[] {
  const rows: TimetableRow[] = [];
  const DOW_PATTERNS = ["D", "1234567", "X2", "X6", "2346", "1357", "X7"];
  for (let i = 1; i <= 6; i++) {
    const r = seededRand("TN" + dateCode + origin + dest, i);
    const carrier = CARRIERS[r % CARRIERS.length];
    const flightNo = String(100 + (r % 800));
    const base = baseFlightDetails(carrier, flightNo, dateCode, origin, dest);
    const eff = shiftDate(dateCode, -((r >>> 10) % 120));
    rows.push({
      line: i,
      carrier,
      flightNo,
      dow: DOW_PATTERNS[(r >>> 5) % DOW_PATTERNS.length],
      depTime: base.depTime,
      arrTime: base.arrTime,
      origin,
      originTerm: base.originTerm,
      dest,
      destTerm: base.destTerm,
      stops: base.stops,
      effective: eff,
      discontinue: "---",
      aircraft: base.aircraft,
      elapsed: base.elapsed,
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

// Real IATA airline numeric codes, used as the 3-digit prefix on a ticket
// document number (e.g. "125" for British Airways).
const CARRIER_NUMERIC: Record<string, string> = {
  BA: "125", LH: "220", AF: "057", TG: "217", SQ: "618", EK: "176", QF: "081", CX: "160",
};

// Ticket numbers are 3-digit airline code + 10-digit document number, where
// the document number's last digit is a check digit = (first 9 digits) mod 7
// -- the real IATA ticket-numbering rule, not an arbitrary format.
function genTicketNumber(carrier: string): string {
  const airlineCode = CARRIER_NUMERIC[carrier] ?? "999";
  let serial = "";
  for (let i = 0; i < 9; i++) serial += Math.floor(Math.random() * 10);
  const checkDigit = parseInt(serial, 10) % 7;
  return `${airlineCode}-${serial}${checkDigit}`;
}

export interface CmdResult {
  lines: string[];
  state: EngineState;
}

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const DOW_CODES = ["SU","MO","TU","WE","TH","FR","SA"];

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
  BOM: "MUMBAI, INDIA",
  KWI: "KUWAIT, KUWAIT",
};

const COUNTRY_CODE: Record<string, string> = {
  LON: "GB", BKK: "TH", NYC: "US", HKG: "HK", SIN: "SG", PAR: "FR", MNL: "PH",
  CEB: "PH", TYO: "JP", SYD: "AU", KUL: "MY", HKT: "TH", DXB: "AE", DPS: "ID",
  ICN: "KR", DOH: "QA", BOM: "IN", KWI: "KW",
};

function cityName(code: string): string {
  return CITY_TABLE[code] ? CITY_TABLE[code].split(",")[0] : code;
}
function countryCode(code: string): string {
  return COUNTRY_CODE[code] ?? "XX";
}

// ---- date helpers (dd+MON, year inferred as the nearest same-or-future
// occurrence of that date relative to "today", same convention Amadeus
// uses when you omit the year) ----
function resolveDate(dateCode: string): Date {
  const dd = parseInt(dateCode.slice(0, 2), 10);
  const mon = dateCode.slice(2);
  const monIdx = MONTHS.indexOf(mon);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let d = new Date(today.getFullYear(), monIdx, dd);
  if (d < today) d = new Date(today.getFullYear() + 1, monIdx, dd);
  return d;
}

function dateCodeOf(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}${MONTHS[d.getMonth()]}`;
}

function shiftDate(dateCode: string, days: number): string {
  const d = resolveDate(dateCode);
  d.setDate(d.getDate() + days);
  return dateCodeOf(d);
}

function daysBetweenToday(dateCode: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = resolveDate(dateCode);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function dowOf(dateCode: string): string {
  return DOW_CODES[resolveDate(dateCode).getDay()];
}

// Unified, numbered element list -- mirrors how a real PNR shows every
// element (names, segments, contacts, remarks, OSI, FFN, seat assignments)
// in one running numbered list, so XE<n> can cancel any of them by number.
// RF and the ticketing arrangement are real but stay outside this numbering,
// same as a real Amadeus display.
type ElementType = "NM" | "SEG" | "AP" | "RM" | "OSI" | "FFN" | "ST" | "FA";
interface Element {
  index: number;
  type: ElementType;
  text: string;
}

function getElements(pnr: PNR): Element[] {
  const els: Element[] = [];
  let i = 1;
  pnr.names.forEach((n) => {
    let text = `${n.last}/${n.first}${n.title ? " " + n.title : ""}`;
    if (n.paxType === "CHD" && n.childDob) text += `(CHD/${n.childDob})`;
    if (n.paxType === "INF" && !n.infant) text += `(INS)`;
    if (n.infant) text += `(INF${n.infant.last !== n.last ? n.infant.last : ""}/${n.infant.first}/${n.infant.dob})`;
    els.push({ index: i++, type: "NM", text });
  });
  pnr.segments.forEach((seg) => {
    if (seg.segType === "ARNK") {
      els.push({ index: i++, type: "SEG", text: `ARNK` });
      return;
    }
    if (seg.segType === "OPEN") {
      els.push({
        index: i++,
        type: "SEG",
        text: `${seg.carrier}OPEN  ${seg.bookClass}  ${seg.date || "(NO DATE)"}  ${seg.origin}${seg.dest}`,
      });
      return;
    }
    const shown = seg.accessCode ?? seg.status;
    const wlSuffix = seg.status === "HL" && seg.waitlistPriority ? `/${seg.waitlistPriority}` : "";
    els.push({
      index: i++,
      type: "SEG",
      text: `${seg.carrier} ${pad(seg.flightNo, 4)} ${seg.bookClass}  ${seg.date}  ${seg.origin}${seg.dest}  ${shown}1${wlSuffix}  ${seg.depTime}  ${seg.arrTime}`,
    });
  });
  pnr.contacts.forEach((c) => els.push({ index: i++, type: "AP", text: `${c.type} ${c.value}` }));
  pnr.remarks.forEach((r) => els.push({ index: i++, type: "RM", text: `RM ${r}` }));
  pnr.osi.forEach((o) => els.push({ index: i++, type: "OSI", text: `OSI ${o}` }));
  if (pnr.frequentFlyer) els.push({ index: i++, type: "FFN", text: `FFN ${pnr.frequentFlyer}` });
  pnr.seatAssignments.forEach((sa) => els.push({ index: i++, type: "ST", text: `ST ${sa.seat} - P${sa.pax}` }));
  // FA = ticket-number element, same code real Amadeus uses once TTP has
  // actually issued a document (as opposed to TK.OK/TKTL, which is only
  // the arrangement to ticket later).
  (pnr.tickets ?? []).forEach((t) =>
    els.push({
      index: i++,
      type: "FA",
      text: `FA PAX ${t.passenger}  ${t.number}/ET${t.fop}/${t.currency} ${t.amount.toFixed(2)}/${t.issueDate}`,
    })
  );
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
  else if (target.type === "FA") pnr.tickets.splice(pos, 1);
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
    AN: "AN<ddMMM><ORIG><DEST>[<HHMM>|<HHA>][/A<CX>][/C<CLS>][/K<CABIN>][/X<PT>] -- air availability. Options: /A airline, /C class, /K cabin (F/C/W/M), /X connecting point, HHMM or HHA = flights from ~1hr before that time. e.g. AN15DECLONBKK, AN18AUGHKGSIN0900, AN18AUGHKGSIN09A/CQ",
    SN: "SN<ddMMM><ORIG><DEST>[...] -- schedule display. Same entry & options as AN (shows all flights regardless of open availability).",
    TN: "TN<ddMMM><ORIG><DEST> -- timetable: every flight on that city pair for a 7-day period, with days of operation.",
    DO: "DO<n> (follow-up to an AN/SN line) OR DO<CX><FLT>/<ddMMM><ORIG><DEST> (direct entry) -- detailed flight information for one flight.",
    AC: "AC<ddMMM> change date | AC<n>/AC-<n> shift n days | MN move to next day | MY move to previous day | MPAN return to the previous availability display.",
    SS: "SS<n><CLASS><LINE>[/<PRIORITY>] -- sell n seats, class, from an availability line; add /<code> (e.g. /PE) to set a waitlist priority code when the line shows 0 seats. SS<n><C1><L1>*<C2><L2> -- Dual City Pair sell, one class/line from each half of a dual (AN...*...) display. e.g. SS1Y1, SS2F3/PE, SS1F2*C12",
    NM: "NM<n><LAST>/<FIRST> <TITLE> -- add a passenger name (n = how many names in this entry). Chain more with '/': NM2REYES/HANS MR/HEIDI MS. Child: NM1BRADLEY/MICHAEL MSTR(CHD/12DEC16). Infant, same surname: NM1BROSNAN/SUZANNE MS(INF/PAULINE/01NOV20). Infant, different surname: NM1CRUZ/JANE MS(INFVICTOR/JOHN/12NOV20). Infant as its own seated passenger: NM1SUMMER/DIANA(INS), then SR INFT.",
    NU: "NU<n>/<FIRST> <TITLE>[(CHD/ddMMMyy)|(INF/first/ddMMMyy)] -- Name Update: change passenger n's first name/title or CHD/INF modifier without recreating the PNR. NU<n>/ (nothing after the slash) removes the CHD/INF modifier. e.g. NU1/GRACE MS",
    SR: "SR INFT - <freeflow text> /P<n> -- request a seat for an infant registered as its own (INS) passenger, associated with adult/passenger n. e.g. SR INFT - 11MTHS OCCUPYING SEAT/P1",
    AP: "AP <phone> | APM <mobile> | APH <home> | APE <email> -- contact elements.",
    TK: "TKOK -- no time limit. TKTL<ddMMM>/<hhmm> -- ticketing time limit.",
    RF: "RF <name/initials> -- Received From. Your signature, required before ER.",
    RM: "RM <text> -- a free-text remark.",
    OS: "OS <text> -- Other Service Information (displays as an OSI element).",
    SI: "SIARNK -- Arrival Unknown segment: an information-only segment that keeps itinerary continuity when the passenger changes transport mode mid-trip.",
    SO: "SO<CX><CLASS>[<ddMMM>]<ORIG><DEST> -- Open Flight Segment: no confirmed flight/date yet, keeps segment continuity for pricing/ticketing. A fictitious date is recommended. e.g. SOAFC8AUGCDGMNL, or without a date: SOAFCCDGMNL",
    RTSVC: "RTSVC -- flight service information for the last segment sold (shown after a waitlisted SS).",
    FFN: "FFN <CARRIER-NUMBER> -- attach a frequent flyer number. e.g. FFN BA-1234567",
    RT: "RT -- redisplay the active PNR. RT<LOCATOR> -- retrieve a saved PNR by record locator. RT/<SURNAME> -- retrieve by family name.",
    ER: "ER -- End & Retrieve: saves the PNR, hands back a record locator, and leaves the PNR open on screen. Requires the 5 mandatory elements.",
    ET: "ET -- End Transaction: saves the PNR (same 5 mandatory elements as ER) and clears the work area so you can start the next booking straight away.",
    IG: "IG -- during creation (PNR never saved), discards everything. On an already-saved PNR you're modifying, ignores your changes and reverts to the last-saved form instead.",
    IR: "IR -- after ending a PNR, redisplay the airline's own record locator for each air segment (partial copy of the PNR).",
    JA: "JA..JF -- jump to work area A-F. Each area holds its own PNR in progress, so you can work several bookings side by side. JO shows what's in each area.",
    JO: "JO -- work area status: which of areas A-F are empty, in progress, or holding a saved PNR.",
    XE: "XE<n> -- cancel element number n. XE<a>-<b> -- cancel a range. XE<a>,<b> -- cancel selected elements. Numbering comes from RT.",
    DAC: "DAC<code> -- decode a city/airport code to its name.",
    DAN: "DAN <text> -- encode a city name to its code.",
    FXP: "FXP -- fare quote for every real (non-ARNK) segment in the active PNR. Stores the result as a TST (T01, T02...) ready for ticketing.",
    FP: "FP CASH | FP CHEQUE | FP CC<2-letter vendor code><card number>/<MMYY> -- form of payment, e.g. FP CASH or FPCCVI4444333322221111/0128. Required before TTP will issue.",
    TTP: "TTP -- Ticketing Transactional Print: issues an actual ticket for every passenger on a SAVED PNR (needs a locator from ER/ET), using the latest unused TST and the FP on file. Refuses if any segment is still waitlisted (HL).",
    SM: "SM<n> -- seat map for segment n (defaults to the last segment sold).",
    ST: "ST/<seat>/P<n> -- assign a seat to passenger n. e.g. ST/24A/P1",
    CLS: "CLS -- clear the screen. Trainer convenience, not a real Amadeus entry.",
  };
  return t[topic] ? [t[topic]] : [`NO HELP AVAILABLE FOR "${topic}" -- TYPE HE FOR THE FULL LIST`];
}

function classesLine(classes: ClassStatus[]): string {
  return classes.map((c) => `${c.code}${c.status}`).join(" ");
}

function renderAvailBlock(kind: "AN" | "SN", dateCode: string, origin: string, dest: string, rows: FlightRow[], notes: string[]): string[] {
  const out: string[] = [];
  out.push(
    `** AMADEUS ${kind === "SN" ? "SCHEDULE" : "AVAILABILITY"} - ${kind} ** ${dest} ${cityName(dest)}.${countryCode(dest)}   ` +
      `${daysBetweenToday(dateCode)} ${dowOf(dateCode)} ${dateCode} 0000`
  );
  notes.forEach((n) => out.push(`** ${n} **`));
  if (rows.length === 0) {
    out.push(" NO FLIGHTS MATCH THIS AVAILABILITY REQUEST");
    return out;
  }
  rows.forEach((r) => {
    out.push(
      ` ${String(r.line).padStart(2, " ")} ${r.carrier} ${pad(r.flightNo, 4)} ${classesLine(r.classes)}` +
        ` /${r.origin}${r.originTerm}  ${r.dest}${r.destTerm}  ${r.depTime}  ${r.arrTime}  ` +
        `E${r.stops}${r.access}${r.aircraft}  ${r.elapsed}`
    );
  });
  return out;
}

export function processCommand(raw: string, state: EngineState): CmdResult {
  const input = raw.trim();
  const cmd = input.toUpperCase();
  const out: string[] = [];
  const s: EngineState = {
    lastAvailability: state.lastAvailability,
    lastQuery: state.lastQuery,
    previousQuery: state.previousQuery,
    activePNR: {
      ...state.activePNR,
      names: [...state.activePNR.names],
      segments: [...state.activePNR.segments],
      contacts: [...state.activePNR.contacts],
      remarks: [...state.activePNR.remarks],
      osi: [...state.activePNR.osi],
      seatAssignments: [...state.activePNR.seatAssignments],
      tst: [...(state.activePNR.tst ?? [])],
      tickets: [...(state.activePNR.tickets ?? [])],
    },
    savedPNRs: { ...state.savedPNRs },
    area: state.area ?? "A",
    parked: { ...(state.parked ?? {}) },
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
      "AN / SN <ddMMM><ORIG><DEST>   AVAILABILITY / SCHEDULE (see HE AN for options)",
      "AN...*...                     DUAL CITY PAIR (OUTBOUND*INBOUND) AVAILABILITY",
      "AC<ddMMM> / AC<n> / AC-<n>    CHANGE THE DATE ON THE LAST AVAILABILITY DISPLAY",
      "MN / MY / MPAN                MOVE NEXT DAY / MOVE YESTERDAY / PREVIOUS DISPLAY",
      "TN <ddMMM><ORIG><DEST>        TIMETABLE (7-DAY FLIGHT FREQUENCY)",
      "DO<n> / DO<CX><FLT>/<ddMMM><ORIG><DEST>   FLIGHT INFORMATION DISPLAY",
      "SS<n><CLASS><LINE>[/<CODE>]   SELL SEGMENT (append /CODE for waitlist priority, e.g. SS2F3/PE)",
      "SS<n><C1><L1>*<C2><L2>        DUAL CITY PAIR SELL (e.g. SS1F2*C12)",
      "SIARNK                        ARRIVAL UNKNOWN SEGMENT (keeps itinerary continuity)",
      "SO<CX><CLS>[<ddMMM>]<O><D>    OPEN FLIGHT SEGMENT (no confirmed date yet)",
      "RTSVC                         FLIGHT SERVICE INFO FOR THE LAST SEGMENT SOLD",
      "NM<n><LAST>/<FIRST> <TTL>     ADD NAME(S) -- chain with '/', or (CHD/..)/(INF/../..)/(INS)",
      "NU<n>/<FIRST> <TTL>[(...)]    NAME UPDATE -- edit passenger n's name/title/CHD-INF modifier",
      "SR INFT - <TEXT> /P<n>        REQUEST A SEAT FOR AN (INS) INFANT, TIED TO PASSENGER n",
      "AP / APM / APH / APE <text>   CONTACT (PHONE/MOBILE/HOME/EMAIL)",
      "TKOK | TKTL<ddMMM>/<hhmm>     TICKETING ARRANGEMENT",
      "RF <NAME>                     RECEIVED FROM (mandatory before ER)",
      "RM <TEXT>                     REMARK",
      "OS <TEXT>                     OTHER SERVICE INFO (shows as OSI)",
      "FFN <CARRIER-NUMBER>          FREQUENT FLYER NUMBER",
      "FXP                           FARE QUOTE FOR ACTIVE PNR (CREATES A TST)",
      "FP CASH|CHEQUE|CC<VV>../<MMYY> FORM OF PAYMENT (needed before ticketing)",
      "TTP                           ISSUE TICKET(S) FOR A SAVED PNR (needs FXP + FP)",
      "SM<n>                         SEAT MAP (n = segment, default last)",
      "ST/<SEAT>/P<n>                ASSIGN A SEAT",
      "XE<n> / XE<a>-<b> / XE<a>,<b> CANCEL ELEMENT n / A RANGE / SELECTED ELEMENTS",
      "RT                            DISPLAY ACTIVE PNR",
      "RT<LOCATOR> / RT/<SURNAME>    RETRIEVE A SAVED PNR (BY LOCATOR OR FAMILY NAME)",
      "ER                            END TRANSACTION & REDISPLAY -- SAVE, PNR STAYS OPEN",
      "ET                            END TRANSACTION -- SAVE, THEN CLEAR THE AREA",
      "IG                            IGNORE -- DISCARD IF NEW, OR REVERT TO LAST SAVE IF MODIFYING",
      "IR                            SHOW THE AIRLINE RECORD LOCATOR FOR EACH AIR SEGMENT",
      "JA..JF / JO                   JUMP TO WORK AREA A-F / SHOW AREA STATUS",
      "DAC<CODE> / DAN <TEXT>        DECODE / ENCODE A CITY",
      "CLS                           CLEAR SCREEN (trainer convenience only)",
      "HE <TOPIC>                    HELP ON ONE ENTRY, e.g. HE TKTL",
      "--------------------------------------------------"
    );
    return { lines: out, state: s };
  }

  // ---- AN / SN, including dual-city-pair (AN<leg1>*<leg2>) and options ----
  if (/^(AN|SN)\d/.test(cmd)) {
    const kind = cmd.slice(0, 2) as "AN" | "SN";
    const rest = cmd.slice(2);
    const legRe = /^(\d{2})([A-Z]{3})([A-Z]{3})([A-Z]{3})(\d{4}|\d{2}[AP])?((?:\/[A-Z0-9]+)*)$/;

    function parseLeg(legStr: string) {
      const m = legStr.match(legRe);
      if (!m) return null;
      const [, dd, mon, origin, dest, timeQual, qualStr] = m;
      if (!MONTHS.includes(mon)) return "BADMONTH" as const;
      let afterHour: number | undefined;
      if (timeQual) {
        if (/^\d{4}$/.test(timeQual)) afterHour = parseInt(timeQual.slice(0, 2), 10);
        else afterHour = parseInt(timeQual.slice(0, 2), 10) + (timeQual.endsWith("P") ? 12 : 0);
      }
      const quals = qualStr ? qualStr.split("/").filter(Boolean) : [];
      return { dateCode: `${dd}${mon}`, origin, dest, quals, afterHour };
    }

    if (rest.includes("*")) {
      const [leg1Str, leg2Str] = rest.split("*");
      const leg1 = parseLeg(leg1Str);
      const leg2 = parseLeg(leg2Str);
      if (!leg1 || !leg2 || leg1 === "BADMONTH" || leg2 === "BADMONTH") {
        out.push("FORMAT INVALID - DUAL CITY PAIR ENTRY, e.g. AN23SEPMNLHKG/ACX*26SEPHKGSIN/ASQ");
        return { lines: out, state: s };
      }
      const q1 = parseQualifiers(leg1.quals);
      if (leg1.afterHour !== undefined) q1.afterHour = leg1.afterHour;
      const q2 = parseQualifiers(leg2.quals);
      if (leg2.afterHour !== undefined) q2.afterHour = leg2.afterHour;

      const rows1 = buildAvailability(leg1.dateCode, leg1.origin, leg1.dest, q1);
      const rows2raw = buildAvailability(leg2.dateCode, leg2.origin, leg2.dest, q2);
      const offset = rows1.length;
      const rows2 = rows2raw.map((r) => ({ ...r, line: r.line + offset }));

      out.push("OUTBOUND FLIGHTS BEGIN WITH LINE NO. 1");
      out.push(...renderAvailBlock(kind, leg1.dateCode, leg1.origin, leg1.dest, rows1, q1.notes));
      out.push("");
      out.push(`INBOUND FLIGHTS BEGIN WITH LINE NO. ${offset + 1}`);
      out.push(...renderAvailBlock(kind, leg2.dateCode, leg2.origin, leg2.dest, rows2, q2.notes));

      s.lastAvailability = [...rows1, ...rows2];
      s.previousQuery = s.lastQuery;
      s.lastQuery = { kind, dateCode: leg1.dateCode, origin: leg1.origin, dest: leg1.dest, quals: leg1.quals, afterHour: leg1.afterHour };
      return { lines: out, state: s };
    }

    const leg = parseLeg(rest);
    if (leg === "BADMONTH") {
      out.push("INVALID MONTH - USE 3 LETTER CODE (JAN,FEB,...)");
      return { lines: out, state: s };
    }
    if (!leg) {
      out.push(`FORMAT INVALID OR UNKNOWN ENTRY: ${cmd}  -  TYPE HE AN FOR HELP`);
      return { lines: out, state: s };
    }
    const q = parseQualifiers(leg.quals);
    if (leg.afterHour !== undefined) q.afterHour = leg.afterHour;
    const rows = buildAvailability(leg.dateCode, leg.origin, leg.dest, q);
    out.push(...renderAvailBlock(kind, leg.dateCode, leg.origin, leg.dest, rows, q.notes));
    s.lastAvailability = rows;
    s.previousQuery = s.lastQuery;
    s.lastQuery = { kind, dateCode: leg.dateCode, origin: leg.origin, dest: leg.dest, quals: leg.quals, afterHour: leg.afterHour };
    return { lines: out, state: s };
  }

  // ---- AC -- Availability Change ----
  const acMatch = cmd.match(/^AC(-?\d+|\d{2}[A-Z]{3})$/);
  if (acMatch || cmd === "MN" || cmd === "MY" || cmd === "MPAN") {
    if (!s.lastQuery) {
      out.push("NO PRIOR AVAILABILITY DISPLAY TO CHANGE - ENTER AN OR SN FIRST");
      return { lines: out, state: s };
    }
    if (cmd === "MPAN") {
      if (!s.previousQuery) {
        out.push("NO PREVIOUS AVAILABILITY DISPLAY ON FILE");
        return { lines: out, state: s };
      }
      const q = s.previousQuery;
      const qual = parseQualifiers(q.quals);
      if (q.afterHour !== undefined) qual.afterHour = q.afterHour;
      const rows = buildAvailability(q.dateCode, q.origin, q.dest, qual);
      out.push(...renderAvailBlock(q.kind, q.dateCode, q.origin, q.dest, rows, qual.notes));
      s.lastAvailability = rows;
      s.previousQuery = s.lastQuery;
      s.lastQuery = q;
      return { lines: out, state: s };
    }

    const lq = s.lastQuery;
    let newDateCode: string;
    if (cmd === "MN") newDateCode = shiftDate(lq.dateCode, 1);
    else if (cmd === "MY") newDateCode = shiftDate(lq.dateCode, -1);
    else {
      const val = acMatch![1];
      if (/^-?\d+$/.test(val)) newDateCode = shiftDate(lq.dateCode, parseInt(val, 10));
      else {
        if (!MONTHS.includes(val.slice(2))) {
          out.push("INVALID MONTH - USE 3 LETTER CODE (JAN,FEB,...)");
          return { lines: out, state: s };
        }
        newDateCode = val;
      }
    }
    const qual = parseQualifiers(lq.quals);
    if (lq.afterHour !== undefined) qual.afterHour = lq.afterHour;
    const rows = buildAvailability(newDateCode, lq.origin, lq.dest, qual);
    out.push(...renderAvailBlock(lq.kind, newDateCode, lq.origin, lq.dest, rows, qual.notes));
    s.lastAvailability = rows;
    s.previousQuery = lq;
    s.lastQuery = { ...lq, dateCode: newDateCode };
    return { lines: out, state: s };
  }

  // ---- TN -- Timetable Display ----
  const tnMatch = cmd.match(/^TN(\d{2})([A-Z]{3})([A-Z]{3})([A-Z]{3})$/);
  if (tnMatch) {
    const [, dd, mon, origin, dest] = tnMatch;
    if (!MONTHS.includes(mon)) {
      out.push("INVALID MONTH - USE 3 LETTER CODE (JAN,FEB,...)");
      return { lines: out, state: s };
    }
    const dateCode = `${dd}${mon}`;
    const endCode = shiftDate(dateCode, 6);
    const d = resolveDate(dateCode);
    const yy = String(d.getFullYear()).slice(-2);
    const rows = buildTimetable(dateCode, origin, dest);
    out.push(`${origin}${dest}`);
    out.push(`** AMADEUS - TN ** ${dest} ${cityName(dest)}.${countryCode(dest)}   ${dateCode}${yy} ${endCode}${yy}`);
    rows.forEach((r) => {
      out.push(
        ` ${r.line} ${r.carrier} ${pad(r.flightNo, 4)} ${pad(r.dow, 8)} ${r.origin}${r.originTerm}  ${r.dest}${r.destTerm}  ` +
          `${r.depTime}  ${r.arrTime}  ${r.stops}  ${r.effective}${yy} ${r.discontinue}   ${r.aircraft}  ${r.elapsed}`
      );
    });
    out.push("TO DISPLAY CONNECTIONS, ENTER -MD-");
    return { lines: out, state: s };
  }

  // ---- DO -- Flight Information Display ----
  // Follow-up: DO<n> off the last AN/SN. Direct entry: DO<CX><FLT>/<ddMMM><ORIG><DEST>
  const doFollowMatch = cmd.match(/^DO(\d+)$/);
  const doDirectMatch = cmd.match(/^DO([A-Z]{2})(\d{1,4})\/(\d{2})([A-Z]{3})([A-Z]{3})([A-Z]{3})$/);
  if (doFollowMatch || doDirectMatch) {
    let carrier: string, flightNo: string, dateCode: string, origin: string, dest: string;
    if (doFollowMatch) {
      const line = parseInt(doFollowMatch[1], 10);
      const row = s.lastAvailability.find((r) => r.line === line);
      if (!row) {
        out.push("INVALID LINE NUMBER - DISPLAY AVAILABILITY (AN/SN) FIRST");
        return { lines: out, state: s };
      }
      carrier = row.carrier;
      flightNo = row.flightNo;
      dateCode = row.date;
      origin = row.origin;
      dest = row.dest;
    } else {
      const [, cx, flt, dd, mon, org, dst] = doDirectMatch!;
      if (!MONTHS.includes(mon)) {
        out.push("INVALID MONTH - USE 3 LETTER CODE (JAN,FEB,...)");
        return { lines: out, state: s };
      }
      carrier = cx;
      flightNo = flt;
      dateCode = `${dd}${mon}`;
      origin = org;
      dest = dst;
    }
    const f = baseFlightDetails(carrier, flightNo, dateCode, origin, dest);
    const classes = classesForFlight(carrier, flightNo, dateCode);
    const dow = dowOf(dateCode);
    out.push(`* 1A PLANNED FLIGHT INFO *`);
    out.push(` ${carrier} ${flightNo}  ${daysBetweenToday(dateCode)} ${dow} ${dateCode}`);
    out.push(` APT ARR  DY DEP  DY CLASS/MEAL     EQP  GRND EFT   TTL`);
    out.push(` ${origin}       ${f.depTime}  ${dow}                              ${f.aircraft}`);
    out.push(
      ` ${dest}  ${f.arrTime}  ${dow}       ${classesLine(classes)}       ${f.elapsed} ${f.elapsed}`
    );
    out.push("COMMENTS-");
    out.push(`1.FROM ${origin} - DEPARTS TERMINAL ${f.originTerm}`);
    out.push(`2.TO ${dest} - ARRIVES TERMINAL ${f.destTerm}`);
    out.push("3.ENTIRE FLT- NON-SMOKING");
    out.push("4.ENTIRE FLT- ETICKET CANDIDATE");
    out.push("CONFIGURATION-");
    out.push(` ${f.aircraft} J0 Y${180 + (parseInt(f.aircraft, 10) % 100)}`);
    return { lines: out, state: s };
  }

  // Maps a line's access indicator (/ . * "") to the real Amadeus status
  // code shown once a seat is confirmed -- DK/LK/SS per the handout's
  // participation-level table. LL is used for a waitlisted sell.
  function accessCodeFor(access: string, waitlisted: boolean): string {
    if (waitlisted) return "LL";
    if (access === "/" || access === ".") return "DK";
    if (access === "*") return "LK";
    return "SS";
  }

  function sellOneLine(nStr: string, cls: string, line: number, priority?: string): { seg?: Segment; err?: string; waitlist?: boolean } {
    const row = s.lastAvailability.find((r) => r.line === line);
    if (!row) return { err: `INVALID LINE NUMBER ${line} - DISPLAY AVAILABILITY (AN) FIRST` };
    const classEntry = row.classes.find((c) => c.code === cls);
    if (!classEntry) return { err: `CLASS ${cls} NOT OFFERED ON LINE ${line} - NO AVAILABILITY` };
    const waitlist = classEntry.status === "0";
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
      accessCode: accessCodeFor(row.access, waitlist),
      waitlistPriority: waitlist ? priority : undefined,
      segType: "FLIGHT",
    };
    return { seg, waitlist };
  }

  // Dual City Pair sell: SS1F2*C12 -- one class/line from the first
  // availability display, another class/line from the second (e.g. after
  // an AN...*... dual-leg display). Real syntax per the handout.
  const ssDualMatch = cmd.match(/^SS(\d+)([A-Z])(\d+)\*([A-Z])(\d+)$/);
  if (ssDualMatch) {
    const [, nStr, cls1, l1, cls2, l2] = ssDualMatch;
    const r1 = sellOneLine(nStr, cls1, parseInt(l1, 10));
    if (r1.err) {
      out.push(r1.err);
      return { lines: out, state: s };
    }
    const r2 = sellOneLine(nStr, cls2, parseInt(l2, 10));
    if (r2.err) {
      out.push(r2.err);
      return { lines: out, state: s };
    }
    [r1, r2].forEach((r) => {
      s.activePNR.segments.push(r.seg!);
      const idx = getElements(s.activePNR).filter((e) => e.type === "SEG").slice(-1)[0]?.index;
      out.push(` ${idx}  ${r.seg!.carrier} ${pad(r.seg!.flightNo, 4)} ${r.seg!.bookClass}  ${r.seg!.date}  ${r.seg!.origin}${r.seg!.dest}  ${r.seg!.accessCode}1  ${r.seg!.depTime}  ${r.seg!.arrTime}`);
      if (r.waitlist) out.push(" *** SOLD INTO WAITLIST - CLASS SHOWED 0 SEATS ***");
    });
    return { lines: out, state: s };
  }

  // SS command: SS1Y1 (sell n, class, from availability line), optionally
  // with a trailing "/<priority code>" when the line is waitlist-only
  // (e.g. SS2F3/PE) -- the airline-specific waitlist priority code.
  const ssMatch = cmd.match(/^SS(\d+)([A-Z])(\d+)(?:\/([A-Z0-9]{1,3}))?$/);
  if (ssMatch) {
    const [, nStr, cls, lineStr, priority] = ssMatch;
    const line = parseInt(lineStr, 10);
    const r = sellOneLine(nStr, cls, line, priority);
    if (r.err) {
      out.push(r.err);
      return { lines: out, state: s };
    }
    if (!r.waitlist && priority) {
      out.push(`PRIORITY CODE "/${priority}" IGNORED - LINE ${line} CLASS ${cls} IS ALREADY CONFIRMED (NOT ON WAITLIST)`);
    }
    const seg = r.seg!;
    s.activePNR.segments.push(seg);
    const idx = getElements(s.activePNR).filter((e) => e.type === "SEG").slice(-1)[0]?.index;
    out.push(
      ` ${idx}  ${seg.carrier} ${pad(seg.flightNo, 4)} ${seg.bookClass}  ${seg.date}  ${nStr}  ${seg.origin}${seg.dest}  ${seg.accessCode}${nStr}${seg.waitlistPriority ? "/" + seg.waitlistPriority : ""}  ${seg.depTime}  ${seg.arrTime}`
    );
    if (r.waitlist) out.push(" *** SOLD INTO WAITLIST - CLASS SHOWED 0 SEATS *** TYPE RTSVC FOR SERVICE INFO");
    return { lines: out, state: s };
  }

  // SIARNK -- Arrival Unknown segment: an information segment that keeps
  // itinerary continuity when the passenger changes transport mode between
  // two points outside the PNR's flight segments.
  if (cmd === "SIARNK") {
    s.activePNR.segments.push({
      carrier: "", flightNo: "", bookClass: "", date: "", origin: "", dest: "", depTime: "", arrTime: "",
      status: "OK", segType: "ARNK",
    });
    const idx = getElements(s.activePNR).filter((e) => e.type === "SEG").slice(-1)[0]?.index;
    out.push(` ${idx}  ARNK`);
    return { lines: out, state: s };
  }

  // RTSVC -- display flight service info for the most recently sold segment
  // (shown after a waitlisted sell in the real system, per the handout).
  if (cmd === "RTSVC") {
    const segs = s.activePNR.segments.filter((sg) => sg.segType !== "ARNK" && sg.segType !== "OPEN");
    const last = segs[segs.length - 1];
    if (!last) {
      out.push("NO SEGMENT ON FILE");
      return { lines: out, state: s };
    }
    out.push(`** SERVICE INFORMATION ** ${last.carrier}${last.flightNo} ${last.date} ${last.origin}${last.dest}`);
    out.push(`  STATUS: ${last.status === "HL" ? "WAITLISTED" : "CONFIRMED"} (${last.accessCode}${last.waitlistPriority ? "/" + last.waitlistPriority : ""})`);
    out.push("  MEAL: NOT SPECIFIED   SEAT: NOT ASSIGNED (USE SM/ST)");
    return { lines: out, state: s };
  }

  // SOAFC8AUGCDGMNL -- Open Flight Segment: airline code, class, an
  // optional fictitious date (ddMON), and the origin/destination. Maintains
  // segment continuity for pricing/ticketing when the exact date isn't
  // known yet.
  const soMatch = cmd.match(/^SO([A-Z]{2})([A-Z])(?:(\d{1,2}[A-Z]{3}))?([A-Z]{3})([A-Z]{3})$/);
  if (soMatch) {
    const [, carrier, cls, dateRaw, origin, dest] = soMatch;
    const dateCode = dateRaw ? dateRaw.replace(/^(\d)([A-Z])/, "0$1$2") : undefined;
    if (dateCode && !MONTHS.includes(dateCode.slice(2))) {
      out.push("INVALID MONTH - USE 3 LETTER CODE (JAN,FEB,...)");
      return { lines: out, state: s };
    }
    s.activePNR.segments.push({
      carrier, flightNo: "OPEN", bookClass: cls, date: dateCode ?? "", origin, dest,
      depTime: "", arrTime: "", status: "OK", segType: "OPEN",
    });
    const idx = getElements(s.activePNR).filter((e) => e.type === "SEG").slice(-1)[0]?.index;
    out.push(` ${idx}  ${carrier}OPEN  ${cls}  ${dateCode ?? "(NO DATE)"}  ${origin}${dest}`);
    if (!dateCode) out.push("  NOTE: A FICTITIOUS DATE IS RECOMMENDED FOR PRICING AND TICKETING");
    return { lines: out, state: s };
  }

  // NM<n><SURNAME>/<FIRST> <TITLE>[(CHD/ddMMMyy)|(INF[surname]/first/ddMMMyy)|(INS)]
  //   [/<FIRST2> <TITLE2>...] -- one family-name entry, optionally holding
  // several passengers sharing that surname (NM2REYES/HANS MR/HEIDI MS),
  // a child modifier, or an attached infant, per the handout's Name Element
  // and Infant's Name tables.
  const nmHeadMatch = raw.match(/^NM(\d+)([A-Za-z]+)\s*\/\s*(.+)$/i);
  if (nmHeadMatch) {
    const [, countStr, surnameRaw, bodyRaw] = nmHeadMatch;
    const surname = surnameRaw.toUpperCase();
    // Protect slashes that fall inside parentheses (e.g. "(INF/PAULINE/01NOV20)")
    // before splitting the rest of the entry on "/".
    let protectedBody = "";
    let depth = 0;
    for (const ch of bodyRaw) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      protectedBody += ch === "/" && depth > 0 ? "\u0001" : ch;
    }
    const chunks = protectedBody.split("/").map((p) => p.replace(/\u0001/g, "/").trim());
    const added: Name[] = [];
    let formatError: string | null = null;
    chunks.forEach((chunk) => {
      if (formatError || !chunk) return;
      const m = chunk.match(/^([A-Za-z]+)(?:\s+([A-Za-z]+))?(?:\s*\(([^)]*)\))?$/);
      if (!m) {
        formatError = `FORMAT INVALID - COULD NOT READ "${chunk}"`;
        return;
      }
      const [, first, titleRaw, modifierRaw] = m;
      const n: Name = { last: surname, first: first.toUpperCase(), title: titleRaw?.toUpperCase() };
      if (modifierRaw) {
        const mod = modifierRaw.trim().toUpperCase();
        if (mod.startsWith("CHD/")) {
          n.paxType = "CHD";
          n.childDob = mod.slice(4).trim();
        } else if (mod.startsWith("INF/")) {
          const [infFirst, infDob] = mod.slice(4).split("/").map((x) => x.trim());
          n.infant = { last: surname, first: infFirst, dob: infDob ?? "" };
        } else if (mod.startsWith("INF")) {
          // INF<SURNAME>/<FIRST>/<DOB> -- infant with a different surname
          const rest = mod.slice(3);
          const [infLast, infFirst, infDob] = rest.split("/").map((x) => x.trim());
          n.infant = { last: infLast, first: infFirst ?? "", dob: infDob ?? "" };
        } else if (mod === "INS") {
          n.paxType = "INF";
        } else {
          formatError = `UNKNOWN MODIFIER "(${modifierRaw})" - USE (CHD/ddMMMyy), (INF/first/ddMMMyy) OR (INS)`;
          return;
        }
      }
      added.push(n);
    });
    if (formatError) {
      out.push(formatError);
      return { lines: out, state: s };
    }
    if (added.length === 0) {
      out.push("FORMAT INVALID - EXPECTED NM<n><SURNAME>/<FIRST> <TITLE>");
      return { lines: out, state: s };
    }
    const expected = parseInt(countStr, 10);
    if (expected !== added.length) {
      out.push(`NOTE: ENTRY SAID ${expected} PASSENGER(S) BUT ${added.length} NAME(S) WERE READ - CHECK YOUR SLASH COUNT`);
    }
    added.forEach((n) => s.activePNR.names.push(n));
    const allIdx = getElements(s.activePNR).filter((e) => e.type === "NM");
    added.forEach((_, k) => {
      const el = allIdx[allIdx.length - added.length + k];
      out.push(` ${el.index}.${el.text}`);
    });
    if (added.some((n) => n.paxType === "CHD")) out.push(" (OSI ELEMENT AUTO-CREATED FOR CHILD NAME)");
    return { lines: out, state: s };
  }

  // SR INFT - <freeflow> /P<n> -- request a seat for an infant registered
  // as its own passenger (INS), associating it with adult/passenger n.
  const srInftMatch = raw.match(/^SR\s+INFT\s*[-\u2013]\s*(.+)\/P(\d+)$/i);
  if (srInftMatch) {
    const [, freeflow, paxStr] = srInftMatch;
    const idxNm = s.activePNR.names[parseInt(paxStr, 10) - 1];
    if (!idxNm) {
      out.push(`NO PASSENGER NUMBER P${paxStr} ON THE PNR`);
      return { lines: out, state: s };
    }
    s.activePNR.osi.push(`SR INFT ${freeflow.trim()} - P${paxStr}`);
    const idx = getElements(s.activePNR).filter((e) => e.type === "OSI").slice(-1)[0]?.index;
    out.push(` ${idx}.SSR INFT HK1 ${freeflow.trim().toUpperCase()} /P${paxStr}`);
    return { lines: out, state: s };
  }

  // NU<n>/<first> <title>[(CHD/ddMMMyy)|(INF.../ddMMMyy)]  -- Name Update:
  // modify the first name (and CHD/INF modifier) of an existing passenger
  // without recreating the PNR. NU<n>/ with nothing after the slash clears
  // any CHD/INF modifier on that passenger.
  const nuMatch = raw.match(/^NU(\d+)\/(.*)$/i);
  if (nuMatch) {
    const [, nStr, bodyRaw] = nuMatch;
    const idx = parseInt(nStr, 10) - 1;
    const existing = s.activePNR.names[idx];
    if (!existing) {
      out.push(`NO PASSENGER NUMBER ${nStr} ON THE PNR`);
      return { lines: out, state: s };
    }
    const body = bodyRaw.trim();
    if (!body) {
      // NU4/ -- deletes an infant name or passenger type code attached
      existing.paxType = undefined;
      existing.childDob = undefined;
      existing.infant = undefined;
      out.push(` ${idx + 1}.${existing.last}/${existing.first}${existing.title ? " " + existing.title : ""} - CHD/INF MODIFIER REMOVED`);
      return { lines: out, state: s };
    }
    const m = body.match(/^([A-Za-z]+)?(?:\s+([A-Za-z]+))?(?:\s*\(([^)]*)\))?$/);
    if (!m) {
      out.push(`FORMAT INVALID - COULD NOT READ "${body}"`);
      return { lines: out, state: s };
    }
    const [, first, titleRaw, modifierRaw] = m;
    if (first) existing.first = first.toUpperCase();
    if (titleRaw) existing.title = titleRaw.toUpperCase();
    if (modifierRaw) {
      const mod = modifierRaw.trim().toUpperCase();
      if (mod.startsWith("CHD/")) {
        existing.paxType = "CHD";
        existing.childDob = mod.slice(4).trim();
      } else if (mod.startsWith("INF/")) {
        const [infFirst, infDob] = mod.slice(4).split("/").map((x) => x.trim());
        existing.infant = { last: existing.last, first: infFirst, dob: infDob ?? "" };
      }
    }
    const el = getElements(s.activePNR).find((e) => e.type === "NM" && s.activePNR.names[idx] === existing);
    out.push(` ${idx + 1}.${existing.last}/${existing.first}${existing.title ? " " + existing.title : ""}${existing.paxType === "CHD" && existing.childDob ? `(CHD/${existing.childDob})` : ""}${existing.infant ? `(INF/${existing.infant.first}/${existing.infant.dob})` : ""} UPDATED`);
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

  // FXP - fare quote. Real Amadeus splits ticketing into two steps: price
  // the itinerary (this), which stores the result as a TST (Transitional
  // Stored Ticket, numbered T01/T02...), and later actually issue against
  // that TST with TTP. TKOK/TKTL is a separate thing -- just an arrangement
  // to ticket by some point, not a price and not a ticket.
  if (cmd === "FXP") {
    if (s.activePNR.segments.filter((sg) => sg.segType !== "ARNK").length === 0) {
      out.push("NO SEGMENTS IN PNR - SELL (SS) BEFORE PRICING");
      return { lines: out, state: s };
    }
    let base = 0;
    s.activePNR.segments.filter((seg) => seg.segType !== "ARNK").forEach((seg, i) => {
      const r = seededRand(seg.flightNo + seg.bookClass, i);
      base += 120 + (r % 480);
    });
    const yq = Math.round(base * 0.1);
    const xt = Math.round(base * 0.08);
    const total = base + yq + xt;
    const tstId = `T${String(s.activePNR.tst.length + 1).padStart(2, "0")}`;
    s.activePNR.tst.push({ id: tstId, base, tax: yq + xt, taxCode: "YQ/XT", total, currency: "USD", used: false });
    out.push("** FARE QUOTE - FXP **");
    s.activePNR.segments
      .filter((seg) => seg.segType !== "ARNK")
      .forEach((seg) => out.push(`  ${seg.segType === "OPEN" ? seg.carrier + "OPEN" : seg.carrier + pad(seg.flightNo, 4)} ${seg.bookClass}  ${seg.origin}${seg.dest}`));
    out.push(`  FARE          USD ${base.toFixed(2)}`);
    out.push(`  TAX   YQ      USD ${yq.toFixed(2)}`);
    out.push(`  TAX   XT      USD ${xt.toFixed(2)}`);
    out.push(`  TOTAL         USD ${total.toFixed(2)}`);
    out.push(`  ${tstId} CREATED - FARE STORED. ADD FP (FORM OF PAYMENT), THEN TTP TO ISSUE.`);
    return { lines: out, state: s };
  }

  // FP - form of payment. Real syntax: FP CASH | FP CHEQUE |
  // FP CC<2-letter vendor code><card number>/<MMYY expiry>, e.g.
  // FPCCVI4444333322221111/0128 (VI = Visa). Needed before TTP will issue.
  if (cmd === "FP") {
    out.push("FORMAT: FP CASH | FP CHEQUE | FP CC<VV><CARDNO>/<MMYY>  e.g. FPCCVI4444333322221111/0128");
    return { lines: out, state: s };
  }
  const fpMatch = raw.match(/^FP\s*(.+)$/i);
  if (fpMatch) {
    const val = fpMatch[1].trim().toUpperCase();
    if (val === "CASH" || val === "CHECK" || val === "CHEQUE") {
      s.activePNR.formOfPayment = val === "CHECK" ? "CHEQUE" : val;
      out.push(` FP ELEMENT ADDED - ${s.activePNR.formOfPayment}`);
      return { lines: out, state: s };
    }
    const ccMatch = val.match(/^CC\s*([A-Z]{2})\s*(\d{13,19})\s*\/\s*(\d{2})(\d{2})$/);
    if (ccMatch) {
      const [, vendor, number, mm, yy] = ccMatch;
      if (parseInt(mm, 10) < 1 || parseInt(mm, 10) > 12) {
        out.push("INVALID FORMAT - EXPIRY MONTH MUST BE 01-12");
        return { lines: out, state: s };
      }
      const masked = number.slice(0, 4) + "*".repeat(number.length - 8) + number.slice(-4);
      s.activePNR.formOfPayment = `CC${vendor} ${masked}/${mm}${yy}`;
      out.push(` FP ELEMENT ADDED - CC${vendor} ${masked}/${mm}${yy}`);
      return { lines: out, state: s };
    }
    out.push("INVALID FORMAT - USE FP CASH, FP CHEQUE, OR FP CC<VV><CARDNO>/<MMYY> e.g. FPCCVI4444333322221111/0128");
    return { lines: out, state: s };
  }

  // TTP - Ticketing Transactional Print: the entry that actually issues a
  // ticket document (as opposed to TKOK/TKTL, which is only a promise to
  // ticket later). Requires the PNR to already be saved, an unused TST from
  // FXP, a form of payment, and no waitlisted (HL) segments.
  if (cmd === "TTP") {
    if (!s.activePNR.locator) {
      out.push("PNR NOT ON FILE - SAVE WITH ER OR ET BEFORE TICKETING");
      return { lines: out, state: s };
    }
    if (s.activePNR.names.length === 0) {
      out.push("NO NAME(S) ON THE PNR");
      return { lines: out, state: s };
    }
    const waitlisted = s.activePNR.segments.filter((seg) => seg.status === "HL");
    if (waitlisted.length > 0) {
      out.push("UNABLE TO ISSUE - SEGMENT(S) STILL WAITLISTED (HL):");
      waitlisted.forEach((seg) => out.push(`  ${seg.carrier}${pad(seg.flightNo, 4)} ${seg.bookClass}  ${seg.origin}${seg.dest}`));
      return { lines: out, state: s };
    }
    const unused = s.activePNR.tst.filter((t) => !t.used);
    if (unused.length === 0) {
      out.push("NO FARE ON FILE - PRICE THE PNR WITH FXP BEFORE TICKETING");
      return { lines: out, state: s };
    }
    if (!s.activePNR.formOfPayment) {
      out.push("NO FORM OF PAYMENT ON FILE - ADD ONE WITH FP BEFORE TICKETING");
      return { lines: out, state: s };
    }
    const tst = unused[unused.length - 1];
    tst.used = true;
    const carrier = s.activePNR.segments[0]?.carrier ?? "XX";
    const today = new Date();
    const issueDate = `${String(today.getDate()).padStart(2, "0")}${MONTHS[today.getMonth()]}${String(today.getFullYear()).slice(-2)}`;
    const fopShort = s.activePNR.formOfPayment.startsWith("CC") ? s.activePNR.formOfPayment.slice(0, 4).trim() : s.activePNR.formOfPayment;
    out.push("** TICKET(S) ISSUED - TTP **");
    s.activePNR.names.forEach((n) => {
      const number = genTicketNumber(carrier);
      const passenger = `${n.last}/${n.first}${n.title ? " " + n.title : ""}`;
      s.activePNR.tickets.push({
        passenger,
        number,
        validatingCarrier: carrier,
        amount: tst.total,
        currency: tst.currency,
        fop: fopShort,
        issueDate,
      });
      out.push(`  ${pad(passenger, 24)} ${number}  ${tst.currency} ${tst.total.toFixed(2)}`);
    });
    s.savedPNRs[s.activePNR.locator] = s.activePNR;
    out.push(`PNR ${s.activePNR.locator} UPDATED WITH TICKET NUMBER(S) - SEE RT`);
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

  // XE<n> - cancel a single element | XE<a>-<b> - cancel a range |
  // XE<a>,<b>,... - cancel selected elements (handout's "Canceling PNR
  // Elements" table: XE4 / XE3-6 / XE5,7).
  const xeMatch = cmd.match(/^XE([\d,-]+)$/);
  if (xeMatch) {
    const spec = xeMatch[1];
    const indices = new Set<number>();
    let badToken: string | null = null;
    spec.split(",").forEach((tok) => {
      if (badToken) return;
      const rangeM = tok.match(/^(\d+)-(\d+)$/);
      if (rangeM) {
        const a = parseInt(rangeM[1], 10);
        const b = parseInt(rangeM[2], 10);
        if (a > b) { badToken = tok; return; }
        for (let i = a; i <= b; i++) indices.add(i);
      } else if (/^\d+$/.test(tok)) {
        indices.add(parseInt(tok, 10));
      } else {
        badToken = tok;
      }
    });
    if (badToken) {
      out.push(`FORMAT INVALID - "${badToken}" - USE XE<n>, XE<a>-<b> (RANGE), OR XE<a>,<b> (SELECTED)`);
      return { lines: out, state: s };
    }
    // Cancel highest index first so lower indices stay valid as the
    // element list is renumbered after each removal.
    const sorted = [...indices].sort((a, b) => b - a);
    const cancelled: number[] = [];
    const missing: number[] = [];
    sorted.forEach((idx) => {
      if (removeElement(s.activePNR, idx)) cancelled.push(idx);
      else missing.push(idx);
    });
    if (cancelled.length > 0) out.push(`ELEMENT(S) ${cancelled.sort((a, b) => a - b).join(",")} CANCELLED`);
    if (missing.length > 0) out.push(`NO ELEMENT NUMBER ${missing.sort((a, b) => a - b).join(",")} TO CANCEL`);
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
    // Real systems won't let a retrieve silently wipe a booking you're still
    // building. Unsaved work in this area must be ended (ER/ET) or ignored (IG)
    // first -- or just keep it and retrieve in another area (JB, JC...).
    if (pnrHasContent(s.activePNR) && !s.activePNR.locator) {
      out.push("ENTRY NOT VALID - THIS AREA HAS AN UNSAVED PNR IN PROGRESS");
      out.push("  ER/ET TO SAVE IT, IG TO DISCARD IT, OR JUMP TO A FREE AREA (E.G. JB)");
      return { lines: out, state: s };
    }
    s.activePNR = found;
    out.push(...renderPNR(found));
    return { lines: out, state: s };
  }

  // RT/<SURNAME> - retrieve saved PNR(s) by family name
  const rtName = cmd.match(/^RT\/([A-Z]+)$/);
  if (rtName) {
    const surname = rtName[1];
    const matches = Object.values(s.savedPNRs).filter((p) => p.names.some((n) => n.last === surname));
    if (matches.length === 0) {
      out.push(`NOT FOUND - NO SAVED PNR WITH FAMILY NAME ${surname}`);
      return { lines: out, state: s };
    }
    if (matches.length > 1) {
      out.push(`${matches.length} PNR(S) FOUND WITH FAMILY NAME ${surname} - RETRIEVE BY LOCATOR INSTEAD:`);
      matches.forEach((p) => out.push(`  ${p.locator}`));
      return { lines: out, state: s };
    }
    const found = matches[0];
    if (pnrHasContent(s.activePNR) && !s.activePNR.locator) {
      out.push("ENTRY NOT VALID - THIS AREA HAS AN UNSAVED PNR IN PROGRESS");
      out.push("  ER/ET TO SAVE IT, IG TO DISCARD IT, OR JUMP TO A FREE AREA (E.G. JB)");
      return { lines: out, state: s };
    }
    s.activePNR = found;
    out.push(...renderPNR(found));
    return { lines: out, state: s };
  }
  //   ER = end transaction AND REDISPLAY: PNR saved, stays on screen so you can
  //        keep working on it.
  //   ET = end transaction: PNR saved and the area is wiped, ready for the next
  //        booking. No IG needed.
  if (cmd === "ER" || cmd === "ET") {
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
    if (cmd === "ET") {
      out.push(`PNR ${locator} SAVED. AREA ${s.area} IS CLEAR FOR A NEW BOOKING.`);
      s.activePNR = emptyPNR();
    } else {
      out.push(...renderPNR(s.activePNR));
      out.push(`(PNR STILL OPEN IN AREA ${s.area} - ET WHEN DONE, OR IG TO CLEAR THE AREA)`);
    }
    return { lines: out, state: s };
  }

  // IG - ignore. During creation (never saved -- no locator yet), all
  // elements are discarded. When modifying an existing (already-saved) PNR,
  // IG instead ignores the updates and returns the PNR to its original,
  // last-saved form -- per the handout's IGNORE TRANSACTION section.
  if (cmd === "IG") {
    if (s.activePNR.locator && s.savedPNRs[s.activePNR.locator]) {
      const original = s.savedPNRs[s.activePNR.locator];
      s.activePNR = original;
      out.push(`IGNORED - ${original.locator}`);
      out.push(...renderPNR(original));
    } else {
      s.activePNR = emptyPNR();
      out.push(`IGNORED - AREA ${s.area} CLEARED`);
    }
    return { lines: out, state: s };
  }

  // IR - after ending a PNR, redisplay the airline's own record locator
  // (a partial copy of the PNR showing each segment with its airline RLOC),
  // per the handout's IGNORE and REDISPLAY section.
  if (cmd === "IR") {
    const segs = s.activePNR.segments.filter((sg) => sg.segType === "FLIGHT");
    if (segs.length === 0) {
      out.push("NO AIR SEGMENT ON FILE TO SHOW AN AIRLINE RECORD LOCATOR FOR");
      return { lines: out, state: s };
    }
    segs.forEach((seg) => {
      out.push(`  ${seg.carrier} ${pad(seg.flightNo, 4)} ${seg.bookClass}  ${seg.date}  ${seg.origin}${seg.dest}  ${seg.accessCode ?? seg.status}1  ${seg.depTime}  ${seg.arrTime}  ${seg.carrier}/${genLocator()}`);
    });
    return { lines: out, state: s };
  }

  // JA..JF - jump to another work area. Each keeps its own PNR in progress.
  const jMatch = cmd.match(/^J([A-F])$/);
  if (jMatch) {
    const target = jMatch[1];
    if (target === s.area) {
      out.push(`ALREADY IN AREA ${target}`);
      return { lines: out, state: s };
    }
    s.parked[s.area] = {
      lastAvailability: s.lastAvailability,
      lastQuery: s.lastQuery,
      previousQuery: s.previousQuery,
      activePNR: s.activePNR,
    };
    const next = s.parked[target];
    delete s.parked[target];
    s.area = target;
    s.lastAvailability = next?.lastAvailability ?? [];
    s.lastQuery = next?.lastQuery;
    s.previousQuery = next?.previousQuery;
    s.activePNR = next?.activePNR ?? emptyPNR();
    out.push(`AREA ${target} ACTIVE`);
    if (pnrHasContent(s.activePNR)) out.push(...renderPNR(s.activePNR));
    else out.push(" (EMPTY AREA - READY FOR A NEW BOOKING)");
    return { lines: out, state: s };
  }

  // JO - work area status
  if (cmd === "JO") {
    out.push("WORK AREAS ---------------------------------");
    WORK_AREAS.forEach((a) => {
      const pnr = a === s.area ? s.activePNR : s.parked[a]?.activePNR;
      const mark = a === s.area ? "*" : " ";
      if (!pnr || !pnrHasContent(pnr)) {
        out.push(` ${a}${mark} ${a === s.area ? "ACTIVE  " : "        "} EMPTY`);
      } else {
        const n = getElements(pnr).length;
        const st = pnr.locator ? `RLOC ${pnr.locator}` : "UNSAVED";
        out.push(` ${a}${mark} ${a === s.area ? "ACTIVE  " : "        "} ${n} ELEMENT(S) - ${st}`);
      }
    });
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
  if (pnr.formOfPayment) out.push(` FP.${pnr.formOfPayment}`);
  (pnr.tst ?? []).forEach((t) =>
    out.push(` TST.${t.id}  ${t.currency} ${t.total.toFixed(2)}  ${t.used ? "(USED)" : "(UNUSED - READY FOR TTP)"}`)
  );
  return out;
}
