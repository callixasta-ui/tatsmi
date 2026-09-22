export interface PracticeStep {
  instruction: string;
  hint: string;
  matcher: RegExp; // tested against the trimmed, uppercased command
}

export interface PracticeTask {
  id: string;
  title: string;
  goal: string;
  steps: PracticeStep[];
}

export const PRACTICE_TASKS: PracticeTask[] = [
  {
    id: "t0-decode-search-sell",
    title: "1. Decode, Search & Sell",
    goal: "The four moves you'll use in almost every session: look up a code, look one up by name, pull availability, and sell a seat.",
    steps: [
      { instruction: "Decode the city code LON.", hint: "DACLON", matcher: /^DACLON$/ },
      { instruction: "Now go the other way: find the code for Bangkok.", hint: "DAN BANGKOK", matcher: /^DAN\s+BANGKOK$/ },
      { instruction: "Check availability from London (LON) to Bangkok (BKK) for December 15.", hint: "AN15DECLONBKK", matcher: /^AN15DECLONBKK$/ },
      { instruction: "Sell 1 seat in class K from line 1.", hint: "SS1K1", matcher: /^SS1K1$/ },
    ],
  },
  {
    id: "t0-full-booking",
    title: "2. Build a Complete, Saveable Booking",
    goal:
      "A real PNR needs 5 mandatory elements before it can be saved: a name, a segment, a contact, a ticketing " +
      "arrangement, and a Received From. Miss one and ER will refuse — on purpose, same as the real system.",
    steps: [
      { instruction: "Add the passenger: SMITH / JOHN, title MR.", hint: "NM1SMITH/JOHN MR", matcher: /^NM\d+SMITH\/JOHN(\s+MR)?$/ },
      { instruction: "Add a phone contact.", hint: "AP 6621234567", matcher: /^AP\s+6621234567$/ },
      { instruction: "Add an email contact too (note the APE prefix — email is its own entry, not plain AP).", hint: "APE john@example.com", matcher: /^APE\s+JOHN@EXAMPLE\.COM$/ },
      { instruction: "Set the ticketing arrangement to no time limit.", hint: "TKOK", matcher: /^TKOK$/ },
      { instruction: "Add your Received From signature — this is who's making the booking, mandatory on every PNR.", hint: "RF JDOE", matcher: /^RF\s*JDOE$/ },
      { instruction: "Review the PNR before saving.", hint: "RT", matcher: /^RT$/ },
      { instruction: "Save it — End & Retrieve hands back a record locator.", hint: "ER", matcher: /^ER$/ },
      { instruction: "Retrieve it again using that locator (real Amadeus syntax: no punctuation, just RT + the locator).", hint: "RT<YOUR-LOCATOR>  e.g. RT7F3K2Q — use YOUR code, not this example", matcher: /^RT[A-Z0-9]{6}$/ },
      { instruction: "ER leaves the PNR open on screen. Done with this booking? End Transaction — it saves again and wipes the area so the next booking starts clean (no IG needed).", hint: "ET", matcher: /^ET$/ },
    ],
  },
  {
    id: "t1-fix-mistakes",
    title: "3. Fix a Mistake, Then Walk Away",
    goal: "XE cancels one specific element by its number from RT. IG discards everything without saving.",
    steps: [
      { instruction: "Check availability from Manila (MNL) to Cebu (CEB) for January 10.", hint: "AN10JANMNLCEB", matcher: /^AN10JANMNLCEB$/ },
      { instruction: "Sell 1 seat in class Q from line 1.", hint: "SS1Q1", matcher: /^SS1Q1$/ },
      { instruction: "Add a name, but on purpose type it wrong: TEST / WRONG.", hint: "NM1TEST/WRONG", matcher: /^NM\d+TEST\/WRONG$/ },
      { instruction: "Review the PNR to see the element numbers.", hint: "RT", matcher: /^RT$/ },
      { instruction: "Cancel the wrong name (it'll be element 1).", hint: "XE1", matcher: /^XE1$/ },
      { instruction: "Add the correct name instead: TEST / RIGHT.", hint: "NM1TEST/RIGHT", matcher: /^NM\d+TEST\/RIGHT$/ },
      { instruction: "Changed your mind — discard the whole thing without ever saving it.", hint: "IG", matcher: /^IG$/ },
    ],
  },
  {
    id: "t1-extras",
    title: "4. Remarks, OSI, Frequent Flyer & Seats",
    goal: "The elements beyond the mandatory five — free text, service info, loyalty numbers, and seat selection.",
    steps: [
      { instruction: "Check availability from New York (NYC) to Paris (PAR) for January 5.", hint: "AN05JANNYCPAR", matcher: /^AN05JANNYCPAR$/ },
      { instruction: "Sell 1 seat in class M from line 1.", hint: "SS1M1", matcher: /^SS1M1$/ },
      { instruction: "Add a remark.", hint: "RM VIP CLIENT", matcher: /^RM\s+VIP\s+CLIENT$/ },
      { instruction: "Add other service info (entry is OS — it displays as OSI on the PNR, that's normal).", hint: "OS CTC AT WORK", matcher: /^OS\s+CTC\s+AT\s+WORK$/ },
      { instruction: "Add a frequent flyer number.", hint: "FFN BA1234567", matcher: /^FFN\s+BA1234567$/ },
      { instruction: "Look at the seat map for that segment.", hint: "SM", matcher: /^SM\d*$/ },
      { instruction: "Assign yourself seat 12C.", hint: "ST/12C/P1", matcher: /^ST\/12C(\/P1)?$/ },
    ],
  },
  {
    id: "t1-price-deadline",
    title: "5. Price It & Set a Real Deadline",
    goal: "FXP prices whatever's currently sold. TKTL sets an actual date/time ticketing deadline instead of TKOK's no-limit.",
    steps: [
      { instruction: "Get a fare quote for the active PNR (use the one from Task 4, or sell something fresh first).", hint: "FXP", matcher: /^FXP$/ },
      { instruction: "Set a ticketing time limit: January 20, 5:00 PM.", hint: "TKTL20JAN/1700", matcher: /^TKTL20JAN\/1700$/ },
    ],
  },
  {
    id: "t1-waitlist",
    title: "6. Sell Into a Waitlist",
    goal: "When a class shows 0 seats but isn't fully closed, SS doesn't refuse the sale — it waitlists it (status HL instead of HK), same as a real system.",
    steps: [
      { instruction: "Check availability from London (LON) to Singapore (SIN) for January 1.", hint: "AN01JANLONSIN", matcher: /^AN01JANLONSIN$/ },
      { instruction: "Sell 1 seat in class H from line 1 — watch the status you get back.", hint: "SS1H1", matcher: /^SS1H1$/ },
    ],
  },
  {
    id: "t2-itin",
    title: "7. Real Scenario — Book the Itinerary",
    goal:
      "An actual work order: Ms. Nhayanne and Mr. Neil Bayos need Manila → Kuala Lumpur → Bangkok → Phuket → Dubai → Manila. " +
      "Pull availability for each leg and sell 2 seats before moving to the next.",
    steps: [
      { instruction: "Start clean: earlier tasks may have left segments in your area. Clear it with IG, or jump to a free work area (JB) and leave the old one untouched.", hint: "IG  (or JB)", matcher: /^(IG|J[B-F])$/ },
      { instruction: "Availability: Manila (MNL) to Kuala Lumpur (KUL), September 20.", hint: "AN20SEPMNLKUL", matcher: /^AN20SEPMNLKUL$/ },
      { instruction: "Sell 2 seats from line 1 (both travelers, same flight).", hint: "SS2B1", matcher: /^SS2B1$/ },
      { instruction: "Availability: Kuala Lumpur (KUL) to Bangkok (BKK), September 23.", hint: "AN23SEPKULBKK", matcher: /^AN23SEPKULBKK$/ },
      { instruction: "Sell 2 seats from line 1.", hint: "SS2Q1", matcher: /^SS2Q1$/ },
      { instruction: "Availability: Bangkok (BKK) to Phuket (HKT), September 26.", hint: "AN26SEPBKKHKT", matcher: /^AN26SEPBKKHKT$/ },
      { instruction: "Sell 2 seats from line 1.", hint: "SS2K1", matcher: /^SS2K1$/ },
      { instruction: "Availability: Phuket (HKT) to Dubai (DXB), September 29.", hint: "AN29SEPHKTDXB", matcher: /^AN29SEPHKTDXB$/ },
      { instruction: "Sell 2 seats from line 1.", hint: "SS2B1", matcher: /^SS2B1$/ },
      { instruction: "Availability: Dubai (DXB) to Manila (MNL), October 6.", hint: "AN06OCTDXBMNL", matcher: /^AN06OCTDXBMNL$/ },
      { instruction: "Sell 2 seats from line 1.", hint: "SS2B1", matcher: /^SS2B1$/ },
    ],
  },
  {
    id: "t2-pax",
    title: "8. Real Scenario — Passengers & Contacts",
    goal: "Add both travelers by name, then both of their mobile numbers and emails, with the correct contact-type entries.",
    steps: [
      { instruction: "Add passenger: BAYOS / NAYAN, title MS.", hint: "NM1BAYOS/NAYAN MS", matcher: /^NM\d+BAYOS\/NAYAN(\s+MS)?$/ },
      { instruction: "Add passenger: BAYOS / NEIL, title MR.", hint: "NM2BAYOS/NEIL MR", matcher: /^NM\d+BAYOS\/NEIL(\s+MR)?$/ },
      { instruction: "Add Mr. Neil Bayos's mobile number (09987654321) — use APM, not AP, since it's specifically a mobile.", hint: "APM 09987654321", matcher: /^APM\s+09987654321$/ },
      { instruction: "Add Mr. Neil Bayos's email (pako_28@nomail.com).", hint: "APE pako_28@nomail.com", matcher: /^APE\s+PAKO_28@NOMAIL\.COM$/ },
      { instruction: "Add Ms. Nhayanne Bayos's mobile number (09123456789).", hint: "APM 09123456789", matcher: /^APM\s+09123456789$/ },
      { instruction: "Add Ms. Nhayanne Bayos's email (bhoszx_nayan28@nomail.com).", hint: "APE bhoszx_nayan28@nomail.com", matcher: /^APE\s+BHOSZX_NAYAN28@NOMAIL\.COM$/ },
    ],
  },
  {
    id: "t2-ticket",
    title: "9. Real Scenario — Deadline & Save",
    goal:
      "Tickets must be issued to Ms. Nhayanne on or before September 16 — set that as the time limit, sign it, review, then save.",
    steps: [
      { instruction: "Set a ticketing time limit of September 16, 5:00 PM.", hint: "TKTL16SEP/1700", matcher: /^TKTL16SEP\/\d{4}$/ },
      { instruction: "Add your Received From signature (any initials).", hint: "RF NB", matcher: /^RF\s*[A-Z]+$/ },
      { instruction: "Review the PNR before saving.", hint: "RT", matcher: /^RT$/ },
      { instruction: "Save it — this returns your record locator. (ER keeps the PNR open, ET saves and clears the area — either works.)", hint: "ER", matcher: /^E[RT]$/ },
    ],
  },
  {
    id: "t3-work-areas",
    title: "10. Two Bookings at Once — Work Areas",
    goal:
      "Real terminals give you work areas A–F, each holding its own booking in progress. Build one booking, save it with ET, " +
      "then juggle a second in another area without ever losing the first.",
    steps: [
      { instruction: "Check availability from Manila (MNL) to Cebu (CEB) for January 10.", hint: "AN10JANMNLCEB", matcher: /^AN10JANMNLCEB$/ },
      { instruction: "Sell 1 seat in class Q from line 1.", hint: "SS1Q1", matcher: /^SS1Q1$/ },
      { instruction: "Add a passenger: DOE / JANE, title MS.", hint: "NM1DOE/JANE MS", matcher: /^NM\d+DOE\/JANE(\s+MS)?$/ },
      { instruction: "Add a phone contact.", hint: "AP 6621234567", matcher: /^AP\s+6621234567$/ },
      { instruction: "Set the ticketing arrangement to no time limit.", hint: "TKOK", matcher: /^TKOK$/ },
      { instruction: "Sign it.", hint: "RF JDOE", matcher: /^RF\s*JDOE$/ },
      { instruction: "End Transaction: saves the PNR and clears the area in one go.", hint: "ET", matcher: /^ET$/ },
      { instruction: "Start a second booking without touching the first: jump to work area B.", hint: "JB", matcher: /^JB$/ },
      { instruction: "In area B, check availability from Manila (MNL) to Hong Kong (HKG) for January 12.", hint: "AN12JANMNLHKG", matcher: /^AN12JANMNLHKG$/ },
      { instruction: "Sell 1 seat from line 1 (any open class).", hint: "SS1Y1", matcher: /^SS1[A-Z]1$/ },
      { instruction: "Check the status of all your work areas.", hint: "JO", matcher: /^JO$/ },
      { instruction: "Jump back to area A.", hint: "JA", matcher: /^JA$/ },
    ],
  },
  {
    id: "t4-ticket",
    title: "11. Price, Pay & Actually Issue the Ticket",
    goal:
      "TKOK/TKTL is only a promise to ticket later -- it never produces a ticket number. A real ticket needs a " +
      "fare (FXP), a form of payment (FP), and the ticketing entry itself (TTP) -- and TTP only works on a PNR " +
      "that's already been saved with ER or ET.",
    steps: [
      { instruction: "Start fresh: check availability from Manila (MNL) to Singapore (SIN) for February 1.", hint: "AN01FEBMNLSIN", matcher: /^AN01FEBMNLSIN$/ },
      { instruction: "Sell 1 seat in class Y from line 1.", hint: "SS1Y1", matcher: /^SS1Y1$/ },
      { instruction: "Add the passenger: CRUZ / MARIA, title MS.", hint: "NM1CRUZ/MARIA MS", matcher: /^NM\d+CRUZ\/MARIA(\s+MS)?$/ },
      { instruction: "Add a phone contact.", hint: "AP 6621234567", matcher: /^AP\s+6621234567$/ },
      { instruction: "Set the ticketing arrangement to no time limit.", hint: "TKOK", matcher: /^TKOK$/ },
      { instruction: "Sign it.", hint: "RF MC", matcher: /^RF\s*[A-Z]+$/ },
      { instruction: "Save it -- TTP later needs a PNR that already has a record locator.", hint: "ER", matcher: /^E[RT]$/ },
      { instruction: "Price the itinerary. This creates a TST (T01) holding the fare.", hint: "FXP", matcher: /^FXP$/ },
      { instruction: "Add a form of payment -- cash.", hint: "FP CASH", matcher: /^FP\s+CASH$/ },
      { instruction: "Issue the ticket -- this is the step that actually produces a ticket number.", hint: "TTP", matcher: /^TTP$/ },
    ],
  },
  {
    id: "t5-family-and-arnk",
    title: "12. Family Names, an Infant & a Broken Itinerary",
    goal:
      "The Name element can hold more than one passenger, a child, and an attached infant in a single entry -- and " +
      "ARNK keeps segment continuity when part of a trip isn't flown at all.",
    steps: [
      { instruction: "Add two passengers sharing the family name REYES: HANS (MR) and HEIDI (MS), in one NM entry.", hint: "NM2REYES/HANS MR/HEIDI MS", matcher: /^NM\d+REYES\s*\/\s*HANS\s+MR\/HEIDI\s+MS$/ },
      { instruction: "Add a child, BRADLEY / MICHAEL (MSTR), born 12DEC16.", hint: "NM1BRADLEY/MICHAEL MSTR(CHD/12DEC16)", matcher: /^NM\d+BRADLEY\/MICHAEL\s+MSTR\(CHD\/12DEC16\)$/ },
      { instruction: "Add BROSNAN / SUZANNE (MS) traveling with her infant Pauline (same surname), born 01NOV20.", hint: "NM1BROSNAN/SUZANNE MS(INF/PAULINE/01NOV20)", matcher: /^NM\d+BROSNAN\/SUZANNE\s+MS\s*\(INF\/PAULINE\/01NOV20\)$/ },
      { instruction: "Review the PNR -- notice the element numbers for what you just added.", hint: "RT", matcher: /^RT$/ },
      { instruction: "You misspelled the child's title -- use Name Update to fix passenger 2's title only (keep MICHAEL, switch to MSTR).", hint: "NU2/MICHAEL MSTR", matcher: /^NU2\/MICHAEL\s+MSTR$/ },
      { instruction: "Between two of this trip's flights the passenger is taking a train, not a plane -- keep the itinerary continuous with an Arrival Unknown segment.", hint: "SIARNK", matcher: /^SIARNK$/ },
      { instruction: "Review the PNR once more to see the ARNK sitting in the segment sequence.", hint: "RT", matcher: /^RT$/ },
    ],
  },
];
