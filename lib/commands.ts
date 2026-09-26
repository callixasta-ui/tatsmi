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

// Airline record for DNA (Decode/eNcode Airline) and for flight
// generation. Real Amadeus keys DNA off EITHER the 2-character IATA code
// (the one used in flight numbers and PNRs, e.g. "5J") OR the 3-letter
// ICAO code (used in ops/ATC contexts and often printed alongside the
// IATA code in the real DNA response, e.g. "CEB") -- both point at the
// same airline. numeric is the 3-digit IATA ticket-stock prefix, included
// in the real response where known; left undefined for carriers this
// trainer isn't confident on.
interface AirlineRecord {
  iata: string;
  icao: string;
  numeric?: string;
  name: string;
  // Real nonstop-route modeling, not just "is this a known airline": hubs
  // are the actual city/base codes this carrier operates from (matched
  // against LOCATIONS' city codes, e.g. "LON" not "LHR"). Since this demo
  // only generates nonstop flights (see FlightRow.stops, always 0), the
  // same rule real airline networks follow applies here: a carrier only
  // shows up on a route if ONE of the two endpoints is actually one of
  // its own hubs -- nonstop service radiates from a base, it doesn't
  // appear between two cities the airline has no presence in at all.
  // "global" reach carriers (the big legacy/Gulf/Asian flag carriers)
  // can be booked hub-to-anywhere; "regional" reach carriers (LCCs and
  // smaller flag carriers) are further limited to routes where the OTHER
  // end is inside one of their homeRegions -- e.g. Cebu Pacific reaches
  // East Asia/Oceania/the Gulf from Manila, but not Europe or the
  // Americas. Carriers whose real-world hub isn't in this trainer's
  // airport table (WY/Muscat, GF/Bahrain) get hubs: [] and so correctly
  // never appear -- same as real Amadeus has nothing to offer for a place
  // outside its database.
  hubs: string[];
  reach: "regional" | "global";
  homeRegions?: Region[]; // required (and only meaningful) when reach === "regional"
}

// Coarse commercial regions used only to bound where a "regional" carrier
// plausibly flies to from its hub -- not a precise geography, just enough
// to stop e.g. a Philippines-based LCC from turning up on a Europe-South
// America route.
type Region =
  | "NORTH_AMERICA"
  | "LATAM"
  | "EUROPE"
  | "MIDDLE_EAST"
  | "AFRICA"
  | "SOUTH_ASIA"
  | "EAST_ASIA"
  | "SOUTHEAST_ASIA"
  | "OCEANIA";

const REGION_BY_COUNTRY: Record<string, Region> = {
  US: "NORTH_AMERICA", CA: "NORTH_AMERICA",
  MX: "LATAM", BR: "LATAM", AR: "LATAM", PE: "LATAM", CO: "LATAM", CL: "LATAM",
  GB: "EUROPE", FR: "EUROPE", IT: "EUROPE", DE: "EUROPE", ES: "EUROPE", NL: "EUROPE",
  BE: "EUROPE", CH: "EUROPE", AT: "EUROPE", PT: "EUROPE", IE: "EUROPE", DK: "EUROPE",
  NO: "EUROPE", FI: "EUROPE", PL: "EUROPE", CZ: "EUROPE", HU: "EUROPE", GR: "EUROPE",
  SE: "EUROPE", RU: "EUROPE",
  AE: "MIDDLE_EAST", QA: "MIDDLE_EAST", SA: "MIDDLE_EAST", KW: "MIDDLE_EAST",
  JO: "MIDDLE_EAST", IL: "MIDDLE_EAST", TR: "MIDDLE_EAST",
  EG: "AFRICA", ZA: "AFRICA", KE: "AFRICA", NG: "AFRICA", ET: "AFRICA",
  IN: "SOUTH_ASIA", NP: "SOUTH_ASIA", BD: "SOUTH_ASIA", LK: "SOUTH_ASIA", PK: "SOUTH_ASIA",
  JP: "EAST_ASIA", KR: "EAST_ASIA", CN: "EAST_ASIA", TW: "EAST_ASIA", HK: "EAST_ASIA", MO: "EAST_ASIA",
  TH: "SOUTHEAST_ASIA", PH: "SOUTHEAST_ASIA", MY: "SOUTHEAST_ASIA", ID: "SOUTHEAST_ASIA",
  SG: "SOUTHEAST_ASIA", VN: "SOUTHEAST_ASIA", KH: "SOUTHEAST_ASIA", MM: "SOUTHEAST_ASIA",
  LA: "SOUTHEAST_ASIA", BN: "SOUTHEAST_ASIA",
  AU: "OCEANIA", NZ: "OCEANIA", FJ: "OCEANIA", GU: "OCEANIA",
};

// This is the single source of truth for every airline this trainer
// knows about: DNA decodes/encodes against it, AN/SN/TN generate flights
// using it (via CARRIERS below), and the /A<code> filter on those
// displays and ticket-number generation both resolve through it too --
// so an airline that's "real" in one command is real everywhere. Real
// Amadeus covers the full IATA/ICAO airline list; this is a curated
// subset of major carriers, and hubs/reach below are a best-effort real-
// world approximation, not a licensed route database.
const AIRLINE_RECORDS: AirlineRecord[] = [
  { iata: "BA", icao: "BAW", numeric: "125", name: "BRITISH AIRWAYS", hubs: ["LON"], reach: "global" },
  { iata: "LH", icao: "DLH", numeric: "220", name: "LUFTHANSA", hubs: ["FRA", "MUC"], reach: "global" },
  { iata: "AF", icao: "AFR", numeric: "057", name: "AIR FRANCE", hubs: ["PAR"], reach: "global" },
  { iata: "TG", icao: "THA", numeric: "217", name: "THAI AIRWAYS INTERNATIONAL", hubs: ["BKK"], reach: "global" },
  { iata: "SQ", icao: "SIA", numeric: "618", name: "SINGAPORE AIRLINES", hubs: ["SIN"], reach: "global" },
  { iata: "EK", icao: "UAE", numeric: "176", name: "EMIRATES", hubs: ["DXB"], reach: "global" },
  { iata: "QF", icao: "QFA", numeric: "081", name: "QANTAS AIRWAYS", hubs: ["SYD", "MEL", "BNE", "PER"], reach: "global" },
  { iata: "CX", icao: "CPA", numeric: "160", name: "CATHAY PACIFIC AIRWAYS", hubs: ["HKG"], reach: "global" },
  { iata: "AA", icao: "AAL", numeric: "001", name: "AMERICAN AIRLINES", hubs: ["CHI", "DFW", "MIA", "CLT", "PHX", "PHL", "NYC", "LAX"], reach: "global" },
  { iata: "UA", icao: "UAL", numeric: "016", name: "UNITED AIRLINES", hubs: ["CHI", "IAH", "DEN", "SFO", "WAS", "NYC", "LAX"], reach: "global" },
  { iata: "DL", icao: "DAL", numeric: "006", name: "DELTA AIR LINES", hubs: ["ATL", "DTW", "MSP", "SLC", "NYC", "SEA", "BOS", "LAX"], reach: "global" },
  { iata: "AC", icao: "ACA", numeric: "014", name: "AIR CANADA", hubs: ["YYZ", "YVR", "YUL", "YYC"], reach: "global" },
  { iata: "KL", icao: "KLM", numeric: "074", name: "KLM ROYAL DUTCH AIRLINES", hubs: ["AMS"], reach: "global" },
  { iata: "IB", icao: "IBE", numeric: "075", name: "IBERIA", hubs: ["MAD", "BCN"], reach: "global" },
  { iata: "AZ", icao: "ITY", numeric: "055", name: "ITA AIRWAYS", hubs: ["ROM", "MIL"], reach: "global" },
  { iata: "LX", icao: "SWR", numeric: "724", name: "SWISS INTERNATIONAL AIR LINES", hubs: ["ZRH", "GVA"], reach: "global" },
  { iata: "OS", icao: "AUA", numeric: "257", name: "AUSTRIAN AIRLINES", hubs: ["VIE"], reach: "global" },
  { iata: "TK", icao: "THY", numeric: "235", name: "TURKISH AIRLINES", hubs: ["IST"], reach: "global" },
  { iata: "QR", icao: "QTR", numeric: "157", name: "QATAR AIRWAYS", hubs: ["DOH"], reach: "global" },
  { iata: "EY", icao: "ETD", numeric: "607", name: "ETIHAD AIRWAYS", hubs: ["AUH"], reach: "global" },
  { iata: "SV", icao: "SVA", numeric: "065", name: "SAUDIA", hubs: ["RUH", "JED"], reach: "global" },
  { iata: "RJ", icao: "RJA", numeric: "512", name: "ROYAL JORDANIAN", hubs: ["AMM"], reach: "regional", homeRegions: ["MIDDLE_EAST", "EUROPE"] },
  { iata: "ET", icao: "ETH", numeric: "071", name: "ETHIOPIAN AIRLINES", hubs: ["ADD"], reach: "global" },
  { iata: "MS", icao: "MSR", numeric: "077", name: "EGYPTAIR", hubs: ["CAI"], reach: "global" },
  { iata: "KQ", icao: "KQA", numeric: "706", name: "KENYA AIRWAYS", hubs: ["NBO"], reach: "global" },
  { iata: "SA", icao: "SAA", numeric: "083", name: "SOUTH AFRICAN AIRWAYS", hubs: ["JNB"], reach: "global" },
  { iata: "NZ", icao: "ANZ", numeric: "086", name: "AIR NEW ZEALAND", hubs: ["AKL"], reach: "global" },
  { iata: "JQ", icao: "JST", name: "JETSTAR AIRWAYS", hubs: ["SYD", "MEL"], reach: "regional", homeRegions: ["OCEANIA", "SOUTHEAST_ASIA"] },
  { iata: "VA", icao: "VOZ", name: "VIRGIN AUSTRALIA", hubs: ["SYD", "BNE", "MEL"], reach: "regional", homeRegions: ["OCEANIA", "SOUTHEAST_ASIA", "NORTH_AMERICA"] },
  { iata: "NH", icao: "ANA", numeric: "205", name: "ALL NIPPON AIRWAYS", hubs: ["TYO"], reach: "global" },
  { iata: "JL", icao: "JAL", numeric: "131", name: "JAPAN AIRLINES", hubs: ["TYO"], reach: "global" },
  { iata: "KE", icao: "KAL", numeric: "180", name: "KOREAN AIR", hubs: ["SEL"], reach: "global" },
  { iata: "OZ", icao: "AAR", numeric: "988", name: "ASIANA AIRLINES", hubs: ["SEL"], reach: "global" },
  { iata: "CI", icao: "CAL", numeric: "297", name: "CHINA AIRLINES", hubs: ["TPE"], reach: "global" },
  { iata: "BR", icao: "EVA", numeric: "695", name: "EVA AIR", hubs: ["TPE"], reach: "global" },
  { iata: "MU", icao: "CES", numeric: "781", name: "CHINA EASTERN AIRLINES", hubs: ["PVG", "CTU"], reach: "global" },
  { iata: "CA", icao: "CCA", numeric: "999", name: "AIR CHINA", hubs: ["PEK"], reach: "global" },
  { iata: "CZ", icao: "CSN", numeric: "784", name: "CHINA SOUTHERN AIRLINES", hubs: ["CAN"], reach: "global" },
  { iata: "PR", icao: "PAL", numeric: "079", name: "PHILIPPINE AIRLINES", hubs: ["MNL", "CEB"], reach: "global" },
  { iata: "5J", icao: "CEB", numeric: "203", name: "CEBU PACIFIC AIR", hubs: ["MNL", "CEB"], reach: "regional", homeRegions: ["SOUTHEAST_ASIA", "EAST_ASIA", "OCEANIA", "MIDDLE_EAST"] },
  { iata: "MH", icao: "MAS", numeric: "232", name: "MALAYSIA AIRLINES", hubs: ["KUL"], reach: "global" },
  { iata: "AK", icao: "AXM", name: "AIRASIA", hubs: ["KUL"], reach: "regional", homeRegions: ["SOUTHEAST_ASIA", "EAST_ASIA", "SOUTH_ASIA"] },
  { iata: "GA", icao: "GIA", numeric: "126", name: "GARUDA INDONESIA", hubs: ["CGK", "DPS"], reach: "global" },
  { iata: "VN", icao: "HVN", numeric: "738", name: "VIETNAM AIRLINES", hubs: ["HAN", "SGN"], reach: "global" },
  { iata: "AI", icao: "AIC", numeric: "098", name: "AIR INDIA", hubs: ["DEL", "BOM"], reach: "global" },
  { iata: "6E", icao: "IGO", numeric: "312", name: "INDIGO", hubs: ["DEL", "BOM"], reach: "regional", homeRegions: ["SOUTH_ASIA", "SOUTHEAST_ASIA", "MIDDLE_EAST"] },
  { iata: "UL", icao: "ALK", numeric: "603", name: "SRILANKAN AIRLINES", hubs: ["CMB"], reach: "global" },
  { iata: "PK", icao: "PIA", numeric: "214", name: "PAKISTAN INTERNATIONAL AIRLINES", hubs: ["KHI", "ISB"], reach: "global" },
  { iata: "LA", icao: "LAN", numeric: "045", name: "LATAM AIRLINES", hubs: ["SCL", "SAO", "LIM", "BOG"], reach: "global" },
  { iata: "AV", icao: "AVA", numeric: "134", name: "AVIANCA", hubs: ["BOG"], reach: "global" },
  { iata: "AM", icao: "AMX", numeric: "139", name: "AEROMEXICO", hubs: ["MEX"], reach: "global" },
  { iata: "WS", icao: "WJA", numeric: "838", name: "WESTJET", hubs: ["YYC", "YYZ"], reach: "regional", homeRegions: ["NORTH_AMERICA", "LATAM", "EUROPE"] },
  { iata: "FZ", icao: "FDB", name: "FLYDUBAI", hubs: ["DXB"], reach: "regional", homeRegions: ["MIDDLE_EAST", "SOUTH_ASIA", "AFRICA", "EUROPE"] },
  { iata: "WY", icao: "OMA", numeric: "910", name: "OMAN AIR", hubs: [], reach: "global" }, // Muscat isn't in this trainer's airport table
  { iata: "GF", icao: "GFA", numeric: "072", name: "GULF AIR", hubs: [], reach: "global" }, // Bahrain isn't in this trainer's airport table
  { iata: "LY", icao: "ELY", numeric: "114", name: "EL AL ISRAEL AIRLINES", hubs: ["TLV"], reach: "global" },
];

const AIRLINES_BY_IATA: Record<string, AirlineRecord> = {};
const AIRLINES_BY_ICAO: Record<string, AirlineRecord> = {};
for (const rec of AIRLINE_RECORDS) {
  AIRLINES_BY_IATA[rec.iata] = rec;
  AIRLINES_BY_ICAO[rec.icao] = rec;
}

// "IATA/ICAO" or, for the rare record missing one side, whichever it has.
function airlineCodePair(rec: AirlineRecord): string {
  return `${rec.iata}/${rec.icao}`;
}

// Resolve whatever the user typed for a carrier -- IATA (e.g. "5J") or
// ICAO (e.g. "CEB"), any case -- to the canonical IATA code used
// internally for flight generation and filtering. Returns undefined if
// it isn't a carrier this trainer knows about at all.
function resolveCarrierCode(input: string): string | undefined {
  const code = input.trim().toUpperCase();
  return AIRLINES_BY_IATA[code]?.iata ?? AIRLINES_BY_ICAO[code]?.iata;
}

// Every airline this trainer knows about is a candidate for AN/SN/TN
// flight generation and for the /A<code> filter on those -- not just the
// original demo's 8. Keeps DNA and "what flights can I actually see"
// consistent with each other.
const CARRIERS = AIRLINE_RECORDS.map((r) => r.iata);
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
    if (opt === "A" && val) {
      const resolved = resolveCarrierCode(val);
      if (resolved) {
        q.carrierFilter = resolved;
      } else {
        // Keep the qualifier so results still come back empty rather than
        // silently ignoring it, but flag it -- same as real Amadeus giving
        // no matches for an unrecognized carrier.
        q.carrierFilter = val.toUpperCase();
        q.notes.push(`/A${val} -- "${val.toUpperCase()}" NOT IN THIS TRAINER'S AIRLINE TABLE (NO FLIGHTS WILL MATCH)`);
      }
    }
    else if (opt === "C" && val) {
      const cls = val[0].toUpperCase();
      q.classFilter = cls;
      if (!ALL_CLASSES.some((c) => c.code === cls)) {
        // /C takes a single booking-class LETTER (e.g. /CY), not an airline
        // code -- easy to mix up with /A. If what follows /C actually looks
        // like a real carrier (e.g. someone typed /CX meaning Cathay
        // Pacific), say so directly instead of leaving them to guess why
        // an otherwise-correct-looking entry came back empty.
        // The carrier code is "C" + val (e.g. token "CX" = the letter C
        // that introduces this qualifier, plus "X") -- so it's the whole
        // token, not val alone, that might actually be a 2-letter airline.
        const maybeCarrier = resolveCarrierCode(tok);
        if (maybeCarrier) {
          q.notes.push(
            `/${tok} -- "${cls}" IS NOT A VALID BOOKING CLASS. DID YOU MEAN /A${tok} (${AIRLINES_BY_IATA[maybeCarrier]?.name}) TO FILTER BY AIRLINE? (NO FLIGHTS WILL MATCH AS ENTERED)`
          );
        } else {
          q.notes.push(`/C${val} -- "${cls}" IS NOT A VALID BOOKING CLASS (NO FLIGHTS WILL MATCH)`);
        }
      }
    }
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

  // Real-route modeling: a carrier only becomes a candidate for this
  // route if airlineServesRoute() says it plausibly operates a nonstop
  // there (see that function -- hub-touch + reach tier). This applies to
  // BOTH the /A<code>-filtered case and the plain unfiltered display, so
  // a bare "AN15DECLONBKK" now only shows carriers with a real presence
  // at LON or BKK, not any of the ~55 airlines at random.
  const slots: { carrier: string; flightNo: string; seed: number }[] = [];
  if (q.carrierFilter) {
    if (CARRIERS.includes(q.carrierFilter) && airlineServesRoute(q.carrierFilter, origin, dest)) {
      // 6 candidates (not 1) so a carrier filter stacked with a time-of-
      // day or class/cabin filter still has decent odds of a survivor --
      // a real airline that genuinely serves this route shouldn't come
      // back empty just because this trainer only imagined one departure.
      for (let i = 1; i <= 6; i++) {
        const r = seededRand(dateCode + origin + dest + q.carrierFilter, i);
        slots.push({ carrier: q.carrierFilter, flightNo: String(100 + (r % 800)), seed: r });
      }
    }
    // else: either not a carrier this trainer knows (parseQualifiers already
    // flagged that), or a real carrier that just doesn't fly this route --
    // both correctly fall through to "NO FLIGHTS MATCH", same as real Amadeus.
  } else {
    const plausible = CARRIERS.filter((c) => airlineServesRoute(c, origin, dest));
    // Some city pairs genuinely aren't served nonstop by anyone in this
    // trainer's airline table -- plausible stays empty and so does the
    // display, which is itself realistic (a real GDS often needs -MD- /
    // a connection for an obscure pair too), not a bug.
    for (let i = 1; i <= 8 && plausible.length > 0; i++) {
      const r = seededRand(dateCode + origin + dest, i);
      slots.push({ carrier: plausible[r % plausible.length], flightNo: String(100 + (r % 800)), seed: r });
    }
  }

  for (const { carrier, flightNo, seed: r } of slots) {
    const base = baseFlightDetails(carrier, flightNo, dateCode, origin, dest);
    if (q.afterHour !== undefined) {
      const depHour = parseInt(base.depTime.slice(0, 2), 10);
      if (depHour < Math.max(0, q.afterHour - 1)) continue;
    }

    let classes = classesForFlight(carrier, flightNo, dateCode);
    if (q.cabinFilter) classes = classes.filter((c) => ALL_CLASSES.find((a) => a.code === c.code)?.cabin === q.cabinFilter);
    if (q.classFilter) classes = classes.filter((c) => c.code === q.classFilter);
    if (classes.length === 0) continue; // nothing sellable under these filters, real AN just skips the line

    // Real Amadeus: querying a multi-airport metro code (LON, NYC, PAR...)
    // returns each flight tagged with the specific airport it actually
    // uses, not the bare city code repeated on every line.
    const originResolved = resolveAirport(origin, r).airport;
    const destResolved = resolveAirport(dest, r >>> 3).airport;

    rows.push({
      line: line++,
      carrier,
      flightNo,
      classes,
      depTime: base.depTime,
      arrTime: base.arrTime,
      origin: originResolved,
      originTerm: base.originTerm,
      dest: destResolved,
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
  // Same real-route model as AN/SN (see airlineServesRoute): a timetable
  // should only list carriers that actually operate this city pair, not
  // any of the ~55 airlines at random. If nobody in this trainer's table
  // plausibly serves it, an empty timetable is the honest answer.
  const plausible = CARRIERS.filter((c) => airlineServesRoute(c, origin, dest));
  for (let i = 1; i <= 6 && plausible.length > 0; i++) {
    const r = seededRand("TN" + dateCode + origin + dest, i);
    const carrier = plausible[r % plausible.length];
    const flightNo = String(100 + (r % 800));
    const base = baseFlightDetails(carrier, flightNo, dateCode, origin, dest);
    const eff = shiftDate(dateCode, -((r >>> 10) % 120));
    const originResolved = resolveAirport(origin, r).airport;
    const destResolved = resolveAirport(dest, r >>> 3).airport;
    rows.push({
      line: i,
      carrier,
      flightNo,
      dow: DOW_PATTERNS[(r >>> 5) % DOW_PATTERNS.length],
      depTime: base.depTime,
      arrTime: base.arrTime,
      origin: originResolved,
      originTerm: base.originTerm,
      dest: destResolved,
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

// Ticket numbers are 3-digit airline code + 10-digit document number, where
// the document number's last digit is a check digit = (first 9 digits) mod 7
// -- the real IATA ticket-numbering rule, not an arbitrary format. Falls
// back to "999" for carriers this trainer doesn't have a confirmed
// IATA numeric prefix for (see AIRLINE_RECORDS above).
function genTicketNumber(carrier: string): string {
  const airlineCode = AIRLINES_BY_IATA[carrier]?.numeric ?? "999";
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

// ---------------------------------------------------------------------------
// Geography table -- mirrors the real Amadeus distinction between a
// *metropolitan/city* code (multiple airports may sit under it, e.g. LON,
// NYC, PAR, TYO) and a specific *airport* code (LHR, JFK, CDG, NRT...).
// AN/SN/TN accept either kind, same as the real system: query a city code
// and, if it covers several airports, each flight line comes back tagged
// with the *actual* airport it uses (not just the city code repeated);
// query an airport code directly and every line is pinned to that one
// airport. DAC/DAN both understand the city<->airport relationship.
// Coverage here is a large curated set of real-world major hubs, still far
// short of Amadeus's full worldwide database, but big enough that the
// city/airport mechanics themselves now work the way they do on the real
// system instead of being flattened into one 18-row demo table.
// ---------------------------------------------------------------------------

export type LocationType = "CITY" | "AIRPORT";

export interface LocationEntry {
  code: string;
  name: string; // display name (city name, or "City/Airport" for an airport)
  country: string; // full country name
  countryCode: string; // 2-letter
  type: LocationType;
  cityCode?: string; // for AIRPORT entries: the metropolitan city code it belongs to
}

// Metro (city) codes that cover more than one airport, and which airports
// belong to them -- the actual gap the old single flat table couldn't
// represent at all.
const CITY_AIRPORTS: Record<string, string[]> = {
  LON: ["LHR", "LGW", "STN", "LTN", "LCY"],
  NYC: ["JFK", "EWR", "LGA"],
  PAR: ["CDG", "ORY", "BVA"],
  TYO: ["NRT", "HND"],
  CHI: ["ORD", "MDW"],
  WAS: ["IAD", "DCA", "BWI"],
  MIL: ["MXP", "LIN", "BGY"],
  MOW: ["SVO", "DME", "VKO"],
  OSA: ["KIX", "ITM"],
  SEL: ["ICN", "GMP"],
  SAO: ["GRU", "CGH"],
  RIO: ["GIG", "SDU"],
  BUE: ["EZE", "AEP"],
  ROM: ["FCO", "CIA"],
  STO: ["ARN", "BMA", "NYO"],
  BER: ["BER"],
};

const LOCATIONS: Record<string, LocationEntry> = {};
function addCity(code: string, name: string, country: string, countryCode: string) {
  LOCATIONS[code] = { code, name, country, countryCode, type: "CITY" };
}
function addAirport(code: string, name: string, cityCode: string) {
  const city = LOCATIONS[cityCode];
  LOCATIONS[code] = {
    code,
    name,
    country: city?.country ?? "",
    countryCode: city?.countryCode ?? "XX",
    type: "AIRPORT",
    cityCode,
  };
}

// -- City / metro codes -----------------------------------------------------
addCity("LON", "LONDON", "UNITED KINGDOM", "GB");
addCity("BKK", "BANGKOK", "THAILAND", "TH");
addCity("NYC", "NEW YORK", "USA", "US");
addCity("HKG", "HONG KONG", "HONG KONG", "HK");
addCity("SIN", "SINGAPORE", "SINGAPORE", "SG");
addCity("PAR", "PARIS", "FRANCE", "FR");
addCity("MNL", "MANILA", "PHILIPPINES", "PH");
addCity("CEB", "CEBU", "PHILIPPINES", "PH");
addCity("TYO", "TOKYO", "JAPAN", "JP");
addCity("SYD", "SYDNEY", "AUSTRALIA", "AU");
addCity("KUL", "KUALA LUMPUR", "MALAYSIA", "MY");
addCity("HKT", "PHUKET", "THAILAND", "TH");
addCity("DXB", "DUBAI", "UNITED ARAB EMIRATES", "AE");
addCity("DPS", "DENPASAR/BALI", "INDONESIA", "ID");
addCity("ICN", "SEOUL", "SOUTH KOREA", "KR");
addCity("DOH", "DOHA", "QATAR", "QA");
addCity("BOM", "MUMBAI", "INDIA", "IN");
addCity("KWI", "KUWAIT", "KUWAIT", "KW");
addCity("CHI", "CHICAGO", "USA", "US");
addCity("WAS", "WASHINGTON DC", "USA", "US");
addCity("MIL", "MILAN", "ITALY", "IT");
addCity("MOW", "MOSCOW", "RUSSIA", "RU");
addCity("OSA", "OSAKA", "JAPAN", "JP");
addCity("SEL", "SEOUL", "SOUTH KOREA", "KR");
addCity("SAO", "SAO PAULO", "BRAZIL", "BR");
addCity("RIO", "RIO DE JANEIRO", "BRAZIL", "BR");
addCity("BUE", "BUENOS AIRES", "ARGENTINA", "AR");
addCity("ROM", "ROME", "ITALY", "IT");
addCity("STO", "STOCKHOLM", "SWEDEN", "SE");
addCity("BER", "BERLIN", "GERMANY", "DE");

// Single-airport major cities (city code == airport code, as on the real
// system for most of the world's airports).
const SINGLE_AIRPORT_CITIES: [string, string, string, string][] = [
  ["LAX", "LOS ANGELES", "USA", "US"],
  ["SFO", "SAN FRANCISCO", "USA", "US"],
  ["MIA", "MIAMI", "USA", "US"],
  ["ATL", "ATLANTA", "USA", "US"],
  ["DFW", "DALLAS/FORT WORTH", "USA", "US"],
  ["SEA", "SEATTLE", "USA", "US"],
  ["BOS", "BOSTON", "USA", "US"],
  ["DEN", "DENVER", "USA", "US"],
  ["LAS", "LAS VEGAS", "USA", "US"],
  ["YYZ", "TORONTO", "CANADA", "CA"],
  ["YVR", "VANCOUVER", "CANADA", "CA"],
  ["YUL", "MONTREAL", "CANADA", "CA"],
  ["MEX", "MEXICO CITY", "MEXICO", "MX"],
  ["GRU", "SAO PAULO/GUARULHOS", "BRAZIL", "BR"],
  ["LIM", "LIMA", "PERU", "PE"],
  ["BOG", "BOGOTA", "COLOMBIA", "CO"],
  ["SCL", "SANTIAGO", "CHILE", "CL"],
  ["MAD", "MADRID", "SPAIN", "ES"],
  ["BCN", "BARCELONA", "SPAIN", "ES"],
  ["FRA", "FRANKFURT", "GERMANY", "DE"],
  ["MUC", "MUNICH", "GERMANY", "DE"],
  ["AMS", "AMSTERDAM", "NETHERLANDS", "NL"],
  ["BRU", "BRUSSELS", "BELGIUM", "BE"],
  ["ZRH", "ZURICH", "SWITZERLAND", "CH"],
  ["GVA", "GENEVA", "SWITZERLAND", "CH"],
  ["VIE", "VIENNA", "AUSTRIA", "AT"],
  ["LIS", "LISBON", "PORTUGAL", "PT"],
  ["DUB", "DUBLIN", "IRELAND", "IE"],
  ["CPH", "COPENHAGEN", "DENMARK", "DK"],
  ["OSL", "OSLO", "NORWAY", "NO"],
  ["HEL", "HELSINKI", "FINLAND", "FI",],
  ["WAW", "WARSAW", "POLAND", "PL"],
  ["PRG", "PRAGUE", "CZECH REPUBLIC", "CZ"],
  ["BUD", "BUDAPEST", "HUNGARY", "HU"],
  ["ATH", "ATHENS", "GREECE", "GR"],
  ["IST", "ISTANBUL", "TURKEY", "TR"],
  ["CAI", "CAIRO", "EGYPT", "EG"],
  ["JNB", "JOHANNESBURG", "SOUTH AFRICA", "ZA"],
  ["CPT", "CAPE TOWN", "SOUTH AFRICA", "ZA"],
  ["NBO", "NAIROBI", "KENYA", "KE"],
  ["LOS", "LAGOS", "NIGERIA", "NG"],
  ["ADD", "ADDIS ABABA", "ETHIOPIA", "ET"],
  ["AUH", "ABU DHABI", "UNITED ARAB EMIRATES", "AE"],
  ["RUH", "RIYADH", "SAUDI ARABIA", "SA"],
  ["JED", "JEDDAH", "SAUDI ARABIA", "SA"],
  ["AMM", "AMMAN", "JORDAN", "JO"],
  ["TLV", "TEL AVIV", "ISRAEL", "IL"],
  ["DEL", "DELHI", "INDIA", "IN"],
  ["BLR", "BANGALORE", "INDIA", "IN"],
  ["MAA", "CHENNAI", "INDIA", "IN"],
  ["CCU", "KOLKATA", "INDIA", "IN"],
  ["KTM", "KATHMANDU", "NEPAL", "NP"],
  ["DAC", "DHAKA", "BANGLADESH", "BD"],
  ["CMB", "COLOMBO", "SRI LANKA", "LK"],
  ["KHI", "KARACHI", "PAKISTAN", "PK"],
  ["ISB", "ISLAMABAD", "PAKISTAN", "PK"],
  ["PEK", "BEIJING", "CHINA", "CN"],
  ["PVG", "SHANGHAI", "CHINA", "CN"],
  ["CAN", "GUANGZHOU", "CHINA", "CN"],
  ["SZX", "SHENZHEN", "CHINA", "CN"],
  ["CTU", "CHENGDU", "CHINA", "CN"],
  ["TPE", "TAIPEI", "TAIWAN", "TW"],
  ["MFM", "MACAU", "MACAU", "MO"],
  ["HAN", "HANOI", "VIETNAM", "VN"],
  ["SGN", "HO CHI MINH CITY", "VIETNAM", "VN"],
  ["PNH", "PHNOM PENH", "CAMBODIA", "KH"],
  ["RGN", "YANGON", "MYANMAR", "MM"],
  ["VTE", "VIENTIANE", "LAOS", "LA"],
  ["BWN", "BANDAR SERI BEGAWAN", "BRUNEI", "BN"],
  ["CGK", "JAKARTA", "INDONESIA", "ID"],
  ["SUB", "SURABAYA", "INDONESIA", "ID"],
  ["MEL", "MELBOURNE", "AUSTRALIA", "AU"],
  ["BNE", "BRISBANE", "AUSTRALIA", "AU"],
  ["PER", "PERTH", "AUSTRALIA", "AU"],
  ["AKL", "AUCKLAND", "NEW ZEALAND", "NZ"],
  ["NAN", "NADI", "FIJI", "FJ"],
  ["GUM", "GUAM", "GUAM", "GU"],
  ["HNL", "HONOLULU", "USA", "US"],
  ["YYC", "CALGARY", "CANADA", "CA"],
  ["IAH", "HOUSTON", "USA", "US"],
  ["ORD", "CHICAGO/O'HARE", "USA", "US"],
  ["PHX", "PHOENIX", "USA", "US"],
  ["MCO", "ORLANDO", "USA", "US"],
  ["EWR", "NEWARK", "USA", "US"],
  ["PHL", "PHILADELPHIA", "USA", "US"],
  ["MSP", "MINNEAPOLIS/ST. PAUL", "USA", "US"],
  ["DTW", "DETROIT", "USA", "US"],
  ["CLT", "CHARLOTTE", "USA", "US"],
  ["SLC", "SALT LAKE CITY", "USA", "US"],
];
SINGLE_AIRPORT_CITIES.forEach(([code, name, country, cc]) => addCity(code, name, country, cc));

// -- Airport codes belonging to a multi-airport metro code -------------------
addAirport("LHR", "LONDON/HEATHROW", "LON");
addAirport("LGW", "LONDON/GATWICK", "LON");
addAirport("STN", "LONDON/STANSTED", "LON");
addAirport("LTN", "LONDON/LUTON", "LON");
addAirport("LCY", "LONDON/CITY", "LON");
addAirport("JFK", "NEW YORK/JFK", "NYC");
addAirport("EWR", "NEWARK LIBERTY (NEW YORK)", "NYC");
addAirport("LGA", "NEW YORK/LAGUARDIA", "NYC");
addAirport("CDG", "PARIS/CHARLES DE GAULLE", "PAR");
addAirport("ORY", "PARIS/ORLY", "PAR");
addAirport("BVA", "PARIS/BEAUVAIS", "PAR");
addAirport("NRT", "TOKYO/NARITA", "TYO");
addAirport("HND", "TOKYO/HANEDA", "TYO");
addAirport("ORD", "CHICAGO/O'HARE", "CHI");
addAirport("MDW", "CHICAGO/MIDWAY", "CHI");
addAirport("IAD", "WASHINGTON/DULLES", "WAS");
addAirport("DCA", "WASHINGTON/REAGAN NATIONAL", "WAS");
addAirport("BWI", "BALTIMORE/WASHINGTON", "WAS");
addAirport("MXP", "MILAN/MALPENSA", "MIL");
addAirport("LIN", "MILAN/LINATE", "MIL");
addAirport("BGY", "MILAN/BERGAMO", "MIL");
addAirport("SVO", "MOSCOW/SHEREMETYEVO", "MOW");
addAirport("DME", "MOSCOW/DOMODEDOVO", "MOW");
addAirport("VKO", "MOSCOW/VNUKOVO", "MOW");
addAirport("KIX", "OSAKA/KANSAI", "OSA");
addAirport("ITM", "OSAKA/ITAMI", "OSA");
addAirport("ICN", "SEOUL/INCHEON", "SEL");
addAirport("GMP", "SEOUL/GIMPO", "SEL");
addAirport("GRU", "SAO PAULO/GUARULHOS", "SAO");
addAirport("CGH", "SAO PAULO/CONGONHAS", "SAO");
addAirport("GIG", "RIO DE JANEIRO/GALEAO", "RIO");
addAirport("SDU", "RIO DE JANEIRO/SANTOS DUMONT", "RIO");
addAirport("EZE", "BUENOS AIRES/EZEIZA", "BUE");
addAirport("AEP", "BUENOS AIRES/AEROPARQUE", "BUE");
addAirport("FCO", "ROME/FIUMICINO", "ROM");
addAirport("CIA", "ROME/CIAMPINO", "ROM");
addAirport("ARN", "STOCKHOLM/ARLANDA", "STO");
addAirport("BMA", "STOCKHOLM/BROMMA", "STO");
addAirport("NYO", "STOCKHOLM/SKAVSTA", "STO");

function locationOf(code: string): LocationEntry | undefined {
  return LOCATIONS[code];
}

// Kept as the metro/city *display* name for a code, whatever kind it is --
// used in AN/SN/TN headers. For an airport code this is still the city's
// name (matches real Amadeus, which always shows the city name up top).
function cityName(code: string): string {
  const loc = LOCATIONS[code];
  if (!loc) return code;
  if (loc.type === "AIRPORT" && loc.cityCode) return LOCATIONS[loc.cityCode]?.name ?? loc.name;
  return loc.name;
}
function countryCode(code: string): string {
  return LOCATIONS[code]?.countryCode ?? "XX";
}

// Normalizes an AIRPORT code to the metro CITY code it belongs to (so an
// airline's hub list, which is written in city codes like "LON"/"NYC", still
// matches when the user queried a specific airport like "LHR"/"JFK"). CITY
// codes and single-airport-city codes (already city-level, e.g. "LAX") pass
// through unchanged.
function cityCodeFor(code: string): string {
  const loc = LOCATIONS[code];
  if (loc?.type === "AIRPORT" && loc.cityCode) return loc.cityCode;
  return code;
}

// The core of the real-route model: does this carrier plausibly operate a
// NONSTOP flight between origin and dest? Real Amadeus answers this from
// live airline schedules; this trainer answers it from each carrier's
// actual hub list plus a reach tier (see AirlineRecord above). Since every
// generated flight here is nonstop, requiring a hub at one end mirrors how
// real point-to-point networks are actually built.
function airlineServesRoute(carrier: string, origin: string, dest: string): boolean {
  const rec = AIRLINES_BY_IATA[carrier];
  if (!rec) return false;
  const originCity = cityCodeFor(origin);
  const destCity = cityCodeFor(dest);
  const hubAtOrigin = rec.hubs.includes(originCity);
  const hubAtDest = rec.hubs.includes(destCity);
  if (!hubAtOrigin && !hubAtDest) return false;
  if (rec.reach === "global") return true;
  // Regional carrier: the END THAT ISN'T THE HUB must fall inside one of
  // its home regions (if both ends are hubs of this carrier, it trivially
  // qualifies -- a carrier can always fly between two of its own bases).
  if (hubAtOrigin && hubAtDest) return true;
  const other = hubAtOrigin ? dest : origin;
  const region = REGION_BY_COUNTRY[countryCode(other)];
  return !!region && !!rec.homeRegions?.includes(region);
}

// If `code` is a multi-airport metro/city code, deterministically pick one
// of its real constituent airports for a given flight -- this is what real
// Amadeus availability does: querying a city code returns flights tagged
// with the actual airport each one uses, not the bare city code repeated
// on every line.
function resolveAirport(code: string, seed: number): { airport: string; wasCity: boolean } {
  const airports = CITY_AIRPORTS[code];
  if (!airports || airports.length === 0) return { airport: code, wasCity: false };
  return { airport: airports[seed % airports.length], wasCity: true };
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
    AN: "AN<ddMMM><ORIG><DEST>[<HHMM>|<HHA>][/A<CX>][/C<CLS>][/K<CABIN>][/X<PT>] -- air availability. ORIG/DEST take either a metro/city code (LON, NYC, PAR, TYO, CHI, WAS, MIL, MOW, OSA, SEL, SAO, RIO, BUE, ROM, STO) or a specific airport code (LHR, JFK, CDG...); a city code returns flights tagged with the real airport each one uses. Options: /A airline, /C class, /K cabin (F/C/W/M), /X connecting point, HHMM or HHA = flights from ~1hr before that time. e.g. AN15DECLONBKK, AN15DECLHRBKK, AN18AUGHKGSIN0900, AN18AUGHKGSIN09A/CQ",
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
    DAC: "DAC<code> -- decode a city or airport code to its name. On a multi-airport metro code (LON, NYC, PAR, TYO, CHI, WAS, MIL, MOW, OSA, SEL, SAO, RIO, BUE, ROM, STO) also lists the airports under it, e.g. DACLON, DACLHR.",
    DAN: "DAN <text> -- encode a city/country name to its code(s). Returns every match (exact, then starts-with, then contains), same as the real system when a name is ambiguous, e.g. DAN LONDON, DAN SAN.",
    DNA: "DNA<code> -- decode an airline code to its name. Accepts either the 2-character IATA code (e.g. DNAEK, DNA5J) or the 3-letter ICAO code (e.g. DNAUAE, DNACEB) -- both resolve to the same airline, just like the real system. DNA <text> -- the reverse: encode an airline name to its code(s), e.g. DNA EMIRATES -> EK/UAE. Bidirectional, same pairing style as DAC/DAN but for carriers.",
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
  if (CITY_AIRPORTS[origin]) out.push(`** ${origin} IS A MULTI-AIRPORT CITY: ${CITY_AIRPORTS[origin].join("/")} -- EACH LINE SHOWS ITS ACTUAL AIRPORT **`);
  if (CITY_AIRPORTS[dest]) out.push(`** ${dest} IS A MULTI-AIRPORT CITY: ${CITY_AIRPORTS[dest].join("/")} -- EACH LINE SHOWS ITS ACTUAL AIRPORT **`);
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
      "DNA<CODE> / DNA <TEXT>        DECODE / ENCODE AN AIRLINE - IATA OR ICAO CODE (BIDIRECTIONAL)",
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
    if (rows.length === 0) {
      out.push(" NO FLIGHTS TIMETABLED FOR THIS CITY PAIR");
      return { lines: out, state: s };
    }
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

  // DAC -- decode a city OR airport code. Real Amadeus: an airport code
  // decodes to "CITY NAME/AIRPORT NAME, COUNTRY"; a metro/city code that
  // covers several airports also lists them, since that's the whole point
  // of DAC'ing a city code before you AN it.
  const dacMatch = cmd.match(/^DAC([A-Z]{3})$/);
  if (dacMatch) {
    const code = dacMatch[1];
    const loc = locationOf(code);
    if (!loc) {
      out.push(`${code} UNKNOWN CODE (NOT IN THIS TRAINER'S GEOGRAPHY TABLE)`);
    } else if (loc.type === "AIRPORT") {
      out.push(`${code} ${loc.name}, ${loc.country}.${loc.countryCode}  (AIRPORT - CITY CODE ${loc.cityCode})`);
    } else if (CITY_AIRPORTS[code]) {
      out.push(`${code} ${loc.name}, ${loc.country}.${loc.countryCode}  (METROPOLITAN AREA)`);
      out.push(` AIRPORTS SERVING ${code}: ${CITY_AIRPORTS[code].join(", ")}`);
    } else {
      out.push(`${code} ${loc.name}, ${loc.country}.${loc.countryCode}`);
    }
    return { lines: out, state: s };
  }

  // DAN -- encode a name to its code(s). Real Amadeus returns every
  // plausible match, ranked (exact match first, then "starts with", then
  // "contains"), not just the first hit -- a name like SAN or SANTIAGO is
  // genuinely ambiguous and the terminal shows you the candidate list.
  const danMatch = raw.match(/^DAN\s+(.+)$/i);
  if (danMatch) {
    const needle = danMatch[1].trim().toUpperCase();
    const all = Object.values(LOCATIONS);
    const rank = (loc: LocationEntry): number => {
      if (loc.name === needle) return 0;
      if (loc.name.startsWith(needle)) return 1;
      if (loc.name.includes(needle)) return 2;
      if (loc.country.startsWith(needle)) return 3;
      if (loc.country.includes(needle)) return 4;
      return -1;
    };
    const matches = all
      .map((loc) => ({ loc, r: rank(loc) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r || a.loc.code.localeCompare(b.loc.code))
      .slice(0, 15);
    if (matches.length === 0) {
      out.push(`${needle} NO MATCH (NOT IN THIS TRAINER'S GEOGRAPHY TABLE)`);
    } else if (matches.length === 1) {
      const { loc } = matches[0];
      const tag = loc.type === "AIRPORT" ? ` (AIRPORT, CITY ${loc.cityCode})` : "";
      out.push(`${needle} ${loc.code} ${loc.name}, ${loc.country}${tag}`);
    } else {
      out.push(`${needle} -- MULTIPLE MATCHES:`);
      matches.forEach(({ loc }) => {
        const tag = loc.type === "AIRPORT" ? ` (AIRPORT, CITY ${loc.cityCode})` : "";
        out.push(` ${loc.code}  ${loc.name}, ${loc.country}${tag}`);
      });
    }
    return { lines: out, state: s };
  }

  // DNA -- decode/encode airline (bidirectional), same pairing as DAC/DAN
  // but for carriers instead of cities. DNA<CODE> (no space) decodes a
  // code to its name -- CODE can be the 2-character IATA code used in
  // flight numbers and PNRs (e.g. "5J"), OR the 3-letter ICAO code used
  // in ops/ATC contexts (e.g. "CEB") -- both resolve to the same airline,
  // matching how the real system accepts either. DNA <TEXT> (with a
  // space) encodes a name back to its code(s).
  const dnaCodeMatch = cmd.match(/^DNA([A-Z0-9]{2,3})$/);
  if (dnaCodeMatch) {
    const code = dnaCodeMatch[1];
    const rec = AIRLINES_BY_IATA[code] ?? AIRLINES_BY_ICAO[code];
    if (!rec) {
      out.push(`${code} UNKNOWN AIRLINE CODE (NOT IN THIS TRAINER'S AIRLINE TABLE)`);
    } else {
      const pair = airlineCodePair(rec);
      out.push(rec.numeric ? `${pair}  ${rec.numeric}  ${rec.name}` : `${pair}  ${rec.name}`);
    }
    return { lines: out, state: s };
  }

  const dnaNameMatch = raw.match(/^DNA\s+(.+)$/i);
  if (dnaNameMatch) {
    const needle = dnaNameMatch[1].trim().toUpperCase();
    const rank = (name: string): number => {
      if (name === needle) return 0;
      if (name.startsWith(needle)) return 1;
      if (name.includes(needle)) return 2;
      return -1;
    };
    const matches = AIRLINE_RECORDS
      .map((rec) => ({ rec, r: rank(rec.name) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r || a.rec.iata.localeCompare(b.rec.iata))
      .slice(0, 15);
    if (matches.length === 0) {
      out.push(`${needle} NO MATCH (NOT IN THIS TRAINER'S AIRLINE TABLE)`);
    } else if (matches.length === 1) {
      const { rec } = matches[0];
      const pair = airlineCodePair(rec);
      out.push(rec.numeric ? `${needle} ${pair}  ${rec.numeric}  ${rec.name}` : `${needle} ${pair}  ${rec.name}`);
    } else {
      out.push(`${needle} -- MULTIPLE MATCHES:`);
      matches.forEach(({ rec }) => out.push(` ${airlineCodePair(rec)}  ${rec.name}`));
    }
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
