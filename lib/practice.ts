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

// This mirrors an actual work order: Ms. Nhayanne Bayos, on a break from
// accounting, wants a 5-city trip with her husband. Build it exactly as
// specified -- itineraries, both passengers, both contacts, and the
// ticketing deadline.
export const PRACTICE_TASKS: PracticeTask[] = [
  {
    id: "itin",
    title: "1. Book the Itinerary — 5 Legs, 2 Travelers",
    goal:
      "Ms. Nhayanne and Mr. Neil Bayos need Manila → Kuala Lumpur → Bangkok → Phuket → Dubai → Manila. " +
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
    id: "pax",
    title: "2. Add Passengers & Contacts",
    goal: "Add both travelers by name, then both of their contact numbers and emails.",
    steps: [
      { instruction: "Add passenger: BAYOS / NAYAN, title MS.", hint: "NM1BAYOS/NAYAN MS", matcher: /^NM\d+BAYOS\/NAYAN(\s+MS)?$/ },
      { instruction: "Add passenger: BAYOS / NEIL, title MR.", hint: "NM2BAYOS/NEIL MR", matcher: /^NM\d+BAYOS\/NEIL(\s+MR)?$/ },
      { instruction: "Add Mr. Neil Bayos's mobile number (09987654321).", hint: "AP 09987654321", matcher: /^AP\s+09987654321$/ },
      { instruction: "Add Mr. Neil Bayos's email (pako_28@nomail.com).", hint: "AP pako_28@nomail.com", matcher: /^AP\s+PAKO_28@NOMAIL\.COM$/ },
      { instruction: "Add Ms. Nhayanne Bayos's mobile number (09123456789).", hint: "AP 09123456789", matcher: /^AP\s+09123456789$/ },
      { instruction: "Add Ms. Nhayanne Bayos's email (bhoszx_nayan28@nomail.com).", hint: "AP bhoszx_nayan28@nomail.com", matcher: /^AP\s+BHOSZX_NAYAN28@NOMAIL\.COM$/ },
    ],
  },
  {
    id: "ticket",
    title: "3. Set the Ticketing Deadline & Save",
    goal: "Tickets must be issued to Ms. Nhayanne on or before September 16 — set that as the time limit, review, then save.",
    steps: [
      { instruction: "Set a ticketing time limit of September 16 (office code AGT).", hint: "TKTL16SEP/AGT", matcher: /^TKTL16SEP\/[A-Z0-9]+$/ },
      { instruction: "Review the PNR before saving.", hint: "RT", matcher: /^RT$/ },
      { instruction: "Save it — this returns your record locator.", hint: "ER", matcher: /^ER$/ },
    ],
  },
];
