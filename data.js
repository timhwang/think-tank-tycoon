// ============================================================
// THINK TANK TYCOON — data & decks
// All tuning knobs live in TUNE. All content decks live below.
// ============================================================

const TUNE = {
  supportRatio: 2,       // scholars supported per ops staffer
  fightSlots: 4,         // active policy fights on the board
  donorSlots: 3,         // donors in the market at once
  hireSlots: 4,          // candidates in the hiring market
  signingMonths: 1,      // signing bonus = N months salary
  severanceMonths: 1,    // severance = N months salary
  strikeLimit: 2,        // strikes before a donor walks
  unsupportedMult: 0.5,  // output multiplier for unsupported scholars
  flavorChance: 0.45,    // chance the Bugle runs dysfunction headlines each month
  expertisePerScholar: 0.12, // commit bonus per scholar matching a fight's tag...
  expertiseCap: 0.6,         // ...capped here
  warroomBonus: 0.15,        // War Room program: flat bonus on all commits
  hireMatchMult: 0.5,    // signing bonus mult when a scholar shares your lean
  hireOpposeMult: 1.5,   // ...and when they cross the aisle to join you
  donorMatchMult: 0.7,   // court cost mult when a donor shares your lean
  donorOpposeMult: 1.4,  // ...and when they don't
  hireMatchMult2: 0.4,   // hardline shops (|align| = 2) feel partisan fit harder:
  hireOpposeMult2: 1.75, // ...cheaper true believers,
  donorMatchMult2: 0.6,  // ...cheaper movement money,
  donorOpposeMult2: 1.6, // ...and a steeper price for ecumenism
  raidChance: 0.22,      // odds a market scholar is poachable from a rival
  raidBonusMult: 1.5,    // signing-bonus premium to raid a rival's scholar
  raidBudgetHit: 3,      // rival influence budget lost per poached scholar
  raidMinBudget: 6,      // raids can't reduce a rival below this
  scholarStrikeLimit: 2, // consecutive unsupported months before a scholar quits
  annualRaisePct: 0.09,  // payroll raise applied every 12 months
  grantTermMin: 10,      // donor grant cycles run this many months...
  grantTermMax: 20,      // ...to this many, then the donor departs amicably
  grantMult: 0.8,        // global scaler on donor grants (applied when courted)
  fightCashMult: 0.7,    // global scaler on fight cash rewards (applied at draw)
  rivalBudgetMult: 0.72, // global scaler on rival influence budgets
  rivalFlat: 14,         // rival budget = (flat + base*slope) * mult...
  rivalSlope: 0.5,       // ...flat>0 compresses the spread between big and small tanks
  rivalCloserMult: 2.2,  // rivals weight fights in their final month this much harder
  rivalFocus: 0.45,      // odds a rival sits out a fight outside its pet issues
  contestK: 3.2,         // resolution odds curve: P = A^k/(A^k+B^k); higher = less upset-prone
  crisisChance: 0.16,    // monthly odds a crisis lands (never two at once)
  electionSeasonStart: 16, // month index when election season begins (6 months out)
  electionSeasonMult: 1.5, // rival budgets scale by this during election season
  rivalDriftPct: 0.012,  // rival budgets compound this much per month (they grow too)
  frontrunnerMult: 1.3,  // rival spending scales by this while YOU lead the board
  counterBidMult: 1.6,   // extra rival weight against sides the frontrunner leads
  courtCostMult: 1.5,    // global scaler on donor courting costs
  scholarOutMult: 1.08,  // global scaler on scholar influence output
  electionMonth: 22,     // Jan 2027 + 22 months = Election Night, Nov 2028
  prospectHireCost: 80,  // base cash to sweep the hiring market...
  prospectHireInf: 10,   // ...plus influence (headhunters want intros too)
  prospectDonorCost: 80, // base cash to re-deal the donor market...
  prospectDonorInf: 15,  // ...plus influence (cultivation dinners run on favors)
  prospectEscalate: 0.5, // each prior sweep of that market adds this x base
  divaChance: 0.08,      // odds a market scholar is a brilliant nightmare
  dudChance: 0.18,       // odds a market scholar is an insanely bad deal (read the stats)
  divaQuitChance: 0.12,  // monthly odds each diva drives a colleague out
  opsBoonChance: 0.28,   // odds an ops hire carries a bonus trait
  opsFlawChance: 0.12,   // odds an ops hire is EXPENSIVE instead
  opsChaoticChance: 0.10,// odds an ops hire is CHAOTIC (big capacity, unreliable)
  opsDudChance: 0.10,    // odds an ops hire is a hidden bad deal (1-cap, senior price)
  chaosFlakeChance: 0.2, // monthly odds a CHAOTIC ops delivers zero support
  specialistChance: 0.45,// odds an ops market draw is a specialist (no scholar support)
  consultantChance: 0.18,// odds a specialist is, in fact, a consultant
  moraleMult: 0.75,      // demoralized scholars produce at this rate
  moraleMonths: 2,       // ...for this many months after a contested loss in their field
  moraleQuitChance: 0.25,// odds a demoralized scholar quits when their field loses AGAIN
  crisisCashPct: 0.18,   // crisis cash options cost at least this share of treasury
  crisisInfPct: 0.8,     // crisis influence options cost at least this share of monthly production
  poachChance: 0.12,     // monthly odds a rival makes a run at one of your scholars
  poachRivalGain: 3,     // rival budget gained when your scholar defects to them
  renewCostMult: 0.5,    // renewing an expiring donor costs this x fresh courting
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
    align:-1, alignLabel:'Center-Left', size:'LARGE', diff:'Easy',
    blurb:'The establishment. A marble building full of former officials waiting to become current officials again.',
    cash:2400, rent:80, scholars:4, ops:2, influence:20,
    donors:['waterworks','tomorrow'], budget:45, tags:['TAX','HLTH','TRADE'],
  },
  {
    id:'legacy', name:'The Legacy Foundation', short:'Legacy',
    motto:'Building an America the Founders Would Recognize, Legally.',
    align:2, alignLabel:'Right', size:'LARGE', diff:'Easy',
    blurb:'A battleship with a gift shop. Twelve field marshals of the culture war and a truly excellent mailing list.',
    cash:2200, rent:70, scholars:4, ops:2, influence:20,
    donors:['pemberton','hexagon'], budget:45, tags:['TAX','DEF','CLIM'],
  },
  {
    id:'forum', name:'The Free Enterprise Forum', short:'The Forum',
    motto:'Markets Have Feelings Too.',
    align:1, alignLabel:'Center-Right', size:'MEDIUM', diff:'Medium',
    blurb:'Tweedy, respectable, pro-business. Hosts the politest disagreements in town, with sandwiches.',
    cash:1100, rent:45, scholars:3, ops:2, influence:35,
    donors:['retail'], budget:30, tags:['TAX','TRADE','TECH'],
  },
  {
    id:'momentum', name:'Center for American Momentum', short:'Momentum',
    motto:'The Arc of History Needs a Push.',
    align:-2, alignLabel:'Left', size:'MEDIUM', diff:'Medium',
    blurb:'Runs on cold brew and five-point plans. Everyone on staff is either 29 or 63.',
    cash:900, rent:45, scholars:3, ops:2, influence:25,
    donors:['assembly'], budget:30, tags:['HLTH','CLIM','TECH'],
  },
  {
    id:'hand', name:'The Invisible Hand Society', short:'The Hand',
    motto:'Leave Us Alone. Also, Fund Us.',
    align:1, alignLabel:'Libertarian', size:'SMALL', diff:'Hard',
    blurb:'Six people with four opinions each. The newsletter is, by all accounts, legendary.',
    cash:520, rent:25, scholars:2, ops:1, influence:40,
    donors:['ashgrove'], budget:18, tags:['TAX','TECH','TRADE'],
  },
  {
    id:'subsidiarity', name:'The Subsidiarity Project', short:'Subsidiarity',
    motto:'Small Is Beautiful. So Is Our Budget.',
    align:0, alignLabel:'Post-Liberal', size:'TINY', diff:'Expert',
    blurb:'Three converts and a fax machine, arguing that everything went wrong in 1789.',
    cash:360, rent:15, scholars:1, ops:1, influence:55,
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
//   ENGAGE  {tag,amt} — commit >= amt influence to that tag's fights each
//                    month (forgiven when no such fight is on the board)
// Optional donor fields:
//   perk:'PID'   — a called-out benefit while they fund you (see DONOR_PERKS)
//   flaw:'PID'   — a called-out drawback while they fund you
//   require:fn?  — only appears in market if your current donor base qualifies
//                  (requireText describes the gate)
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
  { id:'booster', name:'The Balanced Budget Booster Club', grant:150, cost:60, lean:1,
    demand:{type:'ENGAGE', tag:'TAX', amt:15},
    blurb:'Has never personally balanced anything.' },
  { id:'carriers', name:'Concerned Citizens for a Ninth Carrier Group', grant:200, cost:75, lean:1,
    demand:{type:'ENGAGE', tag:'DEF', amt:15},
    blurb:'Eight is a vulnerability.' },
  { id:'disruption', name:'The Disruption Society', grant:170, cost:65, lean:0,
    demand:{type:'ENGAGE', tag:'TECH', amt:15},
    blurb:'Moves fast. Breaks you.' },
  { id:'patients', name:'Patients for Patience (PAC-Adjacent)', grant:160, cost:60, lean:-1,
    demand:{type:'ENGAGE', tag:'HLTH', amt:15},
    blurb:'Waiting rooms build character, says no one.' },
  { id:'grandmas', name:'The Solar Grandmothers', grant:140, cost:55, lean:-1,
    demand:{type:'ENGAGE', tag:'CLIM', amt:12},
    blurb:'Will knit you a panel.' },
  { id:'containers', name:'Friends of the Container Ship', grant:150, cost:60, lean:0,
    demand:{type:'ENGAGE', tag:'TRADE', amt:12},
    blurb:'Just really like boats.' },
  { id:'port', name:'The Port Authority Alumni Association', grant:130, cost:50, lean:0,
    demand:{type:'ROSTER', tag:'TRADE'},
    blurb:'Emeritus, but make it longshore.' },
  { id:'humane', name:'The Humane Computing Collective', grant:120, cost:45, lean:-1,
    demand:{type:'NOCROSS', tag:'TECH'},
    blurb:'Asks if the server is okay.' },
  { id:'gilt', name:'The Gilt Trip Foundation', grant:210, cost:80, lean:1,
    demand:{type:'PROGRAM', pid:'gala'},
    blurb:'Old money, new guilt.' },
  // --- buffed / flawed donors (called out on the card) ---
  { id:'anchor', name:'The Anchor Trust', grant:150, cost:70, lean:0, perk:'anchor',
    demand:{type:'ROSTER', tag:'TAX'},
    blurb:'Patient capital, and proud of it.' },
  { id:'megaphone', name:'The Megaphone Fund', grant:230, cost:85, lean:1, perk:'megaphone',
    demand:{type:'ROSTER', tag:'TECH'},
    blurb:'Believes loudly in believing loudly.' },
  { id:'matching', name:'The Match Point Foundation', grant:120, cost:55, lean:-1, perk:'matching',
    demand:{type:'ROSTER', tag:'HLTH'},
    blurb:'Will match, conditionally, eventually.' },
  { id:'meddler', name:'The Overbrook Meddler Fund', grant:240, cost:80, lean:1, flaw:'meddler',
    demand:{type:'NOCROSS', tag:null},
    blurb:'Has read your org chart and has notes.' },
  { id:'fickle', name:'The Weathervane Group', grant:200, cost:60, lean:0, flaw:'fickle',
    demand:{type:'PROGRAM', pid:'podcast'},
    blurb:'Whatever polled well this morning.' },
  { id:'jealous', name:'The Sole Patron Society', grant:260, cost:95, lean:-1, flaw:'jealous',
    demand:{type:'ROSTER', tag:'CLIM'},
    blurb:'Would prefer to be your only friend.' },
  // --- prerequisite donors (need the right base first) ---
  { id:'consortium', name:'The Blue-Chip Consortium', grant:340, cost:130, lean:1,
    demand:{type:'ROSTER', tag:'DEF'},
    require:g => g.donors.filter(x => !x.lapsing).length >= 4, requireText:'Only courts institutions with 4+ active donors',
    blurb:'Does not do introductory rounds.' },
  { id:'legacygift', name:'The Ambrose Legacy Bequest', grant:300, cost:110, lean:0,
    demand:{type:'PROGRAM', pid:'lobby'},
    require:g => g.donors.some(x => x.renewals) , requireText:'Only courts institutions that have renewed a donor',
    blurb:'Invests in longevity, having little left.' },
  { id:'purity', name:'The Undiluted Fund', grant:280, cost:100, lean:2,
    demand:{type:'NOCROSS', tag:null},
    require:g => g.donors.filter(x => !x.lapsing).length > 0 && g.donors.filter(x => !x.lapsing).every(x => (x.lean || 0) >= 0), requireText:'Only courts institutions with no left-leaning donors',
    blurb:'No notes. No nuance. No compromise.' },
];

// Called-out donor perks and flaws (tooltip text; effects live in game.js)
const DONOR_PERKS = {
  anchor:    { label:'ANCHOR',    tip:'Rock-steady: this grant never enters a renewal cycle — it funds you to the election.' },
  megaphone: { label:'MEGAPHONE', tip:'Amplifies your voice: +8% on all influence you commit to fights while they fund you.' },
  matching:  { label:'MATCHING',  tip:'Matches the room: +$4k/mo for every OTHER active donor you keep.' },
};
const DONOR_FLAWS = {
  meddler:   { label:'MEDDLER',   tip:'High-maintenance: −8% to all your scholars\' output while they fund you.' },
  fickle:    { label:'FICKLE',    tip:'Flighty: each month a 15% chance they cut their own grant by a third, permanently.' },
  jealous:   { label:'JEALOUS',   tip:'Possessive: takes a strike whenever you court a NEW donor while they fund you.' },
};

// --- (old marker) ---
const _DONORS_END = true;

// ------------------------------------------------------------
// Programs: money sinks that satisfy donor demands. Bloat with a purpose.
// ------------------------------------------------------------
// once: a one-time price; the program is then permanent (cost = upkeep).
const PROGRAMS = [
  { id:'gala', name:'Annual Gala Series', cost:10, inf:0,
    blurb:'An ice sculpture of the Capitol, melting onto the raw bar.' },
  { id:'podcast', name:'In-House Podcast Studio', cost:6, inf:2,
    blurb:'Episode 44: “So, Walk Me Through the Paper.”' },
  { id:'lobby', name:'Marble Lobby & Donor Wall', cost:8, inf:0,
    blurb:'Names engraved in order of generosity.' },
  { id:'journal', name:'House Policy Journal', cost:12, inf:7,
    blurb:'Peer-reviewed by whoever is in the kitchenette.' },
  { id:'warroom', name:'The War Room', cost:10, inf:0,
    blurb:'A map, some string, unlimited pushpins. All fight commits +15%.' },
  { id:'fellows', name:'Junior Fellows Program', cost:12, inf:0,
    blurb:'They are all named Tyler. Every sixth month, one becomes a real scholar.' },
  { id:'chair', name:'Endowed Chair in Applied Foresight', once:400, cost:4, inf:10,
    blurb:'Named for the donor’s late opinions. Permanent, prestigious, productive.' },
  { id:'wing', name:'The West Annex', once:500, cost:0, inf:0,
    blurb:'Owning your floor beats renting four of them. Rent halved, forever.' },
];

// ------------------------------------------------------------
// Policy fight deck. {NOM} in a title is replaced with a generated name.
// Side lean: -1 left-coded, +1 right-coded, 0 nonpartisan pork.
// reward: {cash, inf, special} — cash/inf scale by your share of the
// winning side; specials fire if you backed the winner at all:
//   'scholar'   a grateful expert joins your roster free
//   'donorlead' a donor appears in the market at half court cost
//   'absolve'   every current donor's strikes drop by 1
// ------------------------------------------------------------
const FIGHTS = [
  { id:'serverfarms', type:'BILL', tag:'TECH', months:3, reward:{cash:350},
    title:'American Server Farms Act',
    sides:[{label:'Pass: Subsidize the Cloud', lean:-1},{label:'Block: Clouds Can Pay Rent', lean:1}] },
  { id:'snacc', type:'BILL', tag:'TAX', months:2, reward:{cash:200},
    title:'SNACC Act (Supplemental Nutrition Assistance for Congressional Cafeterias)',
    sides:[{label:'Pass: Fund the Cafeterias', lean:-1},{label:'Block: Brown-Bag It', lean:1}] },
  { id:'regreview', type:'EO', tag:'TAX', months:2, reward:{cash:250},
    title:'EO 14501: Regulatory Regularity Review',
    sides:[{label:'Uphold: Review the Reviews', lean:1},{label:'Rescind: Regulate in Peace', lean:-1}] },
  { id:'helium', type:'BILL', tag:'DEF', months:3, reward:{cash:300},
    title:'Strategic Helium Reserve Modernization Act',
    sides:[{label:'Pass: More Balloons', lean:0},{label:'Block: Fewer Balloons', lean:0}] },
  { id:'fednom', type:'NOM', tag:'TAX', months:2, reward:{cash:400},
    title:'Confirm {NOM} to the Federal Reserve Board',
    sides:[{label:'Confirm: Steady Hands', lean:-1},{label:'Reject: Audit Everything', lean:1}] },
  { id:'prek', type:'BILL', tag:'HLTH', months:4, reward:{cash:500},
    title:'Universal Pre-K Through Grad School Act',
    sides:[{label:'Pass: Cradle to Curriculum', lean:-1},{label:'Block: Somebody Do the Math', lean:1}] },
  { id:'chips2', type:'BILL', tag:'TECH', months:3, reward:{cash:400},
    title:'CHIPS II: The Re-Chippening',
    sides:[{label:'Pass: Fabs for All', lean:0},{label:'Block: Vibes-Based Industrial Policy', lean:0}] },
  { id:'ainice', type:'EO', tag:'TECH', months:2, reward:{cash:300},
    title:'EO 14522: AI Systems Shall Be Nice',
    sides:[{label:'Uphold: Mandatory Niceness', lean:-1},{label:'Rescind: Let Them Cook', lean:1}] },
  { id:'tariff', type:'BILL', tag:'TRADE', months:3, reward:{cash:350},
    title:'Tariff Schedule Harmonization (Now With More Tariffs)',
    sides:[{label:'Pass: Tariff Everything', lean:1},{label:'Block: Tariff Nothing', lean:-1}] },
  { id:'sealandia', type:'NOM', tag:'TRADE', months:2, reward:{cash:150},
    title:'Confirm {NOM} as Ambassador to Sealandia',
    sides:[{label:'Confirm: It’s a Real Place', lean:0},{label:'Reject: It’s a Platform', lean:0}] },
  { id:'cleancoal', type:'BILL', tag:'CLIM', months:3, reward:{cash:400},
    title:'Clean Coal, Dirty Solar Act',
    sides:[{label:'Pass: Coal Showers Daily', lean:1},{label:'Block: Read It Again, Slowly', lean:-1}] },
  { id:'balloons', type:'BILL', tag:'DEF', months:2, reward:{cash:200},
    title:'National Weather Balloon Transparency Act',
    sides:[{label:'Pass: Balloons Must Explain Themselves', lean:0},{label:'Block: Some Mystery Is Healthy', lean:0}] },
  { id:'medadv', type:'BILL', tag:'HLTH', months:3, reward:{cash:450},
    title:'Medicare Advantage Advantage Act',
    sides:[{label:'Pass: More Advantage', lean:1},{label:'Block: Define “Advantage”', lean:-1}] },
  { id:'rto', type:'EO', tag:'TAX', months:2, reward:{cash:250},
    title:'EO 14544: Return to Office (This Time We Mean It)',
    sides:[{label:'Uphold: Butts in Seats', lean:1},{label:'Rescind: Slack Is a Place', lean:-1}] },
  { id:'highways', type:'BILL', tag:'TRADE', months:2, reward:{cash:150},
    title:'Interstate Renaming Omnibus',
    sides:[{label:'Pass: Every Overpass Gets a Sponsor', lean:0},{label:'Block: I-95 Has Earned Its Name', lean:0}] },
  { id:'circuit', type:'NOM', tag:'TAX', months:3, reward:{cash:500},
    title:'Confirm {NOM} to the D.C. Circuit',
    sides:[{label:'Confirm: Eminently Qualified', lean:1},{label:'Reject: Those Footnotes, Though', lean:-1}] },
  { id:'pandemic', type:'BILL', tag:'HLTH', months:3, reward:{cash:300},
    title:'Pandemic Preparedness Preparedness Act',
    sides:[{label:'Pass: Prepare to Prepare', lean:-1},{label:'Block: We’ll Wing It Again', lean:1}] },
  { id:'rareearth', type:'BILL', tag:'CLIM', months:3, reward:{cash:350},
    title:'Rare Earths, Common Sense Act',
    sides:[{label:'Pass: Dig, Baby, Dig', lean:1},{label:'Block: Not In My Backyard, Specifically', lean:-1}] },
  { id:'deptdept', type:'EO', tag:'TAX', months:2, reward:{cash:300},
    title:'EO 14561: Establish the Department of Departments',
    sides:[{label:'Uphold: Someone Must Coordinate', lean:0},{label:'Rescind: It Coordinates Itself', lean:0}] },
  { id:'kosa', type:'BILL', tag:'TECH', months:3, reward:{cash:350},
    title:'Kids Online Extremely Safe Act',
    sides:[{label:'Pass: Think of the Children', lean:0},{label:'Block: The Children Have VPNs', lean:0}] },
  { id:'canal2', type:'BILL', tag:'TRADE', months:3, reward:{cash:300, inf:15},
    title:'Panama Canal II: The Nicaragua Option',
    sides:[{label:'Pass: Dig We Must', lean:0},{label:'Block: One Canal Was Plenty', lean:0}] },
  { id:'cea', type:'NOM', tag:'TAX', months:3, reward:{cash:100, special:'scholar'},
    title:'Confirm {NOM} as Chair of the Council of Economic Advisers',
    sides:[{label:'Confirm: The Models Are Sound', lean:-1},{label:'Reject: The Models Are Vibes', lean:1}] },
  { id:'compost', type:'EO', tag:'CLIM', months:2, reward:{cash:150, inf:15},
    title:'EO 14580: All Federal Buildings Shall Compost',
    sides:[{label:'Uphold: Feed the Worms', lean:-1},{label:'Rescind: The Worms Are Fine', lean:1}] },
  { id:'sfrotc', type:'BILL', tag:'DEF', months:3, reward:{cash:250, inf:10},
    title:'Space Force ROTC Act',
    sides:[{label:'Pass: Ad Astra, Cadets', lean:1},{label:'Block: Gravity First', lean:-1}] },
  { id:'repair', type:'BILL', tag:'HLTH', months:3, reward:{cash:300, special:'donorlead'},
    title:'Medical Right to Repair Act (Tractors Also, Again)',
    sides:[{label:'Pass: Hand Over the Manuals', lean:-1},{label:'Block: Warranty Voided', lean:1}] },
  { id:'postcard', type:'BILL', tag:'TAX', months:2, reward:{cash:150, inf:20},
    title:'Postcard-Sized Tax Return Act',
    sides:[{label:'Pass: Wish You Were Simpler', lean:1},{label:'Block: The Postcard Lies', lean:-1}] },
  { id:'balloondef', type:'NOM', tag:'DEF', months:2, reward:{cash:100, inf:25},
    title:'Confirm Gen. {NOM} as Under Secretary for Balloon Defense',
    sides:[{label:'Confirm: Eyes on the Skies', lean:0},{label:'Reject: It Is A Fake Job', lean:0}] },
  { id:'algo', type:'EO', tag:'TECH', months:3, reward:{cash:150, special:'donorlead'},
    title:'EO 14590: The Algorithm Shall Explain Itself',
    sides:[{label:'Uphold: Show Your Work', lean:-1},{label:'Rescind: Trade Secrets, Baby', lean:1}] },
  { id:'pumpkin', type:'BILL', tag:'TRADE', months:2, reward:{cash:200, special:'absolve'},
    title:'Strategic Pumpkin Spice Reserve Act',
    sides:[{label:'Pass: National Security Gourd', lean:0},{label:'Block: Let the Market Spice', lean:0}] },
  { id:'fonts', type:'BILL', tag:'TECH', months:2, reward:{inf:30},
    title:'Federal Font Modernization Act',
    sides:[{label:'Pass: Farewell, Times New Roman', lean:0},{label:'Block: Serifs Won the War', lean:0}] },
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

// résumé-inflation lines for the market's bad apples — the numbers are the tell
const DUD_QUIRKS = [
  'Advises four governments; none can say on what.',
  'The book is “forthcoming.” It has been forthcoming since 2019.',
  '“Thought leader,” per their own bio.',
  'Charges keynote rates for staff meetings.',
  'Best known for being frequently introduced.',
  'Their last big idea was an acronym.',
];

// ------------------------------------------------------------
// Specialist ops: zero scholar support, one clear function each.
// The consultant is the specialist market's bad apple: a senior title,
// a senior salary, and no measurable effect whatsoever.
// ------------------------------------------------------------
const SPECIALISTS = [
  { id:'comms', role:'Comms Director', sal:[10,14], fx:'+3 ✦/mo',
    tip:'Books the hits, feeds the clips: +3 ✦/mo to production.', icon:'spec_comms' },
  { id:'devdir', role:'Development Director', sal:[10,14], fx:'courting −15%',
    tip:'Runs the pipeline: donor courting costs −15% while employed.', icon:'spec_devdir' },
  { id:'editor', role:'Editor-in-Chief', sal:[11,15], fx:'+1 ✦/scholar',
    tip:'Makes everyone sharper: +1 ✦/mo per scholar on staff (up to 8).', icon:'spec_editor' },
  { id:'creative', role:'Creative Director', sal:[9,13], fx:'programs −30%',
    tip:'Produces it all in-house: program monthly costs −30% while employed.', icon:'spec_creative' },
  { id:'govrel', role:'Gov Relations Lead', sal:[10,14], fx:'commits +5%',
    tip:'Knows which door: +5% on all influence you commit to fights.', icon:'spec_govrel' },
  { id:'consultant', role:'Senior Strategy Consultant', sal:[13,18], fx:'synergy',
    tip:'Effect: none that anyone has measured.', icon:'spec_consultant', dud:true },
];

// résumé lines for ops bad apples — again, the numbers are the tell
const OPS_DUD_QUIRKS = [
  'Managed the office move. In 2019. Still referencing it.',
  'Calendar is “a living document.” Nothing is ever on it.',
  'Forwards every email with “thoughts?”',
  'Owns the org chart. Refuses to share the org chart.',
  'In meetings about meetings; unreachable otherwise.',
  'Has a system. The system is asking you.',
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

// ------------------------------------------------------------
// Crisis deck: one may land at month's end; you must choose before the
// next END MONTH. Text lives here; the teeth live in CRISIS_FX (game.js).
// Placeholders: {SCHOLAR} {TOP} {DIVA} {OPS} {DONOR} {DONOR_B} {RIVAL}.
// Every crisis keeps at least one choice with no resource cost.
// ------------------------------------------------------------
const CRISES = [
  { id:'oped', title:'THE OLD OP-EDS SURFACE',
    body:'A viral thread unearths {SCHOLAR}’s spicier collected works. Donors are calling. The interns have made a supercut.',
    choices: [
      { label:'Stand by them', hint:'Ideologically offended donors each take a strike' },
      { label:'Quietly part ways', hint:'{SCHOLAR} leaves. No severance, no statement' },
      { label:'Damage-control blitz', inf:40, hint:'✦40, and by Friday it never happened' },
    ] },
  { id:'feud', title:'FUNDER FEUD',
    body:'{DONOR} and {DONOR_B} were seated at the same dinner. It went badly. Each now insists you drop the other.',
    choices: [
      { label:'Side with {DONOR}', hint:'{DONOR_B} walks immediately' },
      { label:'Side with {DONOR_B}', hint:'{DONOR} walks immediately' },
      { label:'Host a unity retreat', cash:60, inf:25, hint:'Both stay. Nobody apologizes' },
    ] },
  { id:'meltdown', title:'DIVA MELTDOWN',
    body:'{DIVA} has read the seating chart for the annual dinner and is now “re-evaluating everything.” HR has a folder.',
    choices: [
      { label:'Fire the diva', hint:'{DIVA} leaves; the office exhales' },
      { label:'Grand apology tour', cash:30, inf:30, hint:'Flowers, an office upgrade, a personal podcast' },
      { label:'Let it burn', hint:'Two colleagues quit by Friday' },
    ] },
  { id:'shutdown', title:'GOVERNMENT SHUTDOWN',
    body:'Congress fails to fund the government. Nothing moves on the Hill next month — fight clocks freeze. Payroll, notably, does not.',
    choices: [
      { label:'Ride it out', hint:'All fight clocks freeze for a month' },
      { label:'Emergency convening circuit', cash:50, hint:'Clocks still freeze, but the panels mint ✦20' },
    ] },
  { id:'recess', title:'SURPRISE RECESS',
    body:'Leadership abruptly crams every pending item into one frantic session. Everything on the board resolves at the next END MONTH.',
    choices: [
      { label:'Brace', hint:'Every fight’s clock drops to 1 month' },
      { label:'War footing', cash:40, hint:'Same, but the scramble mints ✦15 now' },
    ] },
  { id:'galafire', title:'GALA ETHICS COMPLAINT',
    body:'A watchdog notes that your gala’s “VIP access packages” resemble, in their words, “a menu.” The story has legs.',
    choices: [
      { label:'Lawyer up', cash:80, hint:'The gala survives; the lawyers thrive' },
      { label:'Shut the gala down', hint:'Program off — its donors will notice' },
    ] },
  { id:'hack', title:'SERVER HACK',
    body:'A ransomware note, in Comic Sans, says your donor database is encrypted. The AV Guy says he had one job and this wasn’t technically it.',
    choices: [
      { label:'Pay the ransom', cash:70, hint:'Everything back by Monday' },
      { label:'Rebuild from paper', hint:'{OPS} quits in the chaos, and the scramble costs ✦15' },
    ] },
  { id:'plagiarism', title:'PLAGIARISM FLAP',
    body:'Sharp-eyed readers note that {TOP}’s latest white paper shares twelve paragraphs with a 2019 master’s thesis.',
    choices: [
      { label:'Retract and retrain', inf:10, hint:'{TOP}’s output drops 5, permanently' },
      { label:'Deny everything, loudly', inf:35, hint:'Expensive, but the file closes' },
      { label:'Let them go', hint:'{TOP} leaves. No severance' },
    ] },
  { id:'revolt', title:'BOARD REVOLT',
    body:'The board has seen the treasury. An emergency meeting is called. Someone has printed slides.',
    choices: [
      { label:'Accept austerity', hint:'Your highest-paid staffer is let go; the board wires $60k' },
      { label:'Grovel effectively', inf:30, hint:'A $100k bridge gift, at the cost of ✦30 of dignity' },
    ] },
  { id:'smear', title:'RIVAL SMEAR CAMPAIGN',
    body:'{RIVAL} has funded a “transparency project” about you. Its first report is unflattering and, worse, well-designed.',
    choices: [
      { label:'Stay above the fray', hint:'Your standing commitments on every fight erode 20%' },
      { label:'Counter-oppo', cash:50, hint:'{RIVAL}’s influence budget takes a permanent −3' },
    ] },
  { id:'center', title:'{DONOR} WANTS A CENTER',
    body:'{DONOR} would like their name on something. Specifically: a Center. There would be a plaque, and a ribbon, and remarks.',
    choices: [
      { label:'Build the Center', cash:120, hint:'Their grant rises $30k/mo and the cycle extends 6 months' },
      { label:'Decline politely', hint:'{DONOR} takes a strike’s worth of offense' },
    ] },
  { id:'union', title:'THE INTERNS UNIONIZE',
    body:'The interns have elected a steward, drafted demands, and — ominously — learned what everyone is paid.',
    choices: [
      { label:'Recognize the union', hint:'Every current ops salary +$1k/mo, permanently' },
      { label:'Fight it', inf:30, hint:'✦30 of goodwill burned, and one ops staffer quits' },
    ] },
];

// No-effect Bugle items for slow news months: wonk life plus the three
// branches of government failing in their own signature styles.
const FLAVOR_NEWS = [
  // wonk life
  { h:'AREA THINK TANK RELEASES REPORT; NATION BRACES', s:'' },
  { h:'PANEL DISCUSSION ENTERS FOURTH HOUR; MODERATOR MISSING', s:'' },
  { h:'LANYARD SHORTAGE GRIPS DUPONT CIRCLE', s:'' },
  { h:'STUDY FINDS STUDIES FIND THINGS', s:'' },
  { h:'HAPPY HOUR OFF THE RECORD, SOURCES SAY', s:'' },
  { h:'WONK SEEN TOUCHING GRASS; COLLEAGUES CONCERNED', s:'' },
  { h:'GALA SEASON DECLARED “BASICALLY THE OLYMPICS” BY ATTENDEE', s:'' },
  { h:'EVERY PANEL NOW FEATURES THE SAME GUY, INVESTIGATION CONFIRMS', s:'' },
  // congressional dysfunction
  { h:'HOUSE PASSES BILL NAMING BILL-NAMING COMMISSION', s:'Vote was 217–212, on party lines nobody can explain.' },
  { h:'SENATOR PLACES HOLD ON ALL NOMINEES UNTIL AIRPORT RENAMED', s:'“It’s about leverage,” explains aide. It is about the airport.' },
  { h:'CONTINUING RESOLUTION CONTINUES RESOLVING NOTHING', s:'Government funded through a Thursday, mood permitting.' },
  { h:'FILIBUSTER ENTERS NINTH HOUR OF DR. SEUSS', s:'Reporters unsure which appropriations rider rhymes.' },
  { h:'CONFERENCE COMMITTEE LOST IN CAPITOL BASEMENT', s:'Last seen near the good vending machines, seeking a quorum.' },
  { h:'OMNIBUS REACHES 4,000 PAGES; PAGE 3,112 JUST SAYS “TBD”', s:'Leadership confident members will read it “in spirit.”' },
  { h:'HEARING ON AI DERAILED BY PRINTED-OUT SCREENSHOTS', s:'Witness asked to explain the internet; declines politely.' },
  { h:'MOTION TO VACATE FILED, WITHDRAWN, REFILED AS A JOKE, PASSES', s:'Speaker pro tempore pro tempore sworn in at 2 a.m.' },
  // executive dysfunction
  { h:'EXECUTIVE ORDER REVOKES ORDER REVOKING PREVIOUS ORDER', s:'Legal scholars describe the status quo as “vibes.”' },
  { h:'OMB DIRECTOR FOUND LIVING IN SPREADSHEET', s:'Cell K34 described as “cozy, load-bearing.”' },
  { h:'CABINET MEETING RUNS LONG OVER WHO SITS WHERE', s:'Seating chart now classified.' },
  { h:'AGENCY RENAMED; NOBODY UPDATES THE SIGN', s:'Placard outside still reads “Dept. of Comerce,” as it has since 1988.' },
  { h:'WHITE HOUSE UNVEILS PLAN TO UNVEIL PLAN', s:'Rollout of the rollout praised as “seamless.”' },
  { h:'FEDERAL REGISTER PAGE COUNT ACHIEVES ESCAPE VELOCITY', s:'Print edition now visible from low earth orbit.' },
  { h:'PRESS BRIEFING CONDUCTED ENTIRELY ON BACKGROUND', s:'Senior official confirms senior officials say what officials say.' },
  { h:'ACTING SECRETARY NOW ACTING ACTING SECRETARY', s:'Succession chart resembles the genealogy of minor royals.' },
  // judicial dysfunction
  { h:'SUPREME COURT SPLITS 4–4–1 ON WHAT THE QUESTION WAS', s:'Concurrence cites a 1791 dictionary; dissent cites a different 1791 dictionary.' },
  { h:'CIRCUIT SPLIT UPGRADED TO CIRCUIT TRIANGLE', s:'Ninth Circuit reverses itself en banc, out of an abundance of caution.' },
  { h:'ORAL ARGUMENT INTERRUPTED BY 45-MINUTE HYPOTHETICAL', s:'It involves a submarine, a taco truck, and the Commerce Clause.' },
  { h:'JUDGE DEMANDS SHORTER BRIEFS; BAR FILES 300-PAGE RESPONSE', s:'Font-size litigation expected to reach discovery by 2031.' },
  { h:'SHADOW DOCKET ORDERS SHADOW DOCKET INVESTIGATED', s:'Ruling unsigned, unexplained, effective immediately.' },
  { h:'NATIONWIDE INJUNCTION ENJOINS NATIONWIDE INJUNCTIONS', s:'Effective nationwide, pending appeal of the concept of appeals.' },
  { h:'AMICUS BRIEF FILED BY “CONCERNED ALPACA OWNERS OF AMERICA”', s:'The Court thanks them for their candor.' },
];
