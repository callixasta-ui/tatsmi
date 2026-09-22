// Flashcard data for the "Flashcards" study tab. Each card follows:
//   entry code -> meaning -> when to use -> a full example command -> a
//   token-by-token dissection of that example.
// Grouped under the same section headings as the COMMAND LIST tab so the
// two views stay easy to cross-reference.

export interface Dissection {
  part: string; // the literal token as it appears in the full command
  desc: string; // what that token means
}

export interface Flashcard {
  code: string; // the bare entry code, e.g. "AN"
  meaning: string; // short definition
  whenToUse: string; // the situation that calls for it
  fullCommand: string; // one realistic worked example
  dissection: Dissection[];
}

export interface FlashcardSection {
  section: string;
  cards: Flashcard[];
}

export const FLASHCARDS: FlashcardSection[] = [
  {
    section: "AVAILABILITY & SELL",
    cards: [
      {
        code: "AN",
        meaning: "Air availability -- lists flights and open classes for a route and date",
        whenToUse: "First step of any booking: see what's flying and which classes are open before you sell anything",
        fullCommand: "AN15DECLONBKK",
        dissection: [
          { part: "AN", desc: "entry code -- Availability, Neutral" },
          { part: "15", desc: "day of month" },
          { part: "DEC", desc: "month, 3-letter code" },
          { part: "LON", desc: "origin city/airport code" },
          { part: "BKK", desc: "destination city/airport code" },
        ],
      },
      {
        code: "SS",
        meaning: "Sell seats in a class, from a line you saw on an AN display",
        whenToUse: "Right after AN, once you've picked a flight line and class to book",
        fullCommand: "SS1Y1",
        dissection: [
          { part: "SS", desc: "entry code -- Sell Segment" },
          { part: "1", desc: "(first) number of seats to sell" },
          { part: "Y", desc: "booking class" },
          { part: "1", desc: "(last) line number from the AN display" },
        ],
      },
    ],
  },
  {
    section: "PNR BUILD (5 mandatory before ER)",
    cards: [
      {
        code: "NM",
        meaning: "Adds a passenger name to the PNR",
        whenToUse: "Mandatory -- every PNR needs at least one name before it can be saved",
        fullCommand: "NM1SMITH/JOHN MR",
        dissection: [
          { part: "NM", desc: "entry code -- Name" },
          { part: "1", desc: "number of passengers sharing this surname" },
          { part: "SMITH", desc: "surname" },
          { part: "/", desc: "separates surname from given name" },
          { part: "JOHN", desc: "given name" },
          { part: "MR", desc: "title, optional" },
        ],
      },
      {
        code: "AP",
        meaning: "Adds a phone contact to the PNR",
        whenToUse: "Mandatory -- one of the four AP-family contact types is required before ER",
        fullCommand: "AP 6621234567",
        dissection: [
          { part: "AP", desc: "entry code -- general phone contact" },
          { part: "(space)", desc: "separates the code from the value" },
          { part: "6621234567", desc: "phone number" },
        ],
      },
      {
        code: "APM",
        meaning: "Adds a mobile phone contact to the PNR",
        whenToUse: "Same purpose as AP, but flags the number specifically as a mobile",
        fullCommand: "APM 09171234567",
        dissection: [
          { part: "APM", desc: "entry code -- mobile contact" },
          { part: "(space)", desc: "separates the code from the value" },
          { part: "09171234567", desc: "mobile number" },
        ],
      },
      {
        code: "APH",
        meaning: "Adds a home phone contact to the PNR",
        whenToUse: "Same purpose as AP, but flags the number specifically as a home line",
        fullCommand: "APH 021234567",
        dissection: [
          { part: "APH", desc: "entry code -- home contact" },
          { part: "(space)", desc: "separates the code from the value" },
          { part: "021234567", desc: "home phone number" },
        ],
      },
      {
        code: "APE",
        meaning: "Adds an email contact to the PNR",
        whenToUse: "Whenever you want to store an email address -- must use APE, not plain AP",
        fullCommand: "APE john@mail.com",
        dissection: [
          { part: "APE", desc: "entry code -- email contact" },
          { part: "(space)", desc: "separates the code from the value" },
          { part: "john@mail.com", desc: "email address" },
        ],
      },
      {
        code: "TKOK",
        meaning: "Ticketing arrangement: no time limit",
        whenToUse: "Mandatory ticketing element -- use when the ticket can be issued any time before departure",
        fullCommand: "TKOK",
        dissection: [
          { part: "TK", desc: "entry code -- ticketing arrangement" },
          { part: "OK", desc: "qualifier -- ok to ticket any time, no deadline" },
        ],
      },
      {
        code: "TKTL",
        meaning: "Ticketing arrangement: a real time-limit deadline",
        whenToUse: "Mandatory ticketing element -- use instead of TKOK when the ticket must be issued by a specific date/time",
        fullCommand: "TKTL20JAN/1700",
        dissection: [
          { part: "TK", desc: "entry code -- ticketing arrangement" },
          { part: "TL", desc: "qualifier -- time limit" },
          { part: "20JAN", desc: "deadline date, ddMON" },
          { part: "/1700", desc: "deadline time, 24-hour" },
        ],
      },
      {
        code: "RF",
        meaning: "Received From -- the agent's signature",
        whenToUse: "Mandatory -- the last element ER checks for; records who supplied the booking",
        fullCommand: "RF JDOE",
        dissection: [
          { part: "RF", desc: "entry code -- Received From" },
          { part: "(space)", desc: "separates the code from the value" },
          { part: "JDOE", desc: "the agent's initials/signature" },
        ],
      },
    ],
  },
  {
    section: "OPTIONAL ELEMENTS",
    cards: [
      {
        code: "RM",
        meaning: "Free-text remark on the PNR",
        whenToUse: "For internal notes that don't need to reach the airline in a structured way",
        fullCommand: "RM VIP PAX",
        dissection: [
          { part: "RM", desc: "entry code -- Remark" },
          { part: "(space)", desc: "separates the code from the text" },
          { part: "VIP PAX", desc: "free text, anything you want" },
        ],
      },
      {
        code: "OS",
        meaning: "Other service info -- shows on the PNR as OSI",
        whenToUse: "To pass a note to the airline (not just internal), e.g. a ground contact",
        fullCommand: "OS CTC AT WORK",
        dissection: [
          { part: "OS", desc: "entry code you type -- displays as OSI once saved" },
          { part: "(space)", desc: "separates the code from the text" },
          { part: "CTC AT WORK", desc: "free text" },
        ],
      },
      {
        code: "FFN",
        meaning: "Frequent flyer number",
        whenToUse: "When the passenger wants their loyalty number attached to the booking",
        fullCommand: "FFN BA1234567",
        dissection: [
          { part: "FFN", desc: "entry code -- Frequent Flyer Number" },
          { part: "(space)", desc: "separates the code from the value" },
          { part: "BA", desc: "carrier code that issued the number" },
          { part: "1234567", desc: "member number" },
        ],
      },
      {
        code: "FXP",
        meaning: "Fare quote for the active PNR",
        whenToUse: "Once segments are sold, to see a price before ending the transaction",
        fullCommand: "FXP",
        dissection: [
          { part: "FXP", desc: "entry code, no parameters -- prices every segment in the active PNR" },
        ],
      },
      {
        code: "SM",
        meaning: "Seat map for a segment",
        whenToUse: "Before ST, to see which seats are open on a given flight",
        fullCommand: "SM2",
        dissection: [
          { part: "SM", desc: "entry code -- Seat Map" },
          { part: "2", desc: "segment number; omit for the last segment" },
        ],
      },
      {
        code: "ST",
        meaning: "Assign a specific seat to a passenger",
        whenToUse: "After SM, once you know which open seat you want",
        fullCommand: "ST/24A/P1",
        dissection: [
          { part: "ST", desc: "entry code -- Seat" },
          { part: "/24A", desc: "row and letter of the seat" },
          { part: "/P1", desc: "passenger number in the PNR" },
        ],
      },
    ],
  },
  {
    section: "TRANSACT & FIX MISTAKES",
    cards: [
      {
        code: "RT",
        meaning: "Redisplay the active, in-progress PNR",
        whenToUse: "Any time you want to see the PNR built so far, with elements numbered",
        fullCommand: "RT",
        dissection: [
          { part: "RT", desc: "entry code, no parameters -- redisplays the active PNR" },
        ],
      },
      {
        code: "XE",
        meaning: "Cancel a numbered element, a range, or several selected elements",
        whenToUse: "To remove a mistake -- look up the number(s) from RT first",
        fullCommand: "XE3-6",
        dissection: [
          { part: "XE", desc: "entry code -- Cancel Element" },
          { part: "3-6", desc: "a range of element numbers (or use 3,6 for just those two)" },
        ],
      },
      {
        code: "ER",
        meaning: "End transaction -- saves the PNR",
        whenToUse: "Once all 5 mandatory elements are on file: name, segment, contact, ticketing, RF",
        fullCommand: "ER",
        dissection: [
          { part: "ER", desc: "entry code, no parameters -- saves the PNR and returns a record locator" },
        ],
      },
      {
        code: "RT (retrieve)",
        meaning: "Retrieve a saved PNR by record locator or family name",
        whenToUse: "To pull up a booking that was already saved with ER, on a later visit",
        fullCommand: "RT7F3K2Q",
        dissection: [
          { part: "RT", desc: "entry code -- Retrieve" },
          { part: "7F3K2Q", desc: "6-character record locator, no punctuation (or use RT/SURNAME to search by name)" },
        ],
      },
      {
        code: "IG",
        meaning: "Ignore -- discards a brand-new PNR, or reverts an already-saved one to its last save",
        whenToUse: "New booking you don't want to keep: discards it. Editing a saved PNR and want to undo the session's changes: reverts to what ER last saved, instead of wiping it",
        fullCommand: "IG",
        dissection: [
          { part: "IG", desc: "entry code, no parameters -- discard (new PNR) or revert (saved PNR)" },
        ],
      },
    ],
  },
  {
    section: "SEGMENT VARIANTS & NAME MODIFIERS",
    cards: [
      {
        code: "SIARNK",
        meaning: "Arrival Unknown segment -- keeps itinerary continuity for a leg not flown",
        whenToUse: "When the passenger changes to another form of transport between two points in the itinerary",
        fullCommand: "SIARNK",
        dissection: [
          { part: "SI", desc: "transaction code" },
          { part: "ARNK", desc: "Arrival Unknown indicator" },
        ],
      },
      {
        code: "SO",
        meaning: "Open Flight Segment -- no confirmed date/flight yet, still pricing/ticketing-ready",
        whenToUse: "When the passenger's exact travel date isn't known but the segment must stay in the itinerary",
        fullCommand: "SOAFC8AUGCDGMNL",
        dissection: [
          { part: "SO", desc: "segment open transaction code" },
          { part: "AF", desc: "airline code" },
          { part: "C", desc: "class of service" },
          { part: "8AUG", desc: "fictitious date, recommended for pricing/ticketing" },
          { part: "CDGMNL", desc: "origin and destination" },
        ],
      },
      {
        code: "SS (waitlist)",
        meaning: "Sells into a waitlist and sets a priority code, when the class shows 0 open seats",
        whenToUse: "The class on your chosen line shows status 0 but you still want to try for a seat",
        fullCommand: "SS2F3/PE",
        dissection: [
          { part: "SS2F3", desc: "short sell entry -- 2 seats, class F, line 3" },
          { part: "/PE", desc: "priority waitlist code (airline-specific)" },
        ],
      },
      {
        code: "NM (infant)",
        meaning: "Attaches an infant's name to an adult's Name element",
        whenToUse: "Booking an infant who doesn't occupy their own seat",
        fullCommand: "NM1CRUZ/JANE MS (INFVICTOR/JOHN/12NOV20)",
        dissection: [
          { part: "CRUZ/JANE MS", desc: "the adult passenger" },
          { part: "(INFVICTOR/JOHN/12NOV20)", desc: "infant's surname VICTOR, given name JOHN, DOB 12NOV20 -- omit the surname if it matches the adult's" },
        ],
      },
      {
        code: "NU",
        meaning: "Name Update -- edits a passenger already on the PNR without recreating it",
        whenToUse: "To fix a first name, title, or CHD/INF modifier on a name already saved",
        fullCommand: "NU1/GRACE MS",
        dissection: [
          { part: "NU", desc: "entry code -- Name Update" },
          { part: "1", desc: "the passenger number to modify" },
          { part: "/GRACE MS", desc: "new first name and title" },
        ],
      },
    ],
  },
  {
    section: "REFERENCE & TRAINER-ONLY",
    cards: [
      {
        code: "DAC",
        meaning: "Decode a city/airport code into its name",
        whenToUse: "When you know the 3-letter code and need the full city name",
        fullCommand: "DACLON",
        dissection: [
          { part: "DAC", desc: "entry code -- Decode City" },
          { part: "LON", desc: "3-letter city/airport code to look up" },
        ],
      },
      {
        code: "DAN",
        meaning: "Encode a city name into its code",
        whenToUse: "The reverse of DAC -- when you know the name and need the 3-letter code",
        fullCommand: "DAN BANGKOK",
        dissection: [
          { part: "DAN", desc: "entry code -- Decode/Encode by Name" },
          { part: "(space)", desc: "separates the code from the search text" },
          { part: "BANGKOK", desc: "city name (or part of it) to search for" },
        ],
      },
      {
        code: "HE",
        meaning: "Help -- lists commands, or explains one",
        whenToUse: "Whenever you forget the format for something",
        fullCommand: "HE TKTL",
        dissection: [
          { part: "HE", desc: "entry code -- Help" },
          { part: "(space)", desc: "separates the code from the keyword" },
          { part: "TKTL", desc: "optional keyword -- narrows help to just that entry" },
        ],
      },
    ],
  },
];
