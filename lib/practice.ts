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
      { instruction: "Add an email contact too. Email uses the ape- format: lowercase, a hyphen, the address, then /P and the passenger number (John is passenger 1, so /P1).", hint: "ape-john@example.com/P1", matcher: /^APE-JOHN@EXAMPLE\.COM\/P1$/ },
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
    id: "t1-price-deadline",
    title: "4. Set a Real Ticketing Deadline",
    goal: "TKTL sets an actual date/time ticketing deadline instead of TKOK's no-limit. Format: TKTL<ddMMM>/<hhmm>.",
    steps: [
            { instruction: "Set a ticketing time limit: January 20, 5:00 PM.", hint: "TKTL20JAN/1700", matcher: /^TKTL20JAN\/1700$/ },
    ],
  },
  {
    id: "t1-waitlist",
    title: "5. Sell Into a Waitlist",
    goal: "When a class shows 0 seats but isn't fully closed, SS doesn't refuse the sale — it waitlists it (status HL instead of HK), same as a real system.",
    steps: [
      { instruction: "Check availability from London (LON) to Singapore (SIN) for January 1.", hint: "AN01JANLONSIN", matcher: /^AN01JANLONSIN$/ },
      { instruction: "Sell 1 seat in class H from line 1 — watch the status you get back.", hint: "SS1H1", matcher: /^SS1H1$/ },
    ],
  },
  {
    id: "t2-itin",
    title: "6. Real Scenario — Book the Itinerary",
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
    title: "7. Real Scenario — Passengers & Contacts",
    goal: "Add both travelers by name, then each traveler's mobile number and email using the apm-/ape- format. The /P number says which passenger the contact belongs to (P1 = first name added, P2 = second, ...).",
    steps: [
      { instruction: "Add passenger: BAYOS / NAYAN, title MS.", hint: "NM1BAYOS/NAYAN MS", matcher: /^NM\d+BAYOS\/NAYAN(\s+MS)?$/ },
      { instruction: "Add passenger: BAYOS / NEIL, title MR.", hint: "NM2BAYOS/NEIL MR", matcher: /^NM\d+BAYOS\/NEIL(\s+MR)?$/ },
      { instruction: "Add Mr. Neil Bayos's mobile number (09987654321). Mobile uses the apm- format with a passenger number — Neil is the 2nd passenger, so /P2.", hint: "apm-09987654321/P2", matcher: /^APM-09987654321\/P2$/ },
      { instruction: "Add Mr. Neil Bayos's email (pako_28@nomail.com), again as passenger 2.", hint: "ape-pako_28@nomail.com/P2", matcher: /^APE-PAKO_28@NOMAIL\.COM\/P2$/ },
      { instruction: "Add Ms. Nhayanne Bayos's mobile number (09123456789). She is passenger 1, so /P1.", hint: "apm-09123456789/P1", matcher: /^APM-09123456789\/P1$/ },
      { instruction: "Add Ms. Nhayanne Bayos's email (bhoszx_nayan28@nomail.com) as passenger 1.", hint: "ape-bhoszx_nayan28@nomail.com/P1", matcher: /^APE-BHOSZX_NAYAN28@NOMAIL\.COM\/P1$/ },
    ],
  },
  {
    id: "t2-ticket",
    title: "8. Real Scenario — Deadline & Save",
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
    title: "9. Two Bookings at Once — Work Areas",
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
    id: "t5-family-and-arnk",
    title: "10. Family Names, an Infant & a Broken Itinerary",
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
