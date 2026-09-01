// ============================================================
// THINK TANK TYCOON — data & decks
// All tuning knobs live in TUNE. All content decks live below.
// ============================================================

const TUNE = {
  supportRatio: 2,     // scholars supported per ops staffer
  fightSlots: 4,       // active policy fights on the board
  donorSlots: 3,       // donors in the market at once
  hireSlots: 4,        // candidates in the hiring market
  signingMonths: 1,    // signing bonus = N months salary
  severanceMonths: 1,  // severance = N months salary
  strikeLimit: 2,      // strikes before a donor walks
  unsupportedMult: 0.5,// output multiplier for unsupported scholars
  flavorChance: 0.35,  // chance of a no-effect Bugle headline each month
  startYear: 2027,
};

const TAGS = ['TAX','DEF','TECH','HLTH','CLIM','TRADE'];
const TAG_NAMES = {
  TAX:  'Fiscal Policy',
  DEF:  'Defense & Security',
  TECH: 'Technology Policy',
  HLTH: 'Health Policy',
  CLIM: 'Energy & Climate',
  TRADE:'Trade & Infrastructure',
};

// ------------------------------------------------------------
// Think tanks. align: -2 left ... +2 right. Unchosen ones become rivals.
// budget = influence/month they throw at fights as an AI rival.
// ------------------------------------------------------------
const TANKS = [
  {
    id:'hutchings', name:'The Hutchings Institution', short:'Hutchings',
    motto:'Quality. Independence. Impact. Parking Validation.',
    align:-1, alignLabel:'Center-Left', size:'LARGE', diff:'Comfy',
    blurb:'The establishment. A marble building full of former officials waiting to become current officials again.',
    cash:2400, rent:80, scholars:5, ops:2, influence:20,
    donors:['waterworks','tomorrow'], budget:45, tags:['TAX','HLTH','TRADE'],
  },
  {
    id:'legacy', name:'The Legacy Foundation', short:'Legacy',
    motto:'Building an America the Founders Would Recognize, Legally.',
    align:2, alignLabel:'Right', size:'LARGE', diff:'Comfy',
    blurb:'A battleship with a gift shop. Twelve field marshals of the culture war and a truly excellent mailing list.',
    cash:2200, rent:70, scholars:5, ops:2, influence:20,
    donors:['pemberton','hexagon'], budget:45, tags:['TAX','DEF','CLIM'],
  },
  {
    id:'forum', name:'The Free Enterprise Forum', short:'The Forum',
    motto:'Markets Have Feelings Too.',
    align:1, alignLabel:'Center-Right', size:'MEDIUM', diff:'Standard',
    blurb:'Tweedy, respectable, pro-business. Hosts the politest disagreements in town, with sandwiches.',
    cash:1000, rent:45, scholars:3, ops:1, influence:25,
    donors:['retail'], budget:30, tags:['TAX','TRADE','TECH'],
  },
  {
    id:'momentum', name:'Center for American Momentum', short:'Momentum',
    motto:'The Arc of History Needs a Push.',
    align:-2, alignLabel:'Left', size:'MEDIUM', diff:'Standard',
    blurb:'Runs on cold brew and five-point plans. Everyone on staff is either 29 or 63.',
    cash:900, rent:45, scholars:3, ops:1, influence:25,
    donors:['billionaires'], budget:30, tags:['HLTH','CLIM','TECH'],
  },
  {
    id:'hand', name:'The Invisible Hand Society', short:'The Hand',
    motto:'Leave Us Alone. Also, Fund Us.',
    align:1, alignLabel:'Libertarian', size:'SMALL', diff:'Scrappy',
    blurb:'Six people with four opinions each. The newsletter is, by all accounts, legendary.',
    cash:450, rent:25, scholars:2, ops:1, influence:30,
    donors:['ashgrove'], budget:18, tags:['TAX','TECH','TRADE'],
  },
  {
    id:'subsidiarity', name:'The Subsidiarity Project', short:'Subsidiarity',
    motto:'Small Is Beautiful. So Is Our Budget.',
    align:0, alignLabel:'Post-Liberal', size:'TINY', diff:'Hard Mode',
    blurb:'Three converts and a fax machine, arguing that everything went wrong in 1789.',
    cash:300, rent:15, scholars:1, ops:1, influence:35,
    donors:[], budget:10, tags:['HLTH','TECH'],
  },
];

// Always-on NPC rival, never selectable.
const NPC_TANKS = [
  { id:'bland', name:'The BLAND Corporation', short:'BLAND',
    motto:'We Have Modeled This.', align:0, budget:40, tags:['DEF','TECH'] },
];

// ------------------------------------------------------------
// Donor deck. lean: -1/0/+1. demand types:
//   ROSTER  {tag}  — must employ a scholar with that tag
//   PROGRAM {pid}  — must keep that program running
//   NOCROSS {tag?} — instant strike if you back a side whose lean opposes
//                    theirs (in that tag's fights, or any fight if tag null)
// ------------------------------------------------------------
const DONORS = [
  { id:'pemberton', name:'The Pemberton Family Trust', grant:120, cost:50, lean:1,
    demand:{type:'ROSTER', tag:'TAX'},
    blurb:'Fourth-generation money, first-generation opinions.' },
  { id:'retail', name:'The Colossal Retail Coalition', grant:160, cost:60, lean:1,
    demand:{type:'NOCROSS', tag:'TRADE'},
    blurb:'Nine hundred big-box stores in a trench coat.' },
  { id:'tomorrow', name:'Foundation for a Considerably Better Tomorrow', grant:140, cost:55, lean:-1,
    demand:{type:'ROSTER', tag:'CLIM'},
    blurb:'Optimism, but with a fiduciary duty.' },
  { id:'delaware', name:'Anonymous (A Delaware LLC)', grant:200, cost:80, lean:0,
    demand:{type:'PROGRAM', pid:'lobby'},
    blurb:'Prefers the donor wall. Ironically.' },
  { id:'vantage', name:'Vantage Petroleum “Beyond Petroleum, Eventually” Fund', grant:220, cost:80, lean:1,
    demand:{type:'NOCROSS', tag:'CLIM'},
    blurb:'Extremely interested in the word “transition.”' },
  { id:'blevins', name:'The Blevins Prize Committee', grant:90, cost:35, lean:0,
    demand:{type:'PROGRAM', pid:'gala'},
    blurb:'Gives out an award; expects one back.' },
  { id:'crypto', name:'The Crypto Council for Freedom', grant:180, cost:70, lean:1,
    demand:{type:'ROSTER', tag:'TECH'},
    blurb:'Down 60% since you read this card.' },
  { id:'sisters', name:'Sisters of Perpetual Responsibility', grant:80, cost:30, lean:-1,
    demand:{type:'NOCROSS', tag:'HLTH'},
    blurb:'Divested from everything fun.' },
  { id:'marchetti', name:'The Marchetti Endowment for the Performing Policies', grant:110, cost:45, lean:0,
    demand:{type:'PROGRAM', pid:'podcast'},
    blurb:'Wants content.' },
  { id:'hexagon', name:'Hexagon Defense Solutions', grant:240, cost:90, lean:1,
    demand:{type:'ROSTER', tag:'DEF'},
    blurb:'One more side than the leading competitor.' },
  { id:'werther', name:'The Werther Family “Kids These Days” Initiative', grant:130, cost:50, lean:-1,
    demand:{type:'ROSTER', tag:'TECH'},
    blurb:'The kids are on their phones. Do a study.' },
  { id:'billionaires', name:'Global Panel of Concerned Billionaires', grant:260, cost:100, lean:-1,
    demand:{type:'PROGRAM', pid:'gala'},
    blurb:'The concern is tax-deductible.' },
  { id:'ashgrove', name:'The Ashgrove Society', grant:100, cost:40, lean:1,
    demand:{type:'PROGRAM', pid:'lobby'},
    blurb:'Chesterfield chairs, Chesterton fences.' },
  { id:'waterworks', name:'Municipal Waterworks Retirement System', grant:150, cost:60, lean:0,
    demand:{type:'ROSTER', tag:'HLTH'},
    blurb:'Fiduciaries with feelings.' },
  { id:'tiktank', name:'The TikTank Creators Fund', grant:120, cost:50, lean:0,
    demand:{type:'PROGRAM', pid:'podcast'},
    blurb:'Policy, but make it vertical video.' },
  { id:'coalition', name:'The Coalition Against The Other Coalition', grant:140, cost:55, lean:1,
    demand:{type:'NOCROSS', tag:null},
    blurb:'You know the one.' },
  { id:'assembly', name:'The People’s Assembly Foundation', grant:140, cost:55, lean:-1,
    demand:{type:'NOCROSS', tag:null},
    blurb:'The people have notes.' },
];

// ------------------------------------------------------------
// Programs: money sinks that satisfy donor demands. Bloat with a purpose.
// ------------------------------------------------------------
const PROGRAMS = [
  { id:'gala', name:'Annual Gala Series', cost:10, inf:0,
    blurb:'An ice sculpture of the Capitol, melting onto the raw bar.' },
  { id:'podcast', name:'In-House Podcast Studio', cost:6, inf:2,
    blurb:'Episode 44: “So, Walk Me Through the Paper.”' },
  { id:'lobby', name:'Marble Lobby & Donor Wall', cost:8, inf:0,
    blurb:'Names engraved in order of generosity.' },
];

// ------------------------------------------------------------
// Policy fight deck. {NOM} in a title is replaced with a generated name.
// Side lean: -1 left-coded, +1 right-coded, 0 nonpartisan pork.
// ------------------------------------------------------------
const FIGHTS = [
  { id:'serverfarms', type:'BILL', tag:'TECH', months:3, reward:350,
    title:'American Server Farms Act',
    sides:[{label:'Pass: Subsidize the Cloud', lean:-1},{label:'Block: Clouds Can Pay Rent', lean:1}] },
  { id:'snacc', type:'BILL', tag:'TAX', months:2, reward:200,
    title:'SNACC Act (Supplemental Nutrition Assistance for Congressional Cafeterias)',
    sides:[{label:'Pass: Fund the Cafeterias', lean:-1},{label:'Block: Brown-Bag It', lean:1}] },
  { id:'regreview', type:'EO', tag:'TAX', months:2, reward:250,
    title:'EO 14501: Regulatory Regularity Review',
    sides:[{label:'Uphold: Review the Reviews', lean:1},{label:'Rescind: Regulate in Peace', lean:-1}] },
  { id:'helium', type:'BILL', tag:'DEF', months:3, reward:300,
    title:'Strategic Helium Reserve Modernization Act',
    sides:[{label:'Pass: More Balloons', lean:0},{label:'Block: Fewer Balloons', lean:0}] },
  { id:'fednom', type:'NOM', tag:'TAX', months:2, reward:400,
    title:'Confirm {NOM} to the Federal Reserve Board',
    sides:[{label:'Confirm: Steady Hands', lean:-1},{label:'Reject: Audit Everything', lean:1}] },
  { id:'prek', type:'BILL', tag:'HLTH', months:4, reward:500,
    title:'Universal Pre-K Through Grad School Act',
    sides:[{label:'Pass: Cradle to Curriculum', lean:-1},{label:'Block: Somebody Do the Math', lean:1}] },
  { id:'chips2', type:'BILL', tag:'TECH', months:3, reward:400,
    title:'CHIPS II: The Re-Chippening',
    sides:[{label:'Pass: Fabs for All', lean:0},{label:'Block: Vibes-Based Industrial Policy', lean:0}] },
  { id:'ainice', type:'EO', tag:'TECH', months:2, reward:300,
    title:'EO 14522: AI Systems Shall Be Nice',
    sides:[{label:'Uphold: Mandatory Niceness', lean:-1},{label:'Rescind: Let Them Cook', lean:1}] },
  { id:'tariff', type:'BILL', tag:'TRADE', months:3, reward:350,
    title:'Tariff Schedule Harmonization (Now With More Tariffs)',
    sides:[{label:'Pass: Tariff Everything', lean:1},{label:'Block: Tariff Nothing', lean:-1}] },
  { id:'sealandia', type:'NOM', tag:'TRADE', months:2, reward:150,
    title:'Confirm {NOM} as Ambassador to Sealandia',
    sides:[{label:'Confirm: It’s a Real Place', lean:0},{label:'Reject: It’s a Platform', lean:0}] },
  { id:'cleancoal', type:'BILL', tag:'CLIM', months:3, reward:400,
    title:'Clean Coal, Dirty Solar Act',
    sides:[{label:'Pass: Coal Showers Daily', lean:1},{label:'Block: Read It Again, Slowly', lean:-1}] },
  { id:'balloons', type:'BILL', tag:'DEF', months:2, reward:200,
    title:'National Weather Balloon Transparency Act',
    sides:[{label:'Pass: Balloons Must Explain Themselves', lean:0},{label:'Block: Some Mystery Is Healthy', lean:0}] },
  { id:'medadv', type:'BILL', tag:'HLTH', months:3, reward:450,
    title:'Medicare Advantage Advantage Act',
    sides:[{label:'Pass: More Advantage', lean:1},{label:'Block: Define “Advantage”', lean:-1}] },
  { id:'rto', type:'EO', tag:'TAX', months:2, reward:250,
    title:'EO 14544: Return to Office (This Time We Mean It)',
    sides:[{label:'Uphold: Butts in Seats', lean:1},{label:'Rescind: Slack Is a Place', lean:-1}] },
  { id:'highways', type:'BILL', tag:'TRADE', months:2, reward:150,
    title:'Interstate Renaming Omnibus',
    sides:[{label:'Pass: Every Overpass Gets a Sponsor', lean:0},{label:'Block: I-95 Has Earned Its Name', lean:0}] },
  { id:'circuit', type:'NOM', tag:'TAX', months:3, reward:500,
    title:'Confirm {NOM} to the D.C. Circuit',
    sides:[{label:'Confirm: Eminently Qualified', lean:1},{label:'Reject: Those Footnotes, Though', lean:-1}] },
  { id:'pandemic', type:'BILL', tag:'HLTH', months:3, reward:300,
    title:'Pandemic Preparedness Preparedness Act',
    sides:[{label:'Pass: Prepare to Prepare', lean:-1},{label:'Block: We’ll Wing It Again', lean:1}] },
  { id:'rareearth', type:'BILL', tag:'CLIM', months:3, reward:350,
    title:'Rare Earths, Common Sense Act',
    sides:[{label:'Pass: Dig, Baby, Dig', lean:1},{label:'Block: Not In My Backyard, Specifically', lean:-1}] },
  { id:'deptdept', type:'EO', tag:'TAX', months:2, reward:300,
    title:'EO 14561: Establish the Department of Departments',
    sides:[{label:'Uphold: Someone Must Coordinate', lean:0},{label:'Rescind: It Coordinates Itself', lean:0}] },
  { id:'kosa', type:'BILL', tag:'TECH', months:3, reward:350,
    title:'Kids Online Extremely Safe Act',
    sides:[{label:'Pass: Think of the Children', lean:0},{label:'Block: The Children Have VPNs', lean:0}] },
];

// ------------------------------------------------------------
// Name & flavor pools for generated people.
// ------------------------------------------------------------
const FIRST_NAMES = ['Ainsley','Whit','Cordelia','Randall','Maxine','Tobias','June','Wendell',
  'Paulette','Omar','Ingrid','Chet','Meredith','Bradford','Priya','Dale','Vanessa','Harold',
  'Gwen','Marcus','Eleanor','Sy','Dotty','Lionel'];

const LAST_NAMES = ['Ferncliff','Buchwalter','Ostrander','Vandergriff','Okafor','Brightwood',
  'Stackhouse','Marbury','Quist','Halloran','Grimsby','Tanaka','Beauregard','Pennington',
  'Delacroix','Abernathy','Whitlock','Castellano','Bhatt','Lindqvist','Strathmore','Kowalczyk'];

const TITLES = ['Dr.','Amb. (ret.)','Gen. (ret.)','The Hon.','Prof.','Fmr. Sen.','Col. (ret.)'];

const SCHOLAR_QUIRKS = [
  'Has testified 44 times; remembers 3.',
  'Refers to lunch as “a convening.”',
  'The book tour never technically ended.',
  'Cable hit every Thursday. Hair and makeup at 4.',
  'Cites their own op-eds in conversation.',
  'Was “in the room.” Won’t say which room.',
  'Currently feuding with a podcast.',
  'Answers every question with “Great question.”',
  'Owns a whiteboard. It says SYNERGY.',
  'Substack has 14 paying subscribers, all donors.',
  'Shook three presidents’ hands in one buffet line.',
  'Predicted everything, shortly after it happened.',
];

const OPS_ROLES = [
  'Development Associate','Events Coordinator','Comms Director','Grants Manager',
  'Office Manager','Executive Assistant to the President','AV Guy (Indispensable)','Intern Wrangler',
];

const OPS_QUIRKS = [
  'Runs the whole place. Titled “Associate.”',
  'Knows where the good conference room is.',
  'Has never lost a receipt.',
  'Can assemble a panel in 40 minutes flat.',
  'On a first-name basis with the caterer.',
  'The only one who can work the projector.',
  'Keeps a burner umbrella for every fellow.',
  'Reads the footnotes. All of them.',
];

// No-effect headlines for slow news months.
const FLAVOR_HEADLINES = [
  'AREA THINK TANK RELEASES REPORT; NATION BRACES',
  'PANEL DISCUSSION ENTERS FOURTH HOUR; MODERATOR MISSING',
  'LANYARD SHORTAGE GRIPS DUPONT CIRCLE',
  'STUDY FINDS STUDIES FIND THINGS',
  'HAPPY HOUR OFF THE RECORD, SOURCES SAY',
  'WONK SEEN TOUCHING GRASS; COLLEAGUES CONCERNED',
  'GALA SEASON DECLARED “BASICALLY THE OLYMPICS” BY ATTENDEE',
  'EVERY PANEL NOW FEATURES THE SAME GUY, INVESTIGATION CONFIRMS',
];
