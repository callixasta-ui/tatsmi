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
    id: "t1",
    title: "1. Your First Availability Check",
    goal: "Learn the AN entry: pull flight availability for a specific route and date.",
    steps: [
      {
        instruction: "Check availability from Manila (MNL) to Cebu (CEB) for December 20.",
        hint: "AN20DECMNLCEB",
        matcher: /^AN20DECMNLCEB$/,
      },
    ],
  },
  {
    id: "t2",
    title: "2. Sell Your First Seat",
    goal: "Learn the SS entry: sell a seat from a line on the availability screen.",
    steps: [
      {
        instruction: "Check availability from London (LON) to Bangkok (BKK) for December 15.",
        hint: "AN15DECLONBKK",
        matcher: /^AN15DECLONBKK$/,
      },
      {
        instruction: "Sell 1 seat in class Y from line 1 of that screen.",
        hint: "SS1Y1",
        matcher: /^SS1Y1$/,
      },
    ],
  },
  {
    id: "t3",
    title: "3. Build a Complete Booking",
    goal: "Chain availability, sell, name, contact and ticketing into one bookable PNR.",
    steps: [
      {
        instruction: "Check availability from New York (NYC) to Paris (PAR) for January 5.",
        hint: "AN05JANNYCPAR",
        matcher: /^AN05JANNYCPAR$/,
      },
      {
        instruction: "Sell 1 seat in class M from line 2.",
        hint: "SS1M2",
        matcher: /^SS1M2$/,
      },
      {
        instruction: "Add the passenger: last name DELACRUZ, first name MARIA, title MS.",
        hint: "NM1DELACRUZ/MARIA MS",
        matcher: /^NM1DELACRUZ\/MARIA(\s+MS)?$/,
      },
      {
        instruction: "Add a contact phone number (any number works).",
        hint: "AP 09171234567",
        matcher: /^AP\s+.+$/,
      },
      {
        instruction: "Set the ticketing arrangement to no time limit.",
        hint: "TKOK",
        matcher: /^TKOK$/,
      },
      {
        instruction: "Review the PNR before saving it.",
        hint: "RT",
        matcher: /^RT$/,
      },
      {
        instruction: "Save it -- this returns your record locator. Write it down, you'll need it next.",
        hint: "ER",
        matcher: /^ER$/,
      },
    ],
  },
  {
    id: "t4",
    title: "4. Retrieve a Saved PNR",
    goal: "Learn RT* -- pull back a booking using its record locator.",
    steps: [
      {
        instruction: "Using the record locator ER gave you in Task 3, retrieve that PNR.",
        hint: "RT*<YOUR-LOCATOR>  (e.g. RT*7F3K2Q -- use the code YOU were given, not this example)",
        matcher: /^RT\*[A-Z0-9]{6}$/,
      },
    ],
  },
  {
    id: "t5",
    title: "5. Decode & Walk Away Clean",
    goal: "Learn DAC for reference lookups, and IG for abandoning work without saving it.",
    steps: [
      {
        instruction: "Decode the city code SIN.",
        hint: "DACSIN",
        matcher: /^DACSIN$/,
      },
      {
        instruction: "Start something new -- check availability from Hong Kong (HKG) to Sydney (SYD) for March 10 -- then abandon it without ever saving.",
        hint: "AN10MARHKGSYD then IG",
        matcher: /^AN10MARHKGSYD$/,
      },
      {
        instruction: "Now actually abandon it.",
        hint: "IG",
        matcher: /^IG$/,
      },
    ],
  },
];
