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
    title: "1. Search & Sell",
    goal: "The two moves you'll use at the start of every booking: pull availability, then sell a seat from it.",
    steps: [
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
      { instruction: "ER leaves the PNR open on screen. Done with this booking? End Transaction — it saves again and wipes the area so the next booking starts clean.", hint: "ET", matcher: /^ET$/ },
    ],
  },
  {
    id: "t1-price-deadline",
    title: "3. Set a Real Ticketing Deadline",
    goal: "TKTL sets an actual date/time ticketing deadline instead of TKOK's no-limit. Format: TKTL<ddMMM>/<hhmm>.",
    steps: [
            { instruction: "Set a ticketing time limit: January 20, 5:00 PM.", hint: "TKTL20JAN/1700", matcher: /^TKTL20JAN\/1700$/ },
    ],
  },
  {
    id: "t1-waitlist",
    title: "4. Sell Into a Waitlist",
    goal: "When a class shows 0 seats but isn't fully closed, SS doesn't refuse the sale — it waitlists it (status HL instead of HK), same as a real system.",
    steps: [
      { instruction: "Check availability from London (LON) to Singapore (SIN) for January 1.", hint: "AN01JANLONSIN", matcher: /^AN01JANLONSIN$/ },
      { instruction: "Sell 1 seat in class H from line 1 — watch the status you get back.", hint: "SS1H1", matcher: /^SS1H1$/ },
    ],
  },
  {
    id: "t2-itin",
    title: "5. Real Scenario — Book the Itinerary",
    goal:
      "An actual work order: Ms. Nhayanne and Mr. Neil Bayos need Manila → Kuala Lumpur → Bangkok → Phuket → Dubai → Manila. " +
      "Pull availability for each leg and sell 2 seats before moving to the next.",
    steps: [
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
    title: "6. Real Scenario — Passengers & Contacts",
    goal: "Add both travelers by name, then each traveler's mobile number and email using the apm-/ape- format. The /P number says which passenger the contact belongs to (P1 = first name added, P2 = second, ...). Names must be the first ones on a clear screen, so finish Task 2 with ET before starting.",
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
    title: "7. Real Scenario — Deadline & Save",
    goal:
      "Tickets must be issued to Ms. Nhayanne on or before September 16 — set that as the time limit, sign it, review, then save.",
    steps: [
      { instruction: "Set a ticketing time limit of September 16, 5:00 PM.", hint: "TKTL16SEP/1700", matcher: /^TKTL16SEP\/\d{4}$/ },
      { instruction: "Add your Received From signature (any initials).", hint: "RF NB", matcher: /^RF\s*[A-Z]+$/ },
      { instruction: "Review the PNR before saving.", hint: "RT", matcher: /^RT$/ },
      { instruction: "Save it with End Transaction — this returns your record locator and clears the screen for the next booking.", hint: "ET", matcher: /^ET$/ },
    ],
  },
  {
    id: "t5-family-and-arnk",
    title: "8. Family Names, an Infant & a Broken Itinerary",
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
