// Leveled quiz data for the QUIZ tab. Levels unlock in order -- a level is
// playable once the previous one has been passed. Passing a level (score
// at or above passFraction) unlocks a downloadable badge.

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizLevel {
  id: string;
  order: number;
  title: string;
  tagline: string;
  passFraction: number; // fraction of questions needed correct to pass, e.g. 0.7
  questions: QuizQuestion[];
}

export const QUIZ_LEVELS: QuizLevel[] = [
  {
    id: "level1",
    order: 1,
    title: "Availability & Sell",
    tagline: "AN and SS -- finding flights and selling seats",
    passFraction: 0.7,
    questions: [
      {
        id: "l1q1",
        prompt: "What does the AN command do?",
        options: [
          "Sells a seat in a class",
          "Displays flight availability for a route and date",
          "Cancels a PNR element",
          "Adds a passenger name",
        ],
        correctIndex: 1,
        explanation: "AN (Availability, Neutral) lists flights and open classes for a market and date.",
      },
      {
        id: "l1q2",
        prompt: "In AN15DECLONBKK, what does \u201cLON\u201d represent?",
        options: ["The airline carrier code", "The destination city", "The origin city", "The month"],
        correctIndex: 2,
        explanation: "The origin comes first, then the destination -- LON is origin, BKK is destination.",
      },
      {
        id: "l1q3",
        prompt: "Which command sells 1 seat in class Y from availability line 4?",
        options: ["SS1Y4", "SSY1L4", "SS4Y1", "SY1S4"],
        correctIndex: 0,
        explanation: "SS<seats><class><line> -- SS1Y4 sells 1 seat, class Y, from line 4.",
      },
      {
        id: "l1q4",
        prompt: "In SS1Y4, what does the final \u201c4\u201d refer to?",
        options: ["Number of seats", "Booking class", "Line number from the AN display", "Day of month"],
        correctIndex: 2,
        explanation: "The last number in an SS entry always points back to a line from the availability display.",
      },
      {
        id: "l1q5",
        prompt: "You display AN and a class shows \u201c0\u201d seats. If you sell into that class anyway, what happens?",
        options: [
          "The sell is rejected outright",
          "The seat is sold into a waitlist (HL status)",
          "It automatically upgrades to a higher class",
          "The command asks for a different class",
        ],
        correctIndex: 1,
        explanation: "A \u201c0\u201d status means waitlist-only -- selling it gives an HL (waitlisted) segment instead of HK.",
      },
    ],
  },
  {
    id: "level2",
    order: 2,
    title: "PNR Build",
    tagline: "The 5 mandatory elements before you can save a booking",
    passFraction: 0.7,
    questions: [
      {
        id: "l2q1",
        prompt: "Which of these is NOT one of the 5 mandatory elements before ER?",
        options: ["Name (NM)", "Received From (RF)", "Seat assignment (ST)", "Ticketing arrangement (TKOK/TKTL)"],
        correctIndex: 2,
        explanation: "Seat assignment (ST) is optional. The 5 mandatory elements are name, segment, contact, ticketing, and RF.",
      },
      {
        id: "l2q2",
        prompt: "What is the correct format to add passenger John Smith with title MR?",
        options: ["NM1SMITH/JOHN MR", "NMSMITH JOHN/MR", "NM1 SMITH JOHN MR", "NAME1SMITH/JOHN"],
        correctIndex: 0,
        explanation: "NM<count><SURNAME>/<GIVEN NAME> <TITLE> -- e.g. NM1SMITH/JOHN MR.",
      },
      {
        id: "l2q3",
        prompt: "Which contact command must be used for an email address?",
        options: ["AP", "APH", "APE", "APM"],
        correctIndex: 2,
        explanation: "APE is the email-specific contact entry -- plain AP won't record it as an email.",
      },
      {
        id: "l2q4",
        prompt: "TKTL20JAN/1700 sets a ticketing deadline. What does \u201c/1700\u201d represent?",
        options: [
          "The flight time",
          "The deadline time, 24-hour clock",
          "The date the PNR was created",
          "The record locator",
        ],
        correctIndex: 1,
        explanation: "TKTL<ddMON>/<HHMM> -- the part after the slash is the deadline time in 24-hour format.",
      },
      {
        id: "l2q5",
        prompt: "What is the purpose of the RF element?",
        options: [
          "Displays the fare quote",
          "Records who booked/received the PNR (agent signature)",
          "Refunds the ticket",
          "Redisplays the PNR",
        ],
        correctIndex: 1,
        explanation: "RF (Received From) is the mandatory agent signature -- who took the booking.",
      },
    ],
  },
  {
    id: "level3",
    order: 3,
    title: "Optional Elements",
    tagline: "Remarks, OSI, frequent flyer, fares, and seats",
    passFraction: 0.7,
    questions: [
      {
        id: "l3q1",
        prompt: "Which command shows as OSI once saved to the PNR, even though you type something else?",
        options: ["RM", "OS", "FFN", "AP"],
        correctIndex: 1,
        explanation: "You type OS, but the saved element displays as OSI -- Other Service Information.",
      },
      {
        id: "l3q2",
        prompt: "What does FXP do?",
        options: [
          "Displays a seat map",
          "Fare-quotes every segment currently in the active PNR",
          "Adds a frequent flyer number",
          "Cancels a fare",
        ],
        correctIndex: 1,
        explanation: "FXP prices every segment on file in the active PNR -- no parameters needed.",
      },
      {
        id: "l3q3",
        prompt: "In ST/24A/P1, what does \u201cP1\u201d mean?",
        options: ["Seat row", "Passenger number 1", "Class of service", "Segment number"],
        correctIndex: 1,
        explanation: "ST/<seat>/P<n> assigns the given seat to passenger number n in the PNR.",
      },
      {
        id: "l3q4",
        prompt: "Which command displays the seat map for the second segment specifically?",
        options: ["SM", "SM2", "ST2", "SS2"],
        correctIndex: 1,
        explanation: "SM<n> maps segment n -- SM alone defaults to the last segment.",
      },
      {
        id: "l3q5",
        prompt: "FFN BA1234567 -- what does \u201cBA\u201d represent?",
        options: [
          "The class of service",
          "The carrier that issued the frequent flyer number",
          "The booking reference",
          "The country code",
        ],
        correctIndex: 1,
        explanation: "FFN <carrier><number> -- BA is the airline that issued the loyalty number.",
      },
    ],
  },
  {
    id: "level4",
    order: 4,
    title: "Transact & Fix Mistakes",
    tagline: "RT, XE, ER, retrieving, and IG",
    passFraction: 0.7,
    questions: [
      {
        id: "l4q1",
        prompt: "Which command redisplays the PNR you're currently building, with elements numbered?",
        options: ["RT", "SS", "ER", "HE"],
        correctIndex: 0,
        explanation: "RT with no parameters redisplays the active, in-progress PNR.",
      },
      {
        id: "l4q2",
        prompt: "You need to remove element number 3 from the active PNR. Which command?",
        options: ["DEL3", "XE3", "RM3", "IG3"],
        correctIndex: 1,
        explanation: "XE<n> cancels the element numbered n, using the numbering shown by RT.",
      },
      {
        id: "l4q3",
        prompt: "What does ER require before it will succeed?",
        options: [
          "Only a name and a segment",
          "All 5 mandatory elements: name, segment, contact, ticketing, RF",
          "Just a seat assignment",
          "A fare quote",
        ],
        correctIndex: 1,
        explanation: "ER (End & Retrieve) checks for all 5 mandatory elements before it will save the PNR.",
      },
      {
        id: "l4q4",
        prompt: "How do you retrieve an already-saved PNR with locator 7F3K2Q?",
        options: ["RT/7F3K2Q", "RETRIEVE 7F3K2Q", "RT7F3K2Q", "GET7F3K2Q"],
        correctIndex: 2,
        explanation: "RT followed directly by the 6-character locator, no punctuation, retrieves a saved PNR.",
      },
      {
        id: "l4q4b",
        prompt: "How do you retrieve a saved PNR by the passenger's family name GARCIA instead of the locator?",
        options: ["RTGARCIA", "RT/GARCIA", "RT NAME GARCIA", "NM/GARCIA"],
        correctIndex: 1,
        explanation: "RT/<SURNAME> retrieves by family name -- the slash is what distinguishes a name search from a bare locator.",
      },
      {
        id: "l4q5",
        prompt: "You never saved this PNR (no locator yet) and type IG. What happens?",
        options: [
          "Saves the PNR permanently",
          "Discards everything -- the PNR was still in creation",
          "Displays help",
          "Issues the ticket",
        ],
        correctIndex: 1,
        explanation: "IG on a PNR still being created (never saved) discards it entirely. But IG on an already-saved PNR you're editing instead reverts it to its last-saved form -- it doesn't wipe a saved booking.",
      },
      {
        id: "l4q6",
        prompt: "How do you cancel elements 3 through 6 in one entry?",
        options: ["XE3-6", "XE3,4,5,6", "DEL3-6", "XE(3:6)"],
        correctIndex: 0,
        explanation: "XE<a>-<b> cancels a range of elements. XE<a>,<b> is for selected (non-contiguous) elements instead, e.g. XE5,7.",
      },
    ],
  },
  {
    id: "level5",
    order: 5,
    title: "Reference & Trainer-only",
    tagline: "City decode/encode and help",
    passFraction: 0.7,
    questions: [
      {
        id: "l5q1",
        prompt: "Which command decodes a 3-letter city code into its full name?",
        options: ["DAN", "DAC", "HE", "AN"],
        correctIndex: 1,
        explanation: "DAC (Decode City) turns a 3-letter code into its full name.",
      },
      {
        id: "l5q2",
        prompt: "DAN BANGKOK is used to...",
        options: [
          "Book a flight to Bangkok",
          "Find the 3-letter city code for Bangkok",
          "Display availability to Bangkok",
          "Cancel a Bangkok segment",
        ],
        correctIndex: 1,
        explanation: "DAN is the reverse of DAC -- it encodes a city name back into its code.",
      },
      {
        id: "l5q3",
        prompt: "What does \u201cHE TKTL\u201d do?",
        options: [
          "Runs the TKTL command directly",
          "Shows help specifically about the TKTL entry",
          "Time-limits the ticket for 1700",
          "Nothing, it's invalid",
        ],
        correctIndex: 1,
        explanation: "HE followed by a keyword narrows the help listing to just that entry.",
      },
      {
        id: "l5q4",
        prompt: "Which of these is a trainer-only convenience, not a real Amadeus command?",
        options: ["CLS", "RT", "ER", "NM"],
        correctIndex: 0,
        explanation: "CLS just clears the screen for convenience in this trainer -- it isn't a real Amadeus entry.",
      },
      {
        id: "l5q5",
        prompt: "What is the general purpose of the DAC/DAN pair?",
        options: [
          "Decode and cancel a PNR",
          "Convert between city codes and city names",
          "Display availability and negotiate fares",
          "Direct-sell and negotiate",
        ],
        correctIndex: 1,
        explanation: "Together, DAC and DAN convert back and forth between city codes and city names.",
      },
    ],
  },
  {
    id: "level6",
    order: 6,
    title: "Segment Variants & Family Names",
    tagline: "ARNK, open segments, waitlists, dual sells, and CHD/INF names",
    passFraction: 0.7,
    questions: [
      {
        id: "l6q1",
        prompt: "The passenger is switching from a flight to a train mid-trip. Which entry keeps the itinerary continuous?",
        options: ["SIARNK", "SO", "XE", "RM ARNK"],
        correctIndex: 0,
        explanation: "SIARNK adds an Arrival Unknown segment -- an information-only entry with no flight, used purely to keep segment continuity.",
      },
      {
        id: "l6q2",
        prompt: "You don't know the exact travel date yet, but need the segment in the itinerary for pricing. Which entry, and why include a date like 8AUG?",
        options: [
          "SO -- the date is required and must be real",
          "SO -- a fictitious date is recommended for pricing/ticketing",
          "SIARNK -- dates are always fictitious there",
          "SS -- with an invalid line number",
        ],
        correctIndex: 1,
        explanation: "SO (Open Flight Segment) doesn't need a real date, but a fictitious one like 8AUG is recommended so pricing and ticketing still work.",
      },
      {
        id: "l6q3",
        prompt: "A class shows status 0 on the availability display. What happens if you sell it with SS2F3/PE?",
        options: [
          "The entry is refused outright",
          "It sells 2 seats confirmed, ignoring the /PE",
          "It sells into a waitlist, with PE recorded as the priority code",
          "/PE cancels the sell",
        ],
        correctIndex: 2,
        explanation: "Status 0 means the class is open but shows no seats -- SS still sells it, but waitlisted, and /PE attaches an airline-specific priority code to that waitlist request.",
      },
      {
        id: "l6q4",
        prompt: "What does SS1F2*C12 do?",
        options: [
          "Sells F class on line 2 twice",
          "Sells one F-class seat from line 2 of the first availability display, and one C-class seat from line 12 of the second",
          "Sells 12 seats in class C",
          "It's invalid -- SS can't use an asterisk",
        ],
        correctIndex: 1,
        explanation: "This is a Dual City Pair sell: one class/line from each half of a dual (AN...*...) availability display, in a single entry.",
      },
      {
        id: "l6q5",
        prompt: "On the PNR, a segment shows status 'LK'. What does that mean?",
        options: [
          "The segment is waitlisted",
          "Confirmed, sold from Direct Access mode",
          "Confirmed, sold from Standard Access with a 12-hour wait",
          "The segment was cancelled by the airline",
        ],
        correctIndex: 1,
        explanation: "LK means the seat was sold and confirmed from Direct Access mode. DK is full-access/access-sell, SS is standard access, and a waitlisted sell shows LL instead.",
      },
      {
        id: "l6q6",
        prompt: "Which entry adds two passengers, HANS and HEIDI, both surnamed REYES, in a single line?",
        options: [
          "NM1REYES/HANS MR + NM1REYES/HEIDI MS",
          "NM2REYES/HANS MR/HEIDI MS",
          "NM2REYES,HANS,HEIDI",
          "NM REYES(HANS,HEIDI)",
        ],
        correctIndex: 1,
        explanation: "One Name entry can hold several passengers sharing a surname -- chain each additional first name/title after another '/'.",
      },
      {
        id: "l6q7",
        prompt: "What does the (CHD/12DEC16) modifier on a name entry mean?",
        options: [
          "The passenger needs a child meal",
          "The passenger is a child, born 12DEC16",
          "The flight is on 12DEC, child fare",
          "Cancel this child's segment",
        ],
        correctIndex: 1,
        explanation: "(CHD/ddMMMyy) marks the passenger as a child and records their date of birth.",
      },
      {
        id: "l6q8",
        prompt: "NM1CRUZ/JANE MS(INFVICTOR/JOHN/12NOV20) -- what does this tell you about the infant?",
        options: [
          "The infant's name is Cruz, born 12NOV20",
          "The infant is named John Victor, born 20NOV12",
          "The infant's surname is Victor, given name John, born 12NOV20, different from the adult's surname (Cruz)",
          "It's invalid -- infants must share the adult's surname",
        ],
        correctIndex: 2,
        explanation: "When the infant's surname differs from the adult's, it's spelled out right after INF: (INF<SURNAME>/first/dob). Same surname would just be (INF/first/dob).",
      },
      {
        id: "l6q9",
        prompt: "A name entry ends in (INS). What does that mean, and what do you still need to do?",
        options: [
          "Nothing else -- INS books the seat automatically",
          "This passenger is an infant needing insurance -- add FFN next",
          "This name is an infant registered as their own passenger -- still need SR INFT to actually request a seat",
          "INS means 'inactive segment' -- remove it before ER",
        ],
        correctIndex: 2,
        explanation: "(INS) registers the infant as a full passenger in their own right, but doesn't reserve a seat by itself -- follow up with SR INFT - <text> /P<n>.",
      },
      {
        id: "l6q10",
        prompt: "You saved passenger 1 as 'GRACE MR' by mistake -- should be 'GRACE MS'. Fastest fix?",
        options: [
          "XE1 then re-add the name",
          "NU1/GRACE MS",
          "RM GRACE MS",
          "There's no way to fix a title without recreating the PNR",
        ],
        correctIndex: 1,
        explanation: "NU (Name Update) edits an existing passenger's first name/title/modifier in place, without cancelling and re-adding the whole name element.",
      },
      {
        id: "l6q11",
        prompt: "What does IR show, and when would you use it?",
        options: [
          "It ignores the PNR and redisplays a blank screen",
          "After ending a PNR, it shows the airline's own record locator for each air segment",
          "It reprices the itinerary",
          "It's identical to RT",
        ],
        correctIndex: 1,
        explanation: "IR (Ignore and Redisplay) shows a partial copy of the PNR with the airline's own record locator per segment, once the PNR participates in RLR.",
      },
    ],
  },
];
