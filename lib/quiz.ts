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
        options: ["Name (NM)", "Received From (RF)", "A free-text remark", "Ticketing arrangement (TKOK/TKTL)"],
        correctIndex: 2,
        explanation: "A free-text remark is optional. The 5 mandatory elements are name, segment, contact, ticketing, and RF.",
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
        prompt: "Which entry is the correct format for an email contact for passenger 1?",
        options: ["AP exazakana@gmail.com", "APH exazakana@gmail.com", "ape-exazakana@gmail.com/P1", "apm-exazakana@gmail.com/P1"],
        correctIndex: 2,
        explanation: "Email uses ape-<email>/P<n>. apm- is for mobile numbers, and plain AP/APH are for phone numbers.",
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
          "Displays the list of flights",
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
    title: "Contacts & Ticketing Deadline",
    tagline: "apm-, ape-, the /P passenger number, TKOK and TKTL",
    passFraction: 0.7,
    questions: [
      {
        id: "l3q1",
        prompt: "Which entry correctly adds the mobile number 09123456789 for the first passenger?",
        options: ["apm-09123456789/P1", "APM 09123456789", "apm09123456789/1", "apm/09123456789-P1"],
        correctIndex: 0,
        explanation: "Mobile contacts use the format apm-<number>/P<n>: lowercase apm, a hyphen, the number, then /P and the passenger number.",
      },
      {
        id: "l3q2",
        prompt: "Which entry correctly adds the email exazakana@gmail.com for passenger 1?",
        options: ["APE exazakana@gmail.com", "ape-exazakana@gmail.com/P1", "ape/exazakana@gmail.com-P1", "ape exazakana@gmail.com/P1"],
        correctIndex: 1,
        explanation: "Email contacts use ape-<email>/P<n> -- the same hyphen format as apm, ending with the passenger number.",
      },
      {
        id: "l3q3",
        prompt: "In ape-exazakana@gmail.com/P2, what does \u201cP2\u201d mean?",
        options: ["Page 2 of the PNR", "Passenger number 2 -- the contact belongs to the second passenger", "Priority code 2", "Segment number 2"],
        correctIndex: 1,
        explanation: "/P<n> is the passenger number in the PNR (P1 = first name added, P2 = second, and so on). It changes depending on who the contact belongs to.",
      },
      {
        id: "l3q4",
        prompt: "A booking has 3 passengers and the mobile number belongs to the third one. Which ending is correct?",
        options: ["/P1", "/P2", "/P3", "/P0"],
        correctIndex: 2,
        explanation: "The third passenger is P3, so the entry is apm-<number>/P3. A number higher than the passengers in the PNR is rejected.",
      },
      {
        id: "l3q5",
        prompt: "What must be in the PNR before an apm- or ape- contact for passenger 1 can be added?",
        options: ["A ticket number", "The passenger name (NM)", "A flight availability display", "A Received From (RF)"],
        correctIndex: 1,
        explanation: "The /P number refers to a passenger already in the PNR, so add the name with NM first.",
      },
      {
        id: "l3q6",
        prompt: "What is the difference between TKOK and TKTL20JAN/1700?",
        options: [
          "TKOK sets a deadline; TKTL has no deadline",
          "TKOK means no time limit; TKTL sets a date and time deadline for ticketing",
          "They are identical",
          "TKTL issues the ticket right away",
        ],
        correctIndex: 1,
        explanation: "TKOK is a ticketing arrangement with no time limit. TKTL<ddMMM>/<hhmm> sets a specific date and 24-hour time to ticket by.",
      },
    ],
  },
  {
    id: "level4",
    order: 4,
    title: "Review & Save",
    tagline: "RT, ER and ET -- checking and saving the booking",
    passFraction: 0.7,
    questions: [
      {
        id: "l4q1",
        prompt: "What does RT do while you are still building a PNR?",
        options: [
          "Sells a seat",
          "Redisplays the active PNR with every element numbered",
          "Saves the PNR",
          "Adds a Received From",
        ],
        correctIndex: 1,
        explanation: "RT redisplays the PNR built so far -- a quick way to check your names, segments, contacts and ticketing before saving.",
      },
      {
        id: "l4q2",
        prompt: "What does ER require before it will succeed?",
        options: [
          "Only a name and a segment",
          "All 5 mandatory elements: name, segment, contact, ticketing, RF",
          "Just a phone number",
          "A flight availability display",
        ],
        correctIndex: 1,
        explanation: "ER (End & Retrieve) checks for all 5 mandatory elements before it will save the PNR.",
      },
      {
        id: "l4q3",
        prompt: "You type ER but forgot the RF. What happens?",
        options: [
          "The PNR is saved without it",
          "ER refuses to save and lists the mandatory element(s) still missing",
          "The PNR is deleted",
          "RF is added automatically",
        ],
        correctIndex: 1,
        explanation: "ER does not save an incomplete PNR -- it tells you exactly which of the 5 mandatory elements is missing so you can add it and try again.",
      },
      {
        id: "l4q4",
        prompt: "What is the difference between ER and ET?",
        options: [
          "None -- they are identical",
          "ER saves and leaves the PNR open on screen; ET saves and clears the screen for the next booking",
          "ER saves; ET deletes the PNR",
          "ET works without the 5 mandatory elements",
        ],
        correctIndex: 1,
        explanation: "Both save the PNR and return a record locator, and both need the 5 mandatory elements. ER keeps the PNR on screen; ET clears the screen so the next booking starts clean.",
      },
    ],
  },
  {
    id: "level5",
    order: 5,
    title: "Segment Variants & Family Names",
    tagline: "ARNK, open segments, waitlists, dual sells, and CHD/INF names",
    passFraction: 0.7,
    questions: [
      {
        id: "l6q1",
        prompt: "The passenger is switching from a flight to a train mid-trip. Which entry keeps the itinerary continuous?",
        options: ["SIARNK", "SO", "SR", "NU ARNK"],
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
          "This passenger is an infant needing insurance -- add a phone contact next",
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
          "Cancel the booking and start over",
          "NU1/GRACE MS",
          "SR GRACE MS",
          "There's no way to fix a title without recreating the PNR",
        ],
        correctIndex: 1,
        explanation: "NU (Name Update) edits an existing passenger's first name/title/modifier in place, without cancelling and re-adding the whole name element.",
      },
    ],
  },
];
