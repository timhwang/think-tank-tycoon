// ============================================================
// THINK TANK TYCOON — engine & rendering
// Plain JS, no modules, full re-render on every state change.
// ============================================================

// ---------- helpers ----------
const $ = s => document.querySelector(s);
const pick = a => a[Math.floor(Math.random() * a.length)];
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function fmtMoney(n) {
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(Math.round(n));
  if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(2).replace(/0$/, '').replace(/\.0$/, '') + 'M';
  return sign + '$' + abs + 'k';
}
const fmtSigned = n => (n >= 0 ? '+' : '−') + fmtMoney(Math.abs(n));

function dateStr(m) {
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return names[m % 12] + ' ' + (TUNE.startYear + Math.floor(m / 12));
}

function leanChip(lean) {
  if (lean <= -2) return '<span class="lean l2">◀◀ LEFT</span>';
  if (lean === -1) return '<span class="lean l1">◀ LEFT</span>';
  if (lean === 1) return '<span class="lean r1">RIGHT ▶</span>';
  if (lean >= 2) return '<span class="lean r2">RIGHT ▶▶</span>';
  return '<span class="lean c0">● CENTER</span>';
}
const tagChip = t => `<span class="tag tag-${t}" title="${TAG_NAMES[t]}">${t}</span>`;

// icon slot: renders nothing visible if the PNG doesn't exist yet
const iconImg = (name, size) => name
  ? `<img class="icon${size ? ' ' + size : ''}" src="icons/${name}.png" alt="" onerror="this.remove()">`
  : '';

// ---------- audio flavor (synthesized, no files; muted via topbar) ----------
let audioCtx = null;
let muted = false;
try { muted = localStorage.getItem('ttt-muted') === '1'; } catch (e) {}

function sfx(kind) {
  if (muted || typeof AudioContext === 'undefined') return;
  try {
    audioCtx = audioCtx || new AudioContext();
    const t = audioCtx.currentTime;
    const beep = (f, dur, type = 'square', gain = 0.07, at = 0) => {
      const o = audioCtx.createOscillator(), gn = audioCtx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t + at);
      gn.gain.setValueAtTime(gain, t + at);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      o.connect(gn).connect(audioCtx.destination);
      o.start(t + at); o.stop(t + at + dur + 0.02);
    };
    const rustle = (dur, gain = 0.05) => {
      const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * dur), audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = audioCtx.createBufferSource(), gn = audioCtx.createGain();
      src.buffer = buf; gn.gain.value = gain;
      src.connect(gn).connect(audioCtx.destination); src.start(t);
    };
    switch (kind) {
      case 'click': beep(880, 0.04, 'square', 0.04); break;
      case 'hire': beep(523, 0.07); beep(659, 0.1, 'square', 0.07, 0.08); break;
      case 'court': beep(660, 0.06); beep(880, 0.06, 'square', 0.07, 0.07); beep(1320, 0.14, 'square', 0.07, 0.14); break;
      case 'commit': beep(440, 0.06, 'triangle', 0.07); break;
      case 'paper': rustle(0.3); break;
      case 'roll': for (let i = 0; i < 14; i++) beep(180 + i * 18, 0.025, 'square', 0.04, 0.1 + i * 0.09); break;
      case 'crisis': beep(110, 0.6, 'sawtooth', 0.06); beep(104, 0.6, 'sawtooth', 0.04, 0.04); break;
      case 'season': beep(330, 0.14); beep(330, 0.14, 'square', 0.07, 0.18); beep(494, 0.4, 'square', 0.07, 0.36); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, 0.3, 'square', 0.07, i * 0.13)); break;
      case 'lose': [392, 370, 349, 330].forEach((f, i) => beep(f, 0.35, 'sawtooth', 0.05, i * 0.28)); break;
    }
  } catch (e) {}
}

function setMuted(v) {
  muted = v;
  try { localStorage.setItem('ttt-muted', v ? '1' : '0'); } catch (e) {}
  const b = $('#muteBtn');
  if (b) { b.textContent = muted ? '🔇' : '🔊'; b.title = muted ? 'Sound off — click to unmute' : 'Sound on — click to mute'; }
}

// ---------- state ----------
let G = null;   // the current player's institution
let W = null;   // the shared world (=== G in single-player)
let uid = 1;
const SAVE_KEY = 'ttt-save-v1';

function tank() { return TANKS.find(t => t.id === G.tankId); }
function tankOf(P) { return TANKS.find(t => t.id === P.tankId); }

// ---------- many hands on one world ----------
// players(): every human institution in the campaign (full objects on the
// server and in single-player; name/tank/score summaries on an online client)
function players() { return (W && W.players) ? W.players : [G]; }
function withPlayer(P, fn) { const prev = G; G = P; try { return fn(); } finally { G = prev; } }
function playerName(pid) { const p = (W && W.players || []).find(x => x.pid === pid); return p ? p.name : 'a rival'; }
function newsAll(newsFor, item) { players().forEach(p => newsFor(p).push(item)); }
function logAll(text) { players().forEach(p => withPlayer(p, () => logLine(text))); }

// a fight side's contribution from a given player (null pid = single-player)
function contribOf(side, pid) { return pid ? ((side.players || {})[pid] || 0) : (side.yours || 0); }
function yoursOf(side) { return contribOf(side, G && G.pid ? G.pid : null); }
function addYours(side, n) {
  if (G && G.pid) { side.players = side.players || {}; side.players[G.pid] = (side.players[G.pid] || 0) + n; }
  else side.yours = (side.yours || 0) + n;
}
function humanContribs(side) {
  return players().map(p => ({ p, amt: contribOf(side, p.pid || null) })).filter(x => x.amt > 0).sort((x, y) => y.amt - x.amt);
}
function humanLeader() {
  const rows = standings();
  const top = rows[0];
  return top && top.human && top.v > 0 && (!rows[1] || top.v > rows[1].v) ? top : null;
}

function genName(fancy) {
  const name = pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES);
  return fancy ? pick(TITLES) + ' ' + name : name;
}

function genScholar(starter) {
  const salary = starter ? ri(16, 30) : ri(14, 42);
  let out = Math.round((salary * 0.45 + ri(0, 8)) * TUNE.scholarOutMult);
  let name = genName(Math.random() < 0.75);
  let big = false, diva = false;
  if (!starter && Math.random() < TUNE.divaChance) { diva = true; out += ri(14, 20); }
  else if (!starter && Math.random() < 0.12) { big = true; out += 10; }
  // starters mostly share the shop's politics; the open market is a grab bag
  const tSign = Math.sign(tank().align);
  const r = Math.random();
  const lean = starter ? ((tSign !== 0 && r < 0.6) ? tSign : 0)
                       : (r < 0.3 ? -1 : r < 0.7 ? 0 : 1);
  // the movement decides what they studied: left benches run deep in climate
  // and tech, right benches in fiscal and defense. Home-turf scholars are
  // sharper; the rare crossover in a movement's weak field is mediocre.
  const tag = weightedTag(lean);
  if (HOME_TAGS[String(lean)].includes(tag)) out += 2;
  else if (lean !== 0) out = Math.max(5, out - 2);
  const sch = {
    id: uid++, kind: 'scholar', name, big, lean, diva,
    tag, salary: salary + (big ? 15 : 0) + (diva ? ri(10, 16) : 0), out,
    quirk: pick(SCHOLAR_QUIRKS),
    icon: 'scholar_' + ri(1, 12),
  };
  // the market has bad apples: grand résumé, feeble numbers — no warning chip,
  // the stats are the tell
  if (!starter && !diva && !big && Math.random() < TUNE.dudChance) {
    sch.out = Math.max(3, Math.round(sch.out * 0.45));
    sch.salary += ri(0, 6);
    sch.quirk = pick(DUD_QUIRKS);
  }
  // some market scholars are sitting at a rival right now — hiring is a raid
  if (!starter && G && W.rivals && W.rivals.length && Math.random() < TUNE.raidChance) {
    const lr = aiLevel() >= 2 && W.leaderShort ? W.rivals.find(x => x.short === W.leaderShort) : null;
    sch.from = lr && Math.random() < 0.5 ? lr.short : pick(W.rivals).short;
    sch.out += 4;    // proven operator
    sch.salary += 6; // knows it
  }
  return sch;
}

const OPS_TRAITS = [
  { id:'inf',     label:'MEDIA SAVVY',  tip:'Their booking instincts add +2 ✦/mo to production.' },
  { id:'grants',  label:'RAINMAKER',    tip:'Works the phones: +$6k/mo in extra grants while employed.' },
  { id:'court',   label:'CONNECTOR',    tip:'Knows everyone: donor courting costs −10% while employed.' },
  { id:'expense', label:'EXPENSIVE',    tip:'Runs a lavish office: +$6k/mo in miscellaneous costs.' },
  { id:'chaotic', label:'CHAOTIC',      tip:'Supports 3 on paper — but each month there\'s a 20% chance they deliver nothing at all.' },
];

function weightedTag(lean) {
  const w = TAG_WEIGHTS[String(lean)] || TAG_WEIGHTS['0'];
  const total = TAGS.reduce((a, t) => a + (w[t] || 0), 0);
  let r = Math.random() * total;
  for (const t of TAGS) { r -= (w[t] || 0); if (r <= 0) return t; }
  return TAGS[TAGS.length - 1];
}

function genOps(starter) {
  // specialists support nobody; they do one thing (or, if consultants, none)
  if (!starter && Math.random() < TUNE.specialistChance) {
    const isConsultant = Math.random() < TUNE.consultantChance;
    const spec = isConsultant ? SPECIALISTS.find(s => s.id === 'consultant')
                              : pick(SPECIALISTS.filter(s => !s.dud));
    return {
      id: uid++, kind: 'ops', name: genName(false),
      role: spec.role, spec: spec.id, salary: ri(spec.sal[0], spec.sal[1]),
      supports: 0, trait: null,
      quirk: pick(spec.dud ? OPS_DUD_QUIRKS : OPS_QUIRKS),
      icon: spec.icon,
    };
  }
  const rIdx = Math.floor(Math.random() * OPS_ROLES.length);
  const r = Math.random();
  // starters are dependable generalists so every opening roster is supported
  let supports = starter ? TUNE.supportRatio : (r < 0.2 ? 1 : r < 0.75 ? 2 : 3);
  let salary = 3 + supports * 4 + ri(0, 3);
  let trait = null;
  let quirk = pick(OPS_QUIRKS);
  const t = Math.random();
  if (!starter) {
    const f = TUNE.opsFlawChance, ch = f + TUNE.opsChaoticChance, du = ch + TUNE.opsDudChance;
    if (t < f) { trait = OPS_TRAITS[3]; salary = Math.max(5, salary - 2); }
    else if (t < ch) { trait = OPS_TRAITS[4]; supports = 3; salary = 3 + 2 * 4 + ri(0, 3); } // 3-cap at a 2-cap price: the bait
    else if (t < du) { supports = 1; salary = 3 + 4 + ri(6, 10); quirk = pick(OPS_DUD_QUIRKS); } // hidden: senior price, junior coverage
    else if (t < du + 0.08) salary += ri(4, 8); // plain overpriced, no upside
  }
  return {
    id: uid++, kind: 'ops', name: genName(false),
    role: OPS_ROLES[rIdx], salary, supports, trait,
    quirk,
    icon: 'ops_' + (rIdx + 1),
  };
}

function specCount(id) { return G.ops.filter(o => o.spec === id).length; }

function buildRivals(chosenId) {
  const mk = t => ({
    short: t.short, name: t.name, align: t.align,
    // flat+slope compresses the spread so no single giant hoovers the wins
    budget: Math.round((TUNE.rivalFlat + t.budget * TUNE.rivalSlope) * TUNE.rivalBudgetMult),
    tags: t.tags,
    victories: 0,
    conf: TUNE.confStart, dents: [], vendettas: {},
    ai: t.ai || DEFAULT_AI, chest: 0, plan: {}, eyeing: [], lostByTag: {},
  });
  const chosen = new Set([].concat(chosenId));
  const rivals = TANKS.filter(t => !chosen.has(t.id)).map(mk);
  NPC_TANKS.forEach(t => rivals.push(mk(t)));
  return rivals;
}

// rivals have donor bases too: a gauge that scales their spending, a log of
// every dent you put in them, and grudges against particular players
function rivalConf(r) { return r.conf === undefined ? TUNE.confStart : r.conf; }
function rivalConfMult(r) { const b = confBand(rivalConf(r)).id; return b === 'confident' ? 1 : b === 'watchful' ? 0.9 : b === 'spooked' ? 0.75 : 0.6; }
function bumpRivalConf(r, delta) { r.conf = Math.max(0, Math.min(100, rivalConf(r) + delta)); }
function dentRival(r, n, why, conf) {
  if (!r) return;
  if (n) r.budget = Math.max(TUNE.raidMinBudget, r.budget - n);
  if (conf) bumpRivalConf(r, conf);
  r.dents = r.dents || [];
  r.dents.push({ n: n || 0, conf: conf || 0, why, m: W.month });
}
function dentText(r) {
  return (r.dents || []).map(e => `${e.n ? `budget −${e.n}` : ''}${e.n && e.conf ? ', ' : ''}${e.conf ? `confidence ${e.conf}` : ''}: ${e.why} (${dateStr(e.m)})`).join(' · ');
}
function vendettaAgainstMe(r) { return !!((r.vendettas || {})[G.pid || 'me']); }
function swearVendetta(r, why, news) {
  if (!r || vendettaAgainstMe(r)) return;
  r.vendettas = r.vendettas || {};
  r.vendettas[G.pid || 'me'] = true;
  logLine(`${r.short} swears a VENDETTA over ${why}: expect twice the poaching — scholars, ops and donors — plus whisper campaigns, from here on.`);
  if (news) news.push({ h: `${r.short.toUpperCase()} DECLARES WAR ON ${tank().short.toUpperCase()}`, s: `${why} was, in their words, “a line.” Their development office has your donor list open; their recruiters have your org chart.` });
}

function mkDonorInstance(defId) {
  const d = DONORS.find(x => x.id === defId);
  const inst = {
    ...d, demand: { ...d.demand }, strikes: 0, joined: G ? W.month : 0,
    grant: Math.round(d.grant * TUNE.grantMult),
    term: ri(TUNE.grantTermMin, TUNE.grantTermMax),
  };
  if (d.perk === 'anchor') inst.term = undefined; // never sunsets
  return inst;
}

function drawFightInto() { const n = W.fights.length; drawFight(); return W.fights.length > n; }

function drawFight() {
  if (!W.fightDeck.length) {
    const active = new Set(W.fights.map(f => f.defId));
    W.fightDeck = shuffle(FIGHTS.map(f => f.id).filter(id => !active.has(id)));
  }
  const defId = W.fightDeck.pop();
  const def = FIGHTS.find(f => f.id === defId);
  const r = def.reward;
  const targetRival = def.target === 'rival' && W.rivals && W.rivals.length ? pick(W.rivals).short : null;
  W.fights.push({
    defId, type: def.type, tag: def.tag,
    reward: { cash: Math.round((r.cash || 0) * TUNE.fightCashMult), inf: r.inf || 0, special: r.special || null },
    title: def.title.replace('{NOM}', genName(true)).replace('{RIVAL}', targetRival || 'Somebody'),
    monthsLeft: def.months,
    sides: def.sides.map(s => ({ label: s.label, lean: s.lean, total: 0, yours: 0, rivals: {} })),
    rivalPicks: {}, crossed: {}, targetRival, monthUsed: {},
  });
}

function donorEligible(id) {
  const def = DONORS.find(d => d.id === id);
  return !def.require || def.require(G);
}

function drawDonorToMarket() {
  const taken = () => new Set([...G.donors.map(d => d.id), ...G.donorMarket.map(d => d.id)]);
  // online: now and then the card is another human's actual funder — a raid
  if (players().length > 1 && Math.random() < 0.1) {
    const others = players().filter(p => p !== G && p.donors.filter(x => !x.lapsing && !x.poach).length >= 2);
    if (others.length) {
      const v = pick(others);
      const src = pick(v.donors.filter(x => !x.lapsing && !x.poach));
      if (src && !taken().has(src.id)) {
        const card = { ...mkDonorInstance(src.id), grant: src.grant, from: tankOf(v).short, fromPid: v.pid };
        G.donorMarket.push(card);
        return true;
      }
    }
  }
  if (!G.donorDeck.length) {
    G.donorDeck = shuffle(DONORS.map(d => d.id).filter(id => !taken().has(id)));
    if (!G.donorDeck.length) return false; // literally everyone already funds you
  }
  // skip prerequisite donors whose gate the current base doesn't clear;
  // set them aside so they can reappear once you qualify
  const held = [];
  let id;
  while ((id = G.donorDeck.pop()) !== undefined) {
    if (taken().has(id)) continue; // already yours (raids can leave duplicates in the deck)
    if (donorEligible(id)) {
      const inst = mkDonorInstance(id);
      // some donors currently fund a rival: courting them is a raid
      if (W && W.rivals && W.rivals.length && Math.random() < TUNE.donorRaidChance) inst.from = pick(W.rivals).short;
      G.donorMarket.push(inst); G.donorDeck.unshift(...held); return true;
    }
    held.push(id);
  }
  G.donorDeck.unshift(...held);
  return false;
}

function drawHire() {
  const opsInMarket = G.hireMarket.filter(h => h.kind === 'ops').length;
  const wantOps = opsInMarket === 0 || Math.random() < 0.28;
  G.hireMarket.push(wantOps ? genOps() : genScholar(false));
}

// ---------- new game ----------
function makeWorld(chosenIds) {
  const ids = [].concat(chosenIds);
  const aiLevel = Math.max(0, ...ids.map(id => AI_LEVELS[(TANKS.find(t => t.id === id) || {}).diff] || 0));
  return { month: 0, fights: [], fightDeck: shuffle(FIGHTS.map(f => f.id)), rivals: buildRivals(chosenIds),
           leaderShort: null, freeze: 0, players: [], aiLevel };
}

// one institution; with no world given it also carries the world fields
// (single-player) — otherwise it lives inside the shared campaign world
function makeInstitution(tankId, world) {
  const t = TANKS.find(x => x.id === tankId);
  const P = {
    tankId, cash: t.cash, influence: t.influence,
    scholars: [], ops: [], donors: [], programs: {},
    hireMarket: [], donorMarket: [],
    donorDeck: shuffle(DONORS.map(d => d.id).filter(id => !t.donors.includes(id))),
    log: [], negStreak: 0, over: false, monthCommits: {}, progMonths: {}, prospects: {},
    crisis: null, usedCrises: [], v: 2,
    confidence: TUNE.confStart, confLog: [], courtsThisMonth: 0,
    allies: {}, pendingNews: [],
    stats: { months: 0, won: 0, lost: 0, peakCash: t.cash },
  };
  if (!world) Object.assign(P, makeWorld([tankId]), { players: undefined });
  const prevG = G, prevW = W;
  G = P; W = world || P;
  PROGRAMS.forEach(p => G.programs[p.id] = false);
  for (let i = 0; i < t.scholars; i++) G.scholars.push(genScholar(true));
  for (let i = 0; i < t.ops; i++) G.ops.push(genOps(true));
  t.donors.forEach(id => G.donors.push(mkDonorInstance(id)));
  rollChaos();
  while (G.donorMarket.length < TUNE.donorSlots && drawDonorToMarket()) {}
  while (G.hireMarket.length < TUNE.hireSlots) drawHire();
  G = prevG; W = prevW;
  return P;
}

function newGame(tankId) {
  const t = TANKS.find(x => x.id === tankId);
  G = makeInstitution(tankId, null);
  W = G; // single-player: the world and the institution are one object
  while (W.fights.length < TUNE.fightSlots) drawFight();
  logLine(`${t.name} opens its doors. Motto: “${t.motto}”`);
  save();
  showScreen('game');
  render();
  let seen = false;
  try { seen = !!localStorage.getItem('ttt-tut-seen'); } catch (e) {}
  if (!seen) startTutorial();
}
function supportCap() { return G.ops.reduce((a, o) => a + (o.flaked ? 0 : (o.supports === undefined ? TUNE.supportRatio : o.supports)), 0); }

function rollChaos() {
  G.ops.forEach(o => { o.flaked = !!(o.trait && o.trait.id === 'chaotic' && Math.random() < TUNE.chaosFlakeChance); });
}

function production() {
  const cap = supportCap();
  const meddlers = G.donors.filter(d => d.flaw === 'meddler' && !d.lapsing).length;
  let sum = 0;
  G.scholars.forEach((s, i) => {
    let out = i < cap ? s.out : Math.floor(s.out * TUNE.unsupportedMult);
    if (s.mope > 0) out = Math.floor(out * TUNE.moraleMult);
    if (meddlers) out = Math.floor(out * (1 - 0.08 * meddlers));
    sum += out;
  });
  PROGRAMS.forEach(p => { if (G.programs[p.id]) sum += p.inf; });
  G.ops.forEach(o => { if (o.trait && o.trait.id === 'inf') sum += 2; });
  sum += specCount('comms') * 3;
  sum += specCount('editor') * Math.min(8, G.scholars.length);
  return sum;
}

function opsGrantBonus() {
  return G.ops.reduce((a, o) => a + (o.trait && o.trait.id === 'grants' ? 6 : 0), 0);
}

function payrollCost() {
  let c = 0;
  G.scholars.forEach(s => c += s.salary);
  G.ops.forEach(o => c += o.salary + (o.trait && o.trait.id === 'expense' ? 6 : 0));
  return c;
}

function programsCost() {
  let c = 0;
  PROGRAMS.forEach(p => { if (G.programs[p.id]) c += p.cost; });
  return Math.round(c * Math.pow(0.7, specCount('creative')));
}

function effectiveRent() { return Math.round(tank().rent * (G.programs.wing ? 0.5 : 1)); }

function monthlyCosts() { return effectiveRent() + payrollCost() + programsCost(); }

function activeDonors() { return G.donors.filter(d => !d.lapsing); }

function monthlyGrants() {
  let g = G.donors.reduce((a, d) => a + d.grant, 0) + opsGrantBonus();
  const matchers = G.donors.filter(d => d.perk === 'matching' && !d.lapsing).length;
  if (matchers) g += matchers * 4 * Math.max(0, activeDonors().length - 1);
  return g;
}

// ---------- scholars who do things ----------
// a few quirks are mechanical; the rest stay flavor
const QUIRK_FX = {
  'Cable hit every Thursday. Hair and makeup at 4.': 'cable',
  'The book tour never technically ended.': 'book',
  'Currently feuding with a podcast.': 'feud',
  'Substack has 14 paying subscribers, all donors.': 'substack',
  'Has testified 44 times; remembers 3.': 'veteran',
  'Was “in the room.” Won’t say which room.': 'connected',
  'Shook three presidents’ hands in one buffet line.': 'connected',
};
const quirkId = s => QUIRK_FX[s.quirk] || null;

function scholarMonth(news) {
  G.scholars.forEach(s => {
    const q = quirkId(s);
    if (q === 'cable' && Math.random() < 0.2) {
      if (Math.random() < 0.7) { G.influence += 5; logLine(`${s.name} nails the Thursday hit: +✦5.`); }
      else {
        const d = pick(activeDonors());
        if (d) d.strikes++;
        news.push({ h: `${s.name.toUpperCase()} SAYS THE QUIET PART ON CABLE`, s: `The clip is everywhere. ${d ? d.name + ' has questions.' : 'Mercifully, nobody who funds you was watching.'}` });
      }
    } else if (q === 'book' && Math.random() < 0.15) {
      G.influence += 4; logLine(`${s.name}'s book tour stops somewhere new: +✦4.`);
    } else if (q === 'feud' && Math.random() < 0.12) {
      const r = pick(W.rivals);
      if (Math.random() < 0.5) { G.influence += 4; news.push({ h: `${s.name.toUpperCase()} WINS PODCAST FEUD, FOR NOW`, s: `A ${r.short} fellow's rebuttal episode ran ninety minutes and convinced no one. +✦4.` }); }
      else { G.influence = Math.max(0, G.influence - 4); news.push({ h: `${s.name.toUpperCase()} LOSES ROUND OF PODCAST FEUD`, s: `The ${r.short} podcast had receipts. −✦4, and the feud continues.` }); }
    } else if (q === 'substack' && Math.random() < 0.1) {
      bumpConf(2, `${s.name}'s newsletter`);
    }
  });
}

// the revolving door: government taps a scholar; you decide whether to let them go
function revolvingDoor(news) {
  if (G.scholars.length < 2 || G.scholars.some(s => s.tapped || s.poach)) return;
  const cands = G.scholars.filter(s => Math.random() < (quirkId(s) === 'connected' ? TUNE.tapConnectedChance : TUNE.tapChance));
  if (!cands.length) return;
  const s = pick(cands);
  s.tapped = { deadline: W.month + 1, post: pick(GOV_POSTS).replace('{TAG}', TAG_NAMES[s.tag]) };
  news.push({ h: `${s.name.toUpperCase()} TAPPED FOR GOVERNMENT`, s: `The administration wants them as ${s.tapped.post}. Let them serve and you gain an ally on ${s.tag}; talk them out of it and you keep the scholar. Decide from the staff panel this month.` });
  logLine(`${s.name} tapped for ${s.tapped.post} — serve (ally) or keep (✦25)?`);
}

function serveInGovernment(s, news) {
  G.scholars = G.scholars.filter(x => x !== s);
  G.allies = G.allies || {};
  G.allies[s.tag] = Math.min(3, (G.allies[s.tag] || 0) + 1);
  news.push({ h: `${s.name.toUpperCase()} SWORN IN AS ${s.tapped.post.toUpperCase()}`, s: `A framed photo goes up in the lobby. Your ${s.tag} commits now carry +${Math.round(TUNE.allyBonus * 100)}% per ally in government (${G.allies[s.tag]} on ${s.tag}).` });
  logLine(`${s.name} joins the administration — ally on ${s.tag} (${G.allies[s.tag]}).`);
}

function actServe(id) {
  const s = G.scholars.find(x => x.id === id);
  if (!s || !s.tapped) return;
  G.pendingNews = G.pendingNews || [];
  serveInGovernment(s, G.pendingNews);
  save(); render();
}

function actKeepScholar(id) {
  const s = G.scholars.find(x => x.id === id);
  if (!s || !s.tapped) return;
  if (G.influence < 25) return flash('Talking them out of it takes ✦25.');
  G.influence -= 25;
  logLine(`${s.name} turns down ${s.tapped.post}. It cost ✦25 and a very good lunch.`);
  delete s.tapped;
  save(); render();
}

// testimony: in a fight's final month, your best matching scholar takes the stand
function testimonyReady(f) {
  return f.monthsLeft <= 1 && !f.testimony && f.sides.some(s => yoursOf(s) > 0) && G.scholars.some(s => s.tag === f.tag);
}

function bestWitness(tag) {
  return [...G.scholars].filter(s => s.tag === tag).sort((a, b) => b.out - a.out)[0];
}

function testifyOdds(s, prep, f) {
  const hearing = f && f.type === 'HEARING' ? 0.2 : 0;
  return Math.max(0.35, Math.min(0.95, TUNE.testifyBase + s.out / 100 + (quirkId(s) === 'veteran' ? 0.15 : 0) + (prep ? TUNE.testifyPrepBonus : 0) + hearing));
}
function testifyPrepCost() { return specCount('comms') ? 0 : TUNE.testifyPrepCost; }
// what's actually on the table: success scales with the fight, a flub is capped
function testifyStakes(f, s) {
  const side = yoursOf(f.sides[0]) >= yoursOf(f.sides[1]) ? f.sides[0] : f.sides[1];
  const opp = f.sides[side === f.sides[0] ? 1 : 0];
  const gain = Math.max(Math.round(s.out * 1.5), Math.round(opp.total * TUNE.testifyPileShare));
  const loss = Math.min(Math.round(yoursOf(side) * TUNE.testifyFlubPct), s.out);
  return { side, gain, loss };
}

function actTestify(fi, prep) {
  const f = W.fights[fi];
  if (!f || !testimonyReady(f)) return;
  const s = bestWitness(f.tag);
  if (prep) {
    const pc = testifyPrepCost();
    if (G.influence < pc) return flash(`Prepping ${s.name} takes ✦${pc}. You have ${G.influence}.`);
    G.influence -= pc;
  }
  const { side, gain, loss } = testifyStakes(f, s);
  const p = testifyOdds(s, prep, f);
  const ok = Math.random() < p;
  G.pendingNews = G.pendingNews || [];
  { const R = rec(); R.testimonies++; if (ok) R.testimonyWins++; }
  if (ok) {
    const eff = gain;
    side.total += eff; addYours(side, eff);
    G.monthCommits = G.monthCommits || {}; G.monthCommits[f.tag] = (G.monthCommits[f.tag] || 0) + eff;
    f.testimony = { who: s.name, ok: true, eff };
    G.pendingNews.push({ h: `${s.name.toUpperCase()} COMMANDS THE HEARING ROOM`, s: `Members quoted the testimony back to each other. +${eff} to “${side.label}” on ${f.title}.` });
    logLine(`📣 ${s.name} testified on ${f.title}: +${eff} (${Math.round(p * 100)}% odds).`);
  } else {
    const cut = loss;
    addYours(side, -cut); side.total -= cut;
    s.mope = Math.max(s.mope || 0, 1);
    if (f.type === 'HEARING') bumpConf(-3, `${s.name} flubbed a hearing on camera`);
    f.testimony = { who: s.name, ok: false, eff: -cut };
    G.pendingNews.push({ h: `${s.name.toUpperCase()} FLUBS TESTIMONY`, s: `A senator asked a question; the answer was a different question. −${cut} to “${side.label}” on ${f.title}, and a bruised ego.` });
    logLine(`📣 ${s.name} flubbed on ${f.title}: −${cut} (${Math.round(p * 100)}% odds).`);
  }
  save(); render();
}

// ---------- the calendar ----------
function calendarOf(m) { return CALENDAR[m] || null; }

function drawMarqueeFight(news) {
  if (!drawFightInto()) return;
  const f = W.fights[W.fights.length - 1];
  f.marquee = true;
  f.title = 'SOTU: ' + f.title;
  f.reward = { cash: (f.reward.cash || 0) * 2, inf: (f.reward.inf || 0) * 2, special: f.reward.special || null };
  f.monthsLeft = 2;
  news.push({ h: 'STATE OF THE UNION SETS THE AGENDA', s: `“${f.title.replace('SOTU: ', '')}” is the marquee fight of the year — double rewards, and every institution in town wants the credit. Two months to the vote.` });
  logLine(`SOTU marquee fight: ${f.title} (double rewards).`);
}

// ---------- donor confidence ----------
function bumpConf(delta, why) {
  if (G.confidence === undefined) G.confidence = TUNE.confStart;
  const before = G.confidence;
  G.confidence = Math.max(0, Math.min(100, G.confidence + delta));
  const applied = G.confidence - before;
  if (applied === 0) return;
  G.confLog = G.confLog || [];
  G.confLog.unshift({ m: W.month, d: applied, why });
  if (G.confLog.length > 8) G.confLog.pop();
}

function confBand(v) {
  const c = v === undefined ? (G.confidence === undefined ? TUNE.confStart : G.confidence) : v;
  if (c >= 70) return { id: 'confident', label: 'Confident', cls: 'ok' };
  if (c >= 40) return { id: 'watchful', label: 'Watchful', cls: '' };
  if (c >= 20) return { id: 'spooked', label: 'Spooked', cls: 'warn' };
  return { id: 'exodus', label: 'Exodus', cls: 'bad' };
}

function stewardCap() {
  return TUNE.stewardBase + TUNE.stewardPerDev * specCount('devdir')
       + G.ops.filter(o => o.trait && o.trait.id === 'grants').length;
}

function confLedgerText() {
  const rows = (G.confLog || []).map(e => `${e.d > 0 ? '+' : ''}${e.d} ${e.why}`);
  return rows.length ? 'Recent: ' + rows.join(' · ') : 'No recent movers.';
}

// the month-end pass: drift, stewardship bleed, and what a shaky base does to you
function confidenceMonth(news) {
  if (G.confidence === undefined) G.confidence = TUNE.confStart;
  const before = confBand().id;
  const over = activeDonors().length - stewardCap();
  if (over > 0) bumpConf(TUNE.confOverCap * over, `${over} donor${over > 1 ? 's' : ''} beyond stewardship`);
  if (G.confidence < TUNE.confStart) bumpConf(Math.min(TUNE.confDrift, TUNE.confStart - G.confidence), 'worries fading');
  else if (G.confidence > TUNE.confStart) bumpConf(-1, 'settling');
  const band = confBand();
  const pool = activeDonors();
  if (band.id === 'watchful' && pool.length && Math.random() < 0.10) {
    const d = pick(pool); d.strikes++;
    logLine(`Donor confidence is only ${band.label.toLowerCase()}: ${d.name} takes a nervous strike.`);
  } else if (band.id === 'spooked' && pool.length && Math.random() < 0.25) {
    const d = pick(pool); d.strikes++;
    logLine(`Donors are spooked: ${d.name} takes a strike.`);
  } else if (band.id === 'exodus' && pool.length) {
    const d = pick(pool);
    G.donors = G.donors.filter(x => x !== d);
    G.donorDeck.unshift(d.id);
    news.push({ h: `${d.name.toUpperCase()} JOINS THE EXODUS`, s: `Donor confidence has collapsed (${G.confidence}/100). Funders are leaving on principle, which is to say in a herd.` });
    logLine(`EXODUS: ${d.name} leaves — donor confidence ${G.confidence}.`);
  }
  const after = confBand().id;
  if (before !== after) {
    const msgs = {
      confident: 'The base is steady again. Development exhales.',
      watchful: 'Funders have started comparing notes. Nothing dramatic — yet.',
      spooked: 'Grant officers are “re-evaluating priorities.” Courting costs more; renewals cost double; strikes come easier.',
      exodus: 'The herd has turned. One donor leaves every month until confidence recovers.',
    };
    news.push({ h: `DONOR BASE NOW “${confBand().label.toUpperCase()}”`, s: msgs[after] });
    logLine(`Donor confidence band: ${before} → ${after} (${G.confidence}).`);
  }
  G.courtsThisMonth = 0;
}

// ---------- demands ----------
function demandText(d) {
  const dm = d.demand;
  if (dm.type === 'ROSTER') return (dm.count || 1) > 1 ? `Wants ${dm.count} ${dm.tag} scholars on staff` : `Wants a ${dm.tag} scholar on staff`;
  if (dm.type === 'PROGRAM') return `Wants the ${PROGRAMS.find(p => p.id === dm.pid).name} running`;
  if (dm.type === 'ENGAGE') return `Wants ✦${dm.amt}/mo pushed into ${dm.tag} fights`;
  if (dm.type === 'WHALE') return `Wants to be one of at most ${dm.maxOthers + 1} funders${d.whim ? `; also ${d.whim.text}` : ''}`;
  if (dm.type === 'NOCROSS') {
    const side = d.lean > 0 ? 'left' : 'right';
    return dm.tag ? `Never back ${side}-coded positions on ${dm.tag}` : `Never back ${side}-coded positions, period`;
  }
  return '?';
}

function demandMet(d) {
  const dm = d.demand;
  if (dm.type === 'ROSTER') return G.scholars.filter(s => s.tag === dm.tag).length >= (dm.count || 1);
  if (dm.type === 'PROGRAM') return !!G.programs[dm.pid];
  if (dm.type === 'ENGAGE') {
    const pushed = (G.monthCommits || {})[dm.tag] || 0;
    const onBoard = W.fights.some(f => f.tag === dm.tag);
    return pushed >= dm.amt || !onBoard; // forgiven when their issue isn't up
  }
  if (dm.type === 'WHALE') {
    const others = activeDonors().filter(x => x !== d).length;
    if (others > dm.maxOthers) return false;
    if (d.whim) return demandMet({ demand: d.whim, lean: d.lean, id: d.id });
    return true;
  }
  return true; // NOCROSS strikes are event-driven at commit time
}

// a whale's whim is a full demand in miniature; NOCROSS whims sting on commit
function whimAngeredBy(fight, side) {
  return G.donors.filter(d => d.whim && d.whim.type === 'NOCROSS' && !d.lapsing &&
    d.lean * side.lean < 0 && !fight.crossed['whim:' + d.id]);
}

// the whale's month: the grant compounds, the circle tightens, a new whim lands
function whaleMonth(news) {
  G.donors.filter(d => d.whale && !d.lapsing).forEach(d => {
    d.grant = Math.round(d.grant * (1 + TUNE.whaleGrowth));
    d.whaleMonths = (d.whaleMonths || 0) + 1;
    if (d.whaleMonths % TUNE.whaleShrinkEvery === 0 && d.demand.maxOthers > 0) {
      d.demand.maxOthers--;
      news.push({ h: `${d.name.toUpperCase()} WOULD PREFER FEWER VOICES`, s: `They now tolerate at most ${d.demand.maxOthers} other funder${d.demand.maxOthers === 1 ? '' : 's'}. Their grant, meanwhile, is up to ${fmtMoney(d.grant)}/mo.` });
    }
    if (d.whaleMonths % 3 === 0) {
      const w = pick(WHALE_WHIMS);
      const tag = pick(TAGS);
      d.whim = { type: w.type, pid: w.pid, tag: w.type === 'NOCROSS' ? null : tag, amt: w.amt,
        text: w.text.replace('{TAG}', tag).replace('{SIDE}', d.lean > 0 ? 'left' : d.lean < 0 ? 'right' : 'partisan') };
      news.push({ h: `${d.name.toUpperCase()} HAS A NEW REQUEST`, s: `They ${d.whim.text}. Unmet whims are strikes, and they only tolerate two.` });
      logLine(`${d.name}'s new whim: ${d.whim.text}.`);
    }
  });
}

// donors who would be angered by committing to this side of this fight
function angeredBy(fight, side) {
  return G.donors.filter(d =>
    d.demand.type === 'NOCROSS' &&
    d.lean * side.lean < 0 &&
    (!d.demand.tag || d.demand.tag === fight.tag) &&
    !fight.crossed[d.id]);
}

// partisan fit: matching leans discount a hire/courtship, crossing costs
// extra — and hardline shops (two arrows, |align| = 2) feel both harder
function fitMult(lean, kind) {
  const a = tank().align;
  const m = (lean || 0) * Math.sign(a);
  if (m === 0) return 1;
  const hard = Math.abs(a) >= 2;
  if (kind === 'hire') {
    return m > 0 ? (hard ? TUNE.hireMatchMult2 : TUNE.hireMatchMult)
                 : (hard ? TUNE.hireOpposeMult2 : TUNE.hireOpposeMult);
  }
  return m > 0 ? (hard ? TUNE.donorMatchMult2 : TUNE.donorMatchMult)
               : (hard ? TUNE.donorOpposeMult2 : TUNE.donorOpposeMult);
}

function hireBonus(h) {
  let b = h.salary * TUNE.signingMonths;
  if (h.kind !== 'scholar') return Math.ceil(b);
  b *= fitMult(h.lean, 'hire');
  if (h.from) b *= TUNE.raidBonusMult; // buying out a rival's fellow
  return Math.ceil(b);
}

function courtCost(d) { const c = courtCostBase(d); return d.from ? Math.ceil(c * TUNE.donorRaidMult) : c; }
function courtCostBase(d) {
  const connector = G.ops.some(o => o.trait && o.trait.id === 'court') ? 0.9 : 1;
  const devdir = Math.pow(0.85, specCount('devdir'));
  const band = confBand().id;
  const mood = band === 'confident' ? 0.95 : (band === 'spooked' || band === 'exodus') ? 1.25 : 1;
  const recess = calendarOf(W.month) === 'august' ? 0.8 : 1; // gala season: everyone's at the beach, and buyable
  return Math.ceil(d.cost * TUNE.courtCostMult * connector * devdir * mood * recess * fitMult(d.lean, 'donor'));
}

function renewCost(d) {
  const band = confBand().id;
  return Math.ceil(courtCost(d) * TUNE.renewCostMult * ((band === 'spooked' || band === 'exodus') ? 2 : 1));
}

// visible tip when the player's politics move a price: "▼ −50%", with the
// actual before/after numbers on hover
function fitTipSpan(m, pct, detail) {
  if (m === 0 || pct === 0) return '';
  const label = (pct > 0 ? '+' : '−') + Math.abs(pct) + '%';
  return m > 0
    ? ` <span class="fittip ok" title="Shares your shop's politics — ${detail}">▼ ${label}</span>`
    : ` <span class="fittip warn" title="Crosses the aisle to work with you — ${detail}">▲ ${label}</span>`;
}

function fitTipHire(h) {
  if (h.kind !== 'scholar') return '';
  const m = (h.lean || 0) * Math.sign(tank().align);
  const base = Math.ceil(h.salary * TUNE.signingMonths * (h.from ? TUNE.raidBonusMult : 1));
  const now = hireBonus(h);
  return fitTipSpan(m, Math.round((now / base - 1) * 100), `signing bonus ${fmtMoney(base)} → ${fmtMoney(now)}`);
}

function fitTipDonor(d) {
  const m = (d.lean || 0) * Math.sign(tank().align);
  const base = Math.ceil(d.cost * TUNE.courtCostMult);
  const now = courtCost(d);
  return fitTipSpan(m, Math.round((now / base - 1) * 100), `courting cost ✦${base} → ✦${now}`);
}

// matching scholars amplify influence committed to a fight of their tag
function expertiseMult(tag) {
  const n = G.scholars.filter(s => s.tag === tag).length;
  return 1 + Math.min(TUNE.expertiseCap, TUNE.expertisePerScholar * n)
       + (G.programs.warroom ? TUNE.warroomBonus : 0)
       + 0.05 * specCount('govrel')
       + 0.08 * G.donors.filter(d => d.perk === 'megaphone' && !d.lapsing).length
       + TUNE.allyBonus * ((G.allies || {})[tag] || 0);
}

// resolution odds: sharpened contest curve — a 2:1 influence lead wins ~85%,
// 3:1 ~94%, but nothing is ever certain (except a walkover vs zero)
function fightType(f) { return FIGHT_TYPES[f.type] || {}; }
function fightK(f) { return fightType(f).k || TUNE.contestK; }
function fightCap(f) { return fightType(f).capPerMonth || 0; }
function winProbA(f) {
  const a = f.sides[0].total, b = f.sides[1].total;
  if (a === 0 && b === 0) return 0.5;
  const k = fightK(f);
  const pa = Math.pow(a, k), pb = Math.pow(b, k);
  return pa / (pa + pb);
}

// rewards were plain cash numbers in early saves; normalize
function fightReward(f) {
  const r = f.reward;
  if (typeof r === 'number') return { cash: r, inf: 0, special: null };
  return { cash: r.cash || 0, inf: r.inf || 0, special: r.special || null };
}

function rewardText(f) {
  const r = fightReward(f);
  const parts = [];
  if (r.cash) parts.push(fmtMoney(r.cash));
  if (r.inf) parts.push(`✦${r.inf}`);
  if (r.special === 'scholar') parts.push('🎓 scholar');
  if (r.special === 'donorlead') parts.push('🤝 intro');
  if (r.special === 'absolve') parts.push('😇 amnesty');
  if (r.special === 'ally') parts.push('⚖ ally');
  return parts.join(' + ') || '—';
}

function rewardTip(f) {
  const r = fightReward(f);
  const parts = [];
  if (r.cash) parts.push(`${fmtMoney(r.cash)} in grants, scaled by your share of the winning side`);
  if (r.inf) parts.push(`✦${r.inf} of clout, share-scaled`);
  if (r.special === 'scholar') parts.push('🎓 a grateful expert joins your roster free');
  if (r.special === 'donorlead') parts.push('🤝 warm intro: a donor appears in the market at half courting cost');
  if (r.special === 'absolve') parts.push('😇 amnesty: every current donor\'s strikes drop by 1');
  if (r.special === 'ally') parts.push(`⚖ a friend on the bench: +${Math.round(TUNE.allyBonus * 100)}% on your ${f.tag} commits, permanently`);
  return 'If your side wins: ' + parts.join(' · ') + '. The victory itself goes to the side\'s single top contributor.';
}

// ---------- player actions ----------
function actHire(idx) {
  const h = G.hireMarket[idx];
  if (!h) return;
  const bonus = hireBonus(h);
  if (G.cash < bonus) return flash(`Signing bonus is ${fmtMoney(bonus)}. You don’t have it.`);
  G.cash -= bonus;
  G.hireMarket.splice(idx, 1);
  (h.kind === 'scholar' ? G.scholars : G.ops).push(h);
  drawHire();
  if (h.from) {
    const r = W.rivals.find(x => x.short === h.from);
    dentRival(r, TUNE.raidBudgetHit, `you poached ${h.name}`);
    rec().raids = (rec().raids || 0) + 1;
    logLine(`RAID: poached ${h.name} from ${h.from} for a ${fmtMoney(bonus)} buyout. ${h.from}'s influence budget slips to ~${r ? r.budget : '?'}/mo.`);
  } else {
    logLine(`Hired ${h.name} (${h.kind === 'scholar' ? TAG_NAMES[h.tag] : h.role}). Signing bonus ${fmtMoney(bonus)}.`);
  }
  save(); render();
}

function actFire(kind, id) {
  const list = kind === 'scholar' ? G.scholars : G.ops;
  const i = list.findIndex(x => x.id === id);
  if (i < 0) return;
  const p = list[i];
  const sev = p.salary * TUNE.severanceMonths;
  // ops are expendable; scholars are the product — cutting one unsettles donors,
  // and unsettles them more if it strands a ROSTER demand for that tag
  if (kind === 'scholar') {
    const strands = G.donors.filter(d => !d.lapsing && d.demand.type === 'ROSTER' && d.demand.tag === p.tag
      && G.scholars.filter(s => s.tag === p.tag).length <= (d.demand.count || 1));
    const worried = shuffle(activeDonors()).slice(0, 1).filter(d => !strands.includes(d));
    const msg = `Let ${p.name} go? Severance ${fmtMoney(sev)}.`
      + (strands.length ? ` ${strands.length} donor(s) rely on your ${p.tag} bench and will take a strike.` : '')
      + (worried.length ? ` The move also unsettles ${worried[0].name} (a strike).` : '');
    if (!confirm(msg)) return;
    G.cash -= sev;
    list.splice(i, 1);
    strands.forEach(d => d.strikes++);
    worried.forEach(d => d.strikes++);
    bumpConf(TUNE.confFire, `fired ${p.name}`);
    logLine(`${p.name} let go. ${strands.length + worried.length} donor(s) unsettled.`);
  } else {
    if (!confirm(`Let ${p.name} go? Severance ${fmtMoney(sev)}.`)) return;
    G.cash -= sev;
    list.splice(i, 1);
    logLine(`${p.name} has “left to pursue outside opportunities.” Severance ${fmtMoney(sev)}.`);
  }
  save(); render();
}

function actCourt(idx) {
  const d = G.donorMarket[idx];
  if (!d) return;
  const cost = courtCost(d);
  if (G.influence < cost) return flash(`Courting ${d.name} takes ${cost} influence. You have ${G.influence}.`);
  G.influence -= cost;
  G.donorMarket.splice(idx, 1);
  // a raid on another human's funder is a bid: they get a month to re-cultivate
  if (d.fromPid) {
    const victim = players().find(p => p.pid === d.fromPid);
    const target = victim && victim.donors.find(x => x.id === d.id && !x.poach && !x.lapsing);
    if (!target) { G.influence += cost; drawDonorToMarket(); save(); render(); return flash(`${d.name} is no longer where you left them.`); }
    const me = G.name ? `${tank().short} (${G.name})` : tank().short;
    target.poach = { by: me, byPid: G.pid, deadline: W.month + 1, cost: withPlayer(victim, () => recultivateCost(target)) };
    victim.pendingNews = victim.pendingNews || [];
    victim.pendingNews.push({ h: `${me.toUpperCase()} COURTS ${d.name.toUpperCase()}`, s: `A rival institution wants your funder. Re-cultivate them for ✦${target.poach.cost} from the donor panel this month, or the ${fmtMoney(target.grant)}/mo walks.` });
    drawDonorToMarket();
    G.courtsThisMonth = (G.courtsThisMonth || 0) + 1;
    logLine(`RAID: bid ✦${cost} for ${d.name}, currently funding ${d.from}. They decide at month's end.`);
    save(); render();
    return;
  }
  d.joined = W.month;
  // jealous patrons resent a new courtship
  G.donors.filter(x => x.flaw === 'jealous' && !x.lapsing).forEach(x => {
    x.strikes++;
    logLine(`${x.name} is jealous of your new courtship of ${d.name}. Strike ${x.strikes}.`);
  });
  G.donors.push(d);
  if (d.from) {
    // lured off a rival: they lose budget, and they take it personally
    const r = W.rivals.find(x => x.short === d.from);
    if (r) {
      dentRival(r, TUNE.donorRaidHit, `you lured ${d.name} away`, -5);
      swearVendetta(r, `your raid on ${d.name}`, G.pendingNews = G.pendingNews || []);
      rec().raids = (rec().raids || 0) + 1;
    }
    d.raidedFrom = d.from; delete d.from;
  }
  drawDonorToMarket();
  G.courtsThisMonth = (G.courtsThisMonth || 0) + 1;
  if (G.courtsThisMonth > 1) bumpConf(TUNE.confRush, `rushed courtship (${d.name})`);
  logLine(`${d.name} is now a funder (${fmtMoney(d.grant)}/mo). Demand: ${demandText(d)}.`);
  save(); render();
}

function actDrop(id) {
  const i = G.donors.findIndex(d => d.id === id);
  if (i < 0) return;
  const d = G.donors[i];
  // losing a patron rattles the bench — especially scholars in the issue the
  // donor cared about: it reads as instability, and some get demoralized
  const tag = d.demand && d.demand.tag;
  const exposed = tag ? G.scholars.filter(s => s.tag === tag) : [];
  const msg = `Part ways with ${d.name}? Their ${fmtMoney(d.grant)}/mo goes with them.`
    + (exposed.length ? ` Your ${tag} scholars will read the room and lose morale.` : ' The staff will notice the treasury tighten.');
  if (!confirm(msg)) return;
  G.donors.splice(i, 1);
  bumpConf(TUNE.confDrop, `parted with ${d.name}`);
  if (exposed.length) exposed.forEach(s => s.mope = Math.max(s.mope || 0, TUNE.moraleMonths));
  else if (G.scholars.length && Math.random() < 0.5) pick(G.scholars).mope = TUNE.moraleMonths;
  logLine(`Parted ways with ${d.name}. ${exposed.length ? `${exposed.length} ${tag} scholar(s) demoralized.` : 'The staff noticed.'}`);
  save(); render();
}

function weakestTag() {
  return [...TAGS].sort((a, b) => G.scholars.filter(s => s.tag === a).length - G.scholars.filter(s => s.tag === b).length)[0];
}

function actProgFocus(tag) {
  if (!TAGS.includes(tag)) return;
  G.progFocus = tag;
  logLine(`Junior Fellows Program refocused on ${TAG_NAMES[tag]}.`);
  save(); render();
}

function actProgram(pid) {
  const p = PROGRAMS.find(x => x.id === pid);
  if (p.once) {
    if (G.programs[pid]) return; // permanent — no takebacks
    if (G.cash < p.once) return flash(`${p.name} takes ${fmtMoney(p.once)} up front. You don't have it.`);
    if (!confirm(`Commit ${fmtMoney(p.once)} to the ${p.name}? This is permanent.`)) return;
    G.cash -= p.once;
    G.programs[pid] = true;
    logLine(`${p.name}: endowed for ${fmtMoney(p.once)}. Forever is a long time in this town.`);
    save(); render();
    return;
  }
  G.programs[pid] = !G.programs[pid];
  if (pid === 'fellows' && G.programs[pid] && !G.progFocus) G.progFocus = weakestTag();
  logLine(G.programs[pid] ? `Launched the ${p.name} (${fmtMoney(p.cost)}/mo).` : `Quietly shut down the ${p.name}.`);
  save(); render();
}

// sweep a stale market and deal fresh cards — each sweep costs cash AND
// influence, and gets pricier every time you do it (no fishing for the
// perfect card)
function prospectPrice(kind) {
  const uses = (G.prospects || {})[kind] || 0;
  const mult = 1 + TUNE.prospectEscalate * uses;
  return kind === 'hire'
    ? { cash: Math.ceil(TUNE.prospectHireCost * mult), inf: Math.ceil(TUNE.prospectHireInf * mult) }
    : { cash: Math.ceil(TUNE.prospectDonorCost * mult), inf: Math.ceil(TUNE.prospectDonorInf * mult) };
}

function actProspect(kind) {
  const p = prospectPrice(kind);
  if (G.cash < p.cash || G.influence < p.inf) {
    return flash(`Prospecting the ${kind === 'hire' ? 'hiring' : 'donor'} market costs ${fmtMoney(p.cash)} + ✦${p.inf} right now. You're short.`);
  }
  G.cash -= p.cash;
  G.influence -= p.inf;
  G.prospects = G.prospects || {};
  G.prospects[kind] = (G.prospects[kind] || 0) + 1;
  if (kind === 'hire') {
    G.hireMarket = [];
    while (G.hireMarket.length < TUNE.hireSlots) drawHire();
    logLine(`Paid a headhunter ${fmtMoney(p.cash)} + ✦${p.inf} in favors to sweep the hiring market. The next sweep will cost more.`);
  } else {
    G.donorMarket.forEach(d => G.donorDeck.unshift(d.id));
    G.donorMarket = [];
    while (G.donorMarket.length < TUNE.donorSlots && drawDonorToMarket()) {}
    logLine(`A ${fmtMoney(p.cash)} cultivation dinner (plus ✦${p.inf} of favors) turns over the donor market. The next one costs more.`);
  }
  save(); render();
}

// renew an expiring donor on stricter terms, or let them lapse
function actRenew(id) {
  const d = G.donors.find(x => x.id === id);
  if (!d || !d.lapsing) return;
  const cost = renewCost(d);
  if (G.influence < cost) return flash(`Renewal takes ✦${cost}. You have ${G.influence}.`);
  bumpConf(TUNE.confRenew, `renewed ${d.name}`);
  G.influence -= cost;
  d.lapsing = false;
  d.joined = W.month;
  d.term = ri(TUNE.grantTermMin, TUNE.grantTermMax);
  d.renewals = (d.renewals || 0) + 1;
  if (d.demand.type === 'ENGAGE') d.demand.amt += 5;
  if (d.demand.type === 'ROSTER') d.demand.count = 2;
  d.strikes = 0;
  logLine(`Renewed ${d.name} for ${d.term} months (✦${cost}). Terms are stricter — one strike now ends it.`);
  save(); render();
}

function actLapse(id) {
  const d = G.donors.find(x => x.id === id);
  if (!d || !d.lapsing) return;
  G.donors = G.donors.filter(x => x !== d);
  G.donorDeck.unshift(d.id);
  bumpConf(TUNE.confLapse, `let ${d.name} lapse`);
  logLine(`Let ${d.name}'s grant lapse. The thank-you note was gracious and final.`);
  save(); render();
}

// a rival made your scholar a better offer
function actMatch(id) {
  const s = G.scholars.find(x => x.id === id);
  if (!s || !s.poach) return;
  if (!confirm(`Match ${s.poach.by}'s offer? ${s.name}'s salary rises to ${fmtMoney(s.poach.salary)}/mo, permanently.`)) return;
  s.salary = s.poach.salary;
  logLine(`Matched the offer: ${s.name} stays at ${fmtMoney(s.salary)}/mo. ${s.poach.by} shrugs.`);
  delete s.poach;
  save(); render();
}

function actRelease(id) {
  const s = G.scholars.find(x => x.id === id);
  if (!s || !s.poach) return;
  const r = W.rivals.find(x => x.short === s.poach.by);
  if (r) r.budget += TUNE.poachRivalGain;
  G.scholars = G.scholars.filter(x => x !== s);
  logLine(`Let ${s.name} walk to ${s.poach.by}. Their budget swells to ~${r ? r.budget : '?'}/mo.`);
  save(); render();
}

// ----- a rival is courting your donor -----
function recultivateCost(d) {
  let c = Math.ceil(courtCostBase(d) * TUNE.recultivateMult);
  if (specCount('devdir')) c = Math.ceil(c / 2);
  return Math.max(5, c);
}

function donorDefects(d, news) {
  const r = W.rivals.find(x => x.short === d.poach.by);
  if (r) r.budget += TUNE.donorPoachRivalGain;
  const raider = d.poach.byPid ? players().find(p => p.pid === d.poach.byPid) : null;
  const victim = tank().short;
  G.donors = G.donors.filter(x => x !== d);
  if (!raider) G.donorDeck.unshift(d.id);
  bumpConf(TUNE.confPoached, `${d.name} defected to ${d.poach.by}`);
  rec().donorsLost++;
  news.push({ h: `${d.name.toUpperCase()} DEFECTS TO ${d.poach.by.toUpperCase()}`, s: `The dinner worked. ${fmtMoney(d.grant)}/mo now funds someone else's gala.` });
  logLine(`${d.name} defected to ${d.poach.by}: ${fmtMoney(d.grant)}/mo gone.`);
  if (raider) {
    const nd = { ...d, strikes: 0, joined: W.month, renewals: 0, raidedFrom: victim };
    delete nd.poach; delete nd.lapsing;
    raider.donors.push(nd);
    raider.pendingNews = raider.pendingNews || [];
    raider.pendingNews.push({ h: `${d.name.toUpperCase()} COMES ABOARD`, s: `Your raid on ${victim} landed: ${fmtMoney(d.grant)}/mo, lured away.` });
    withPlayer(raider, () => { logLine(`RAID: ${d.name} defected from ${victim} to you (${fmtMoney(d.grant)}/mo).`); rec().raids = (rec().raids || 0) + 1; });
  }
}

function actRecultivate(id) {
  const d = G.donors.find(x => x.id === id);
  if (!d || !d.poach) return;
  const c = d.poach.cost;
  if (G.influence < c) return flash(`Re-cultivating ${d.name} takes ✦${c}. You have ${G.influence}.`);
  G.influence -= c;
  logLine(`Re-cultivated ${d.name} (✦${c}); ${d.poach.by} goes home hungry.`);
  if (d.poach.byPid) {
    const raider = players().find(p => p.pid === d.poach.byPid);
    if (raider) { raider.pendingNews = raider.pendingNews || []; raider.pendingNews.push({ h: `${d.name.toUpperCase()} STAYS PUT`, s: `${tank().short} re-cultivated them. Your influence bought a very nice dinner for someone else.` }); }
  }
  delete d.poach;
  save(); render();
}

function actLetGo(id) {
  const d = G.donors.find(x => x.id === id);
  if (!d || !d.poach) return;
  if (!confirm(`Let ${d.name} go to ${d.poach.by}? ${fmtMoney(d.grant)}/mo walks, and the base notices.`)) return;
  donorDefects(d, G.pendingNews = G.pendingNews || []);
  save(); render();
}

// ----- a rival is courting your ops staff -----
function actMatchOps(id) {
  const o = G.ops.find(x => x.id === id);
  if (!o || !o.poach) return;
  if (!confirm(`Match ${o.poach.by}'s offer? ${o.name}'s salary rises to ${fmtMoney(o.poach.salary)}/mo, permanently.`)) return;
  o.salary = o.poach.salary;
  logLine(`Matched the offer: ${o.name} stays at ${fmtMoney(o.salary)}/mo.`);
  delete o.poach;
  save(); render();
}

function actReleaseOps(id) {
  const o = G.ops.find(x => x.id === id);
  if (!o || !o.poach) return;
  G.ops = G.ops.filter(x => x !== o);
  logLine(`Let ${o.name} walk to ${o.poach.by}. No severance, some regret.`);
  save(); render();
}

// ----- the oppo file: attack a rival's donor confidence -----
function oppoCost() { return TUNE.oppoBase + TUNE.oppoStep * (G.oppoUses || 0); }
function commsShield() { return specCount('comms') > 0 || G.ops.some(o => /Comms/.test(o.role || '')); }
function oppoOdds() { return Math.min(0.9, TUNE.oppoOdds + (specCount('comms') ? 0.15 : 0) + (G.ops.some(o => /Comms/.test(o.role || '')) ? 0.08 : 0)); }
function actOppo(target) {
  if (G.over) return;
  if (G.oppoMonth === W.month) return flash('One oppo file a month. The town only reads so much.');
  const cost = oppoCost();
  if (G.influence < cost) return flash(`An oppo file costs ✦${cost} right now. You have ${G.influence}.`);
  const r = W.rivals.find(x => x.short === target);
  const victim = r ? null : players().find(p => p.pid === target && p !== G);
  if (!r && !victim) return;
  const vname = r ? r.short : (victim.name ? `${tankOf(victim).short} (${victim.name})` : tankOf(victim).short);
  const odds = Math.round(oppoOdds() * 100);
  if (!confirm(`Commission an oppo file on ${vname} for ✦${cost}? ${odds}% it lands (their donor confidence ${TUNE.oppoHit}); otherwise it blows back on your own base (${TUNE.oppoBlowback}).`)) return;
  G.influence -= cost;
  G.oppoUses = (G.oppoUses || 0) + 1;
  G.oppoMonth = W.month;
  const news = G.pendingNews = G.pendingNews || [];
  const me = G.name ? `${tank().short} (${G.name})` : tank().short;
  if (Math.random() < oppoOdds()) {
    rec().oppoHits = (rec().oppoHits || 0) + 1;
    if (r) { dentRival(r, 0, 'your oppo file', TUNE.oppoHit); swearVendetta(r, 'your oppo file', news); }
    else {
      withPlayer(victim, () => bumpConf(TUNE.oppoHit, `oppo file from ${me}`));
      victim.pendingNews = victim.pendingNews || [];
      victim.pendingNews.push({ h: `“TRANSPARENCY PROJECT” TARGETS ${tankOf(victim).short.toUpperCase()}`, s: `A well-designed report about you, funded by ${me}. Your donors are calling. Confidence ${TUNE.oppoHit}.` });
    }
    news.push({ h: `${vname.toUpperCase()} HAS A VERY BAD NEWS CYCLE`, s: `Your “transparency project” lands: three stories, one chart, a truly unkind graphic. Their donor confidence ${TUNE.oppoHit}.` });
    logLine(`OPPO: the file on ${vname} landed (✦${cost}). Their donor confidence ${TUNE.oppoHit}.`);
  } else {
    bumpConf(TUNE.oppoBlowback, `oppo file on ${vname} backfired`);
    if (r) swearVendetta(r, 'your oppo file', news);
    news.push({ h: `SMEAR BACKFIRES ON ${tank().short.toUpperCase()}`, s: `The reporter called ${vname} for comment, then called your donors. Confidence ${TUNE.oppoBlowback}.` });
    logLine(`OPPO: the file on ${vname} blew back (✦${cost}). Your donor confidence ${TUNE.oppoBlowback}.`);
  }
  save(); render();
}

function actCommit(fightIdx, sideIdx, amt) {
  const f = W.fights[fightIdx];
  if (!f) return;
  const side = f.sides[sideIdx];
  amt = Math.min(amt, G.influence);
  if (amt <= 0) return flash('No influence to spend. Scholars make it monthly.');
  const angry = angeredBy(f, side);
  const whimAngry = whimAngeredBy(f, side).filter(d => !angry.includes(d));
  if (angry.length || whimAngry.length) {
    const names = [...angry, ...whimAngry].map(d => d.name).join(', ');
    if (!confirm(`Backing “${side.label}” will anger: ${names} (+1 strike each). Proceed?`)) return;
    angry.forEach(d => {
      d.strikes++;
      f.crossed[d.id] = true;
      logLine(`${d.name} is displeased by your position on ${f.title}. (${d.strikes}/${TUNE.strikeLimit} strikes)`);
    });
    whimAngry.forEach(d => {
      d.strikes++;
      f.crossed['whim:' + d.id] = true;
      logLine(`${d.name}'s whim is offended by your position on ${f.title}. (${d.strikes}/${TUNE.strikeLimit} strikes)`);
    });
  }
  const cap = fightCap(f);
  if (cap) {
    f.monthUsed = f.monthUsed || {};
    const key = G.pid || 'me';
    const used = f.monthUsed[key] || 0;
    if (used >= cap) return flash(`The docket is full: a rulemaking takes at most ✦${cap} per institution per month. Come back next month.`);
    amt = Math.min(amt, cap - used);
    f.monthUsed[key] = used + amt;
  }
  G.influence -= amt;
  const eff = Math.round(amt * expertiseMult(f.tag));
  side.total += eff;
  addYours(side, eff);
  G.monthCommits = G.monthCommits || {};
  G.monthCommits[f.tag] = (G.monthCommits[f.tag] || 0) + eff;
  save(); render();
}

function flash(msg) { alert(msg); }

// ---------- crises ----------
const CRISIS_WHEN = {
  oped: () => G.scholars.length >= 1,
  feud: () => G.donors.some(d => d.lean > 0 && !d.lapsing) && G.donors.some(d => d.lean < 0 && !d.lapsing),
  meltdown: () => G.scholars.some(s => s.diva),
  shutdown: () => W.fights.length > 0 && !(W.freeze > 0),
  recess: () => W.fights.some(f => f.monthsLeft > 1),
  galafire: () => !!G.programs.gala,
  hack: () => G.ops.length >= 1,
  plagiarism: () => G.scholars.length >= 1,
  revolt: () => G.cash < 300,
  smear: () => true,
  center: () => G.donors.some(d => !d.lapsing) && G.cash > 250,
  union: () => G.ops.length >= 1,
  loudmouth: () => G.scholars.length >= 1 && activeDonors().length >= 1,
};

function offendedText(list) {
  if (!list.length) return 'nobody on your base is offended — standing by them is free';
  const cap = d => (d.renewals ? 1 : TUNE.strikeLimit);
  const walkers = list.filter(d => d.strikes >= cap(d) - 1);
  return `${list.map(d => d.name).join(', ')} take${list.length === 1 ? 's' : ''} a strike${walkers.length ? ` — ⚠ ${walkers.map(d => d.name).join(', ')} would walk` : ''}`;
}

function drawCrisis(news) {
  let pool = CRISES.filter(c => !c.scripted && !G.usedCrises.includes(c.id) && CRISIS_WHEN[c.id]());
  if (!pool.length) { G.usedCrises = []; pool = CRISES.filter(c => !c.scripted && CRISIS_WHEN[c.id]()); }
  if (!pool.length) return;
  const def = pick(pool);
  G.usedCrises.push(def.id);
  rec().crises++;
  sfx('crisis');
  const topSch = [...G.scholars].sort((x, y) => y.out - x.out)[0];
  const donorA = pick(G.donors.filter(d => d.lean > 0 && !d.lapsing)) || pick(G.donors.filter(d => !d.lapsing));
  const donorB = pick(G.donors.filter(d => d.lean < 0 && !d.lapsing));
  const c = {
    id: def.id,
    t: {
      scholar: G.scholars.length ? pick(G.scholars).id : null,
      top: topSch ? topSch.id : null,
      diva: (G.scholars.find(s => s.diva) || {}).id ?? null,
      ops: G.ops.length ? pick(G.ops).id : null,
      donor: donorA ? donorA.id : null,
      donorB: donorB ? donorB.id : null,
      rival: pick(W.rivals).short,
    },
  };
  const nameOf = (list, id, key) => { const x = list.find(v => v.id === id); return x ? x.name : '(someone)'; };
  c.n = {
    SCHOLAR: nameOf(G.scholars, c.t.scholar),
    TOP: nameOf(G.scholars, c.t.top),
    DIVA: nameOf(G.scholars, c.t.diva),
    OPS: nameOf(G.ops, c.t.ops),
    DONOR: nameOf(G.donors, c.t.donor),
    DONOR_B: nameOf(G.donors, c.t.donorB),
    RIVAL: c.t.rival,
  };
  // the op-eds card says exactly who'd be offended, so the choice is honest
  if (def.id === 'oped') {
    const s = G.scholars.find(x => x.id === c.t.scholar); const lean = s ? (s.lean || 0) : 0;
    const angry = lean !== 0 ? activeDonors().filter(d => d.lean * lean < 0) : shuffle(activeDonors()).slice(0, 2);
    c.t.offended = angry.map(d => d.id);
    c.n.OFFENDED = offendedText(angry);
  }
  // the loudmouth: prefer a scholar who's on air a lot, and a funder they'd offend
  if (def.id === 'loudmouth') {
    const media = G.scholars.filter(s => ['cable', 'feud', 'substack', 'book'].includes(quirkId(s)));
    const s = pick(media.length ? media : G.scholars);
    const pool = activeDonors();
    const opp = pool.filter(d => (s.lean || 0) !== 0 && d.lean * (s.lean || 0) < 0);
    const dn = pick(opp.length ? opp : pool);
    c.t.scholar = s.id; c.n.SCHOLAR = s.name;
    c.t.donor = dn.id; c.n.DONOR = dn.name;
    const cap = dn.renewals ? 1 : TUNE.strikeLimit;
    c.n.DONORWALK = dn.strikes >= cap - 1 ? ' — ⚠ they would walk' : '';
  }
  G.crisis = c;
  news.push({ h: `BUGLE EXTRA: ${crisisSub(def.title)}`, s: 'A decision is required before next month can begin.' });
  logLine(`CRISIS: ${crisisSub(def.title)} — decide before the next END MONTH.`);
}

function forceCrisis(id, news) {
  const def = CRISES.find(c => c.id === id);
  if (!def) return;
  const rival = pick(W.rivals).short;
  G.crisis = { id, t: { rival }, n: { RIVAL: rival } };
  if (id === 'endorse') {
    const sign = Math.sign(tank().align);
    const aisle = sign ? activeDonors().filter(d => d.lean * sign < 0) : shuffle(activeDonors()).slice(0, 2);
    const nervous = pick(activeDonors());
    const cap = d => (d.renewals ? 1 : TUNE.strikeLimit);
    G.crisis.t.aisle = aisle.map(d => d.id);
    G.crisis.t.nervous = nervous ? nervous.id : null;
    G.crisis.n.AISLE = offendedText(aisle);
    G.crisis.n.NERVOUS = nervous ? `${nervous.name} takes a strike${nervous.strikes >= cap(nervous) - 1 ? ' — ⚠ they would walk' : ''}` : 'no donor minds';
  }
  news.push({ h: `BUGLE EXTRA: ${def.title}`, s: 'A decision is required before next month can begin.' });
  logLine(`CRISIS: ${def.title} — decide before the next END MONTH.`);
  sfx('crisis');
}

function crisisSub(text) {
  if (!G.crisis) return text;
  return text.replace(/\{(SCHOLAR|TOP|DIVA|OPS|DONOR_B|DONORWALK|DONOR|RIVAL|OFFENDED|AISLE|NERVOUS)\}/g, (m, k) => G.crisis.n[k] || (k === 'DONORWALK' ? '' : '(someone)'));
}

const CRISIS_FX = {
  oped: [
    c => { const s = G.scholars.find(x => x.id === c.t.scholar); const lean = s ? (s.lean || 0) : 0;
      const angry = c.t.offended ? G.donors.filter(d => c.t.offended.includes(d.id))
        : lean !== 0 ? G.donors.filter(d => d.lean * lean < 0) : shuffle(G.donors).slice(0, 2);
      angry.forEach(d => d.strikes++);
      return `${angry.length} donor${angry.length === 1 ? '' : 's'} took a strike's worth of offense.`; },
    c => { G.scholars = G.scholars.filter(x => x.id !== c.t.scholar); return `${c.n.SCHOLAR} is gone by lunch.`; },
    () => 'By Friday, it never happened.',
  ],
  feud: [
    c => { G.donors = G.donors.filter(d => d.id !== c.t.donorB); return `${c.n.DONOR_B} walks.`; },
    c => { G.donors = G.donors.filter(d => d.id !== c.t.donor); return `${c.n.DONOR} walks.`; },
    () => 'The retreat featured trust falls. Both stay.',
  ],
  meltdown: [
    c => { G.scholars = G.scholars.filter(x => x.id !== c.t.diva); return `${c.n.DIVA} is escorted out mid-monologue.`; },
    () => 'The apology tour worked. For now.',
    c => { const others = [...G.scholars.filter(s => s.id !== c.t.diva), ...G.ops]; const gone = shuffle(others).slice(0, 2);
      gone.forEach(v => { if (v.kind === 'scholar') G.scholars = G.scholars.filter(x => x !== v); else G.ops = G.ops.filter(x => x !== v); });
      return gone.length ? `${gone.map(v => v.name).join(' and ')} quit by Friday.` : 'Somehow, nobody was left to quit.'; },
  ],
  shutdown: [
    () => { W.freeze = 1; return 'The Hill goes dark for a month.'; },
    () => { W.freeze = 1; G.influence += 20; return 'The Hill goes dark; your panels mint ✦20.'; },
  ],
  recess: [
    () => { W.fights.forEach(f => f.monthsLeft = Math.min(f.monthsLeft, 1)); return 'Everything resolves at the next END MONTH.'; },
    () => { W.fights.forEach(f => f.monthsLeft = Math.min(f.monthsLeft, 1)); G.influence += 15; return 'Everything resolves next month; the scramble mints ✦15.'; },
  ],
  galafire: [
    () => 'The lawyers bill hourly and win.',
    () => { G.programs.gala = false; return 'The gala is quietly cancelled. Its patrons will notice.'; },
  ],
  hack: [
    () => 'The database returns, along with a lesson nobody will implement.',
    c => { G.ops = G.ops.filter(o => o.id !== c.t.ops); G.influence = Math.max(0, G.influence - 15); return `${c.n.OPS} quits in the chaos; the scramble costs ✦15.`; },
  ],
  plagiarism: [
    c => { const s = G.scholars.find(x => x.id === c.t.top); if (s) s.out = Math.max(5, s.out - 5); return `${c.n.TOP}'s output drops 5, permanently.`; },
    () => 'The denial holds. The file closes.',
    c => { G.scholars = G.scholars.filter(x => x.id !== c.t.top); return `${c.n.TOP} departs for “new projects.”`; },
  ],
  revolt: [
    () => { const staff = [...G.scholars, ...G.ops].sort((x, y) => y.salary - x.salary)[0];
      if (staff) { if (staff.kind === 'scholar') G.scholars = G.scholars.filter(x => x !== staff); else G.ops = G.ops.filter(x => x !== staff); }
      G.cash += 60;
      return staff ? `${staff.name} is sacrificed to the slides; the board wires ${fmtMoney(60)}.` : `The board wires ${fmtMoney(60)}.`; },
    () => { G.cash += 100; return `The groveling lands: a ${fmtMoney(100)} bridge gift.`; },
  ],
  smear: [
    () => { W.fights.forEach(f => f.sides.forEach(s => { const cut = Math.ceil(yoursOf(s) * 0.2); addYours(s, -cut); s.total -= cut; })); return 'Your standing commitments erode 20% across the board.'; },
    c => { const r = W.rivals.find(x => x.short === c.t.rival); dentRival(r, 3, 'counter-oppo', -10); return `Counter-oppo lands: ${c.n.RIVAL}'s budget takes a permanent −3 and their donors get nervous.`; },
  ],
  center: [
    c => { const d = G.donors.find(x => x.id === c.t.donor); if (d) { d.grant += 30; d.term = (d.term || 18) + 6; } return `The ${c.n.DONOR} Center opens. The plaque is enormous; the grant grows ${fmtMoney(30)}/mo.`; },
    c => { const d = G.donors.find(x => x.id === c.t.donor); if (d) d.strikes++; return `${c.n.DONOR} takes offense.`; },
  ],
  endorse: [
    c => { G.influence += 40; const sign = Math.sign(tank().align);
      const angry = c.t.aisle ? G.donors.filter(d => c.t.aisle.includes(d.id))
        : sign ? G.donors.filter(d => d.lean * sign < 0 && !d.lapsing) : shuffle(activeDonors()).slice(0, 2);
      angry.forEach(d => d.strikes++);
      return `Your name is on the letter. ✦40 of relevance; ${angry.length} donor${angry.length === 1 ? '' : 's'} across the aisle took a strike.`; },
    c => { G.influence += 25; const d = (c.t.nervous && G.donors.find(x => x.id === c.t.nervous)) || pick(activeDonors()); if (d) d.strikes++;
      return `You backed the insurgent: ✦25, and ${d ? d.name : 'a donor'} is nervous about it.`; },
    () => { bumpConf(4, 'stayed above the primary'); return 'You stayed above it. The base approves; the campaigns forget you exist.'; },
  ],
  loudmouth: [
    c => { const s = G.scholars.find(x => x.id === c.t.scholar); if (s) s.mope = Math.max(s.mope || 0, 2);
      return `${c.n.SCHOLAR} reads a statement containing the word “if.” ${c.n.DONOR} accepts it, barely; the scholar sulks for two months.`; },
    c => { const d = G.donors.find(x => x.id === c.t.donor); if (d) d.strikes++;
      const s = G.scholars.find(x => x.id === c.t.scholar); if (s) s.out += 2;
      G.influence += 20; bumpConf(-3, `stood by ${c.n.SCHOLAR} against ${c.n.DONOR}`);
      return `You stand by ${c.n.SCHOLAR}. The clip mints ✦20 and a fan base; ${c.n.DONOR} takes offense, and the rest of the base notes who you chose.`; },
    c => { G.scholars = G.scholars.filter(x => x.id !== c.t.scholar); rec().scholarsLost++;
      const d = G.donors.find(x => x.id === c.t.donor); let grew = 0;
      if (d) { grew = Math.round(d.grant * 0.15); d.grant += grew; d.strikes = Math.max(0, d.strikes - 1); }
      bumpConf(TUNE.confFire, `let ${c.n.SCHOLAR} go to placate ${c.n.DONOR}`);
      return `${c.n.SCHOLAR} is gone by lunch. ${c.n.DONOR} sends flowers${grew ? ` and ${fmtMoney(grew)}/mo more` : ''}; the staff sends nothing.`; },
    c => { const d = G.donors.find(x => x.id === c.t.donor); if (d) d.strikes = Math.max(0, d.strikes - 1);
      if (Math.random() < 0.5 && drawDonorToMarket()) {
        const nd = G.donorMarket[G.donorMarket.length - 1]; nd.cost = Math.ceil(nd.cost / 2); nd.lead = true; delete nd.from; delete nd.fromPid;
        return `The dinner is tense, then fine. ${c.n.DONOR} stays — and ${nd.name}, who loved the clip, turns up in the donor market at half price.`;
      }
      return `The dinner is tense, then fine. ${c.n.DONOR} stays. Nobody new calls; the salmon was good.`; },
  ],
  union: [
    () => { G.ops.forEach(o => o.salary += 1); return 'The union is recognized. Every ops salary rises $1k/mo.'; },
    c => { const o = pick(G.ops); if (o) G.ops = G.ops.filter(x => x !== o); G.influence = Math.max(0, G.influence - 30); return `${o ? o.name : 'An ops staffer'} quits during the standoff.`; },
  ],
};

// crisis price tags grow with you: a comfortable shop pays comfortable money
function crisisCost(ch) {
  return {
    cash: ch.cash ? Math.max(ch.cash, Math.round(G.cash * TUNE.crisisCashPct)) : 0,
    inf: ch.inf ? Math.max(ch.inf, Math.round(production() * TUNE.crisisInfPct)) : 0,
  };
}

function actCrisis(idx) {
  const c = G.crisis;
  if (!c) return;
  const def = CRISES.find(x => x.id === c.id);
  const ch = def.choices[idx];
  if (!ch) return;
  const cost = crisisCost(ch);
  if (cost.cash > G.cash || cost.inf > G.influence) return flash('You can\'t afford that option right now.');
  G.cash -= cost.cash;
  G.influence -= cost.inf;
  const note = CRISIS_FX[c.id][idx](c);
  logLine(`CRISIS RESOLVED — ${crisisSub(def.title)}: “${crisisSub(ch.label)}.” ${note}`);
  G.crisis = null;
  save(); render();
}

function renderCrisis() {
  const win = $('#crisisWin');
  if (!G || !G.crisis) { win.classList.add('hidden'); return; }
  const def = CRISES.find(x => x.id === G.crisis.id);
  $('#crisisTitle').textContent = crisisSub(def.title);
  $('#crisisBody').innerHTML = `
    <div class="crisisbody">${crisisSub(def.body)}</div>
    ${def.choices.map((ch, i) => {
      const cc = crisisCost(ch);
      const cost = [cc.cash ? fmtMoney(cc.cash) : '', cc.inf ? `✦${cc.inf}` : ''].filter(Boolean).join(' + ');
      const short = cc.cash > G.cash || cc.inf > G.influence;
      return `<div class="crisischoice">
        <button class="btn" data-act="crisischoice" data-idx="${i}" ${short ? 'disabled' : ''}>${crisisSub(ch.label)}${cost ? ` (${cost})` : ''}</button>
        <span class="dim">${crisisSub(ch.hint)}</span>
      </div>`;
    }).join('')}`;
  win.classList.remove('hidden');
}

// ---------- rival AI ----------
function playerLeadsBoard() {
  const rows = standings();
  return rows[0].you && rows[0].v > 0 && (!rows[1] || rows[0].v > rows[1].v);
}

// Every rival is a budget with a personality. On Easy they sprinkle by fixed
// weights (the dice). From Medium up they think: price every fight by what it
// costs to reach target odds AND top credit, fund the cheapest victories, and
// bank the rest in a war chest whose patience is a matter of style.
function aiLevel() { return W && W.aiLevel !== undefined ? W.aiLevel : 1; }
function rivalAI(r) { return r.ai || DEFAULT_AI; }
function commitRival(r, f, sideIdx, amt) {
  const s = f.sides[sideIdx];
  const cap = fightCap(f);
  if (cap) {
    f.monthUsed = f.monthUsed || {};
    const used = f.monthUsed[r.short] || 0;
    amt = Math.min(amt, cap - used);
    if (amt <= 0) return;
    f.monthUsed[r.short] = used + amt;
  }
  // a bench of their own: rivals hit harder in their pet issues
  const eff = f.tag && r.tags.includes(f.tag) ? Math.round(amt * (1 + TUNE.rivalBenchBonus)) : amt;
  s.rivals = s.rivals || {};
  // thinking rivals don't split credit: a junior stake folds into the biggest
  // rival pile already on this side (two partners at most), so a human has to
  // beat the pool, not the largest fragment
  let name = r.short;
  if (aiLevel() >= TUNE.aiPoolLevel && rivalAI(r).style !== 'purist') {
    s.pool = s.pool || {};
    if (s.pool[r.short]) name = s.pool[r.short];
    else {
      const senior = Object.entries(s.rivals).filter(([k]) => k !== r.short && !s.pool[k]).sort((a, b) => b[1] - a[1])[0];
      const partners = senior ? Object.values(s.pool).filter(v => v === senior[0]).length : 0;
      if (senior && senior[1] >= (s.rivals[r.short] || 0) && partners < 1) {
        name = senior[0];
        s.pool[r.short] = name;
        if (s.rivals[r.short]) { s.rivals[name] += s.rivals[r.short]; delete s.rivals[r.short]; }
      }
    }
  }
  s.total += eff;
  s.rivals[name] = (s.rivals[name] || 0) + eff;
}
// a rival's stake on a side, counting a pool it folded into
function rivalStake(s, r) { return (s.rivals || {})[((s.pool || {})[r.short]) || r.short] || 0; }
// the biggest single backer of a side other than this rival (rivals or humans)
function sideTopOf(side, exceptShort) {
  const others = Object.entries(side.rivals || {}).filter(([k]) => k !== exceptShort).map(([, v]) => v);
  return Math.max(0, ...others, ...Object.values(side.players || {}));
}

// which side a rival takes in a fight, by style; -1 = sits it out
function rivalSideChoice(r, f, leaderRow) {
  const ai = rivalAI(r);
  const ft = fightType(f);
  // a hearing in their own name: they defend, whatever their politics
  if (f.targetRival === r.short) return 1;
  // statehouse fights: the federal-minded shops mostly can't be bothered
  if (ft.rivalSkip) {
    f.rivalSkips = f.rivalSkips || {};
    const skipP = f.type === 'STATE' ? TUNE.stateRivalSkip : ft.rivalSkip;
    if (f.rivalSkips[r.short] === undefined) f.rivalSkips[r.short] = Math.random() < skipP ? 1 : 0;
    if (f.rivalSkips[r.short] && !(rivalStake(f.sides[0], r) > 0 || rivalStake(f.sides[1], r) > 0)) return -1;
  }
  const pet = (!!f.tag && r.tags.includes(f.tag)) || !!ft.allPet;
  const pref = f.sides.findIndex(s => r.align === 0 ? s.lean === 0 : s.lean * r.align > 0);
  const thinking = aiLevel() > TUNE.aiDiceLevel;
  if (ai.style === 'purist' && thinking && !pet) return pref;   // never crosses, never dabbles
  let sideIdx = pref;
  if (sideIdx < 0 && thinking) {
    if (ai.style === 'dealmaker') sideIdx = f.sides[0].total >= f.sides[1].total ? 0 : 1;      // rides the favorite
    else if (ai.style === 'insurgent') sideIdx = f.sides[0].total <= f.sides[1].total ? 0 : 1; // hunts upsets
    else if (ai.style === 'mirror' && leaderRow && leaderRow.short !== r.short) {              // copies the leader
      const amtOn = s => leaderRow.human ? contribOf(s, leaderRow.pid || null) : ((s.rivals || {})[leaderRow.short] || 0);
      const a = amtOn(f.sides[0]), b = amtOn(f.sides[1]);
      if (a !== b) sideIdx = a > b ? 0 : 1;
    }
  }
  if (sideIdx < 0 && pet) {
    if (f.rivalPicks[r.short] === undefined) f.rivalPicks[r.short] = ri(0, 1);
    sideIdx = f.rivalPicks[r.short];
  }
  // off-issue fights: focused shops mostly sit out (decided once per fight);
  // a stake already placed is never abandoned
  if (sideIdx >= 0 && !pet) {
    f.rivalSkips = f.rivalSkips || {};
    if (f.rivalSkips[r.short] === undefined) f.rivalSkips[r.short] = Math.random() < TUNE.rivalFocus * (thinking ? 0.5 + ai.focus : 1) ? 1 : 0;
    if (f.rivalSkips[r.short] && !(rivalStake(f.sides[sideIdx], r) > 0)) sideIdx = -1;
  }
  return sideIdx;
}

// Easy: the sprinkler. Fixed weights, everything spent, no memory.
function rivalCommitsDice(r, budget, lead, hot, leaderRow) {
  const targets = [];
  W.fights.forEach(f => {
    const sideIdx = rivalSideChoice(r, f, leaderRow);
    if (sideIdx < 0) return;
    const pet = !!f.tag && r.tags.includes(f.tag);
    const closing = f.monthsLeft <= 1 ? TUNE.rivalCloserMult : f.monthsLeft === 2 ? 1.5 : 1;
    const opp = f.sides[1 - sideIdx];
    const oppTopRival = Math.max(0, ...Object.values(opp.rivals || {}));
    const leadAmt = lead ? contribOf(opp, lead.pid || null) : 0;
    const counter = hot && leadAmt > 0 && leadAmt >= oppTopRival ? TUNE.counterBidMult : 1;
    targets.push({ f, sideIdx, w: (pet ? 2 : 1) * closing * counter * (f.marquee ? 1.5 : 1) });
  });
  r.plan = {}; r.eyeing = [];
  if (!targets.length) return;
  const wSum = targets.reduce((a, t) => a + t.w, 0);
  targets.forEach(t => {
    const amt = Math.floor(budget * t.w / wSum);
    if (amt > 0) { commitRival(r, t.f, t.sideIdx, amt); r.plan[t.f.defId] = { side: t.sideIdx, amt, title: t.f.title }; }
  });
}

function rivalCommits() {
  const lead = humanLeader();
  const hot = !!lead;
  const rows = standings();
  const leaderRow = rows[0] && rows[0].v > 0 ? rows[0] : null;
  const drift = 1 + TUNE.rivalDriftPct * W.month;
  const seasonal = W.month >= TUNE.electionSeasonStart ? TUNE.electionSeasonMult : 1;
  const heat = hot ? TUNE.frontrunnerMult : 1;
  const level = aiLevel();
  // the town keeps up: no rival's income falls below a share of the best
  // human economy in the campaign (the share rises with difficulty)
  const topProd = Math.max(0, ...players().map(p => withPlayer(p, () => production())));
  const track = level === 0 ? TUNE.rivalTrackPct - TUNE.rivalTrackStep : TUNE.rivalTrackPct + (level - 1) * TUNE.rivalTrackStep;
  W.rivals.forEach(r => {
    const base = r.budget * drift * seasonal * heat * rivalConfMult(r);
    const tracked = topProd * track * seasonal * rivalConfMult(r);
    const income = Math.round(Math.max(base, tracked) * (0.85 + Math.random() * 0.3));
    r.income = income;
    r.tracking = tracked > base;
    if (level <= TUNE.aiDiceLevel) { rivalCommitsDice(r, Math.round(income * (0.9 + Math.random() * 0.2)), lead, hot, leaderRow); return; }
    const ai = rivalAI(r);
    r.chest = (r.chest || 0) + Math.round(income * (TUNE.aiIncomeByLevel[level] || 1));

    // what to deploy this month: impatient shops spend as it comes, patient
    // ones bank for closing months and election season — never past the vote,
    // and never beyond a few months' income
    let saveRate = ai.patience * (W.month >= TUNE.electionSeasonStart ? 0.3 : 0.7);
    if (W.month >= TUNE.electionMonth - 2 || r.chest > income * TUNE.aiChestMonths) saveRate = 0;
    let left = Math.floor(r.chest * (1 - saveRate));
    let reserve = r.chest - left;

    // price every fight: what it costs to reach target odds and be the top backer;
    // a rival sitting on a surplus aims higher and spreads wider — money should
    // become victories, not a monument
    const surplus = r.chest / Math.max(1, income);
    const t = Math.min(0.92, TUNE.aiTargetOdds + (ai.aggression - 1) * 0.1 + (level >= 3 ? 0.06 : 0) + Math.min(0.15, Math.max(0, surplus - 2) * 0.04));
    const plans = [];
    W.fights.forEach(f => {
      const sideIdx = rivalSideChoice(r, f, leaderRow);
      if (sideIdx < 0) return;
      const ratio = Math.pow(t / (1 - t), 1 / fightK(f));
      const s = f.sides[sideIdx], opp = f.sides[1 - sideIdx];
      const me = ((s.pool || {})[r.short]) || r.short;
      const mine = (s.rivals || {})[me] || 0;
      const topOther = sideTopOf(s, me);
      const closing = f.monthsLeft <= 1;
      const pad = Math.round(TUNE.aiBuffer * (closing ? 1.5 : f.monthsLeft) * seasonal);
      const forOdds = Math.max(0, Math.ceil((opp.total + pad) * ratio) - s.total);
      const forCredit = Math.max(0, topOther + Math.ceil(pad / 2) - mine);
      const need = Math.max(forOdds, forCredit, mine > 0 ? 0 : 5);
      const pet = (!!f.tag && r.tags.includes(f.tag)) || !!fightType(f).allPet || f.targetRival === r.short;
      const rw = fightReward(f);
      let value = (f.marquee ? 2 : 1) * (pet ? 1.3 : 1) * (f.targetRival === r.short ? 1.5 : 1) * (0.8 + Math.min(0.6, (rw.cash || 0) / 500));
      // grudges: appetite for sides the human leader tops, for a rival leader's
      // sides, and for anyone this rival has a vendetta against
      const leadAmt = lead ? contribOf(opp, lead.pid || null) : 0;
      const deny = level >= TUNE.aiDenyLevel && hot && leadAmt > 0 && leadAmt >= sideTopOf(opp, null);
      if (deny) value *= 1 + 0.4 * ai.grudge;
      if (leaderRow && !leaderRow.human && leaderRow.short !== r.short && ((opp.rivals || {})[leaderRow.short] || 0) > 0) value *= 1 + 0.25 * ai.grudge;
      if (players().some(p => (r.vendettas || {})[p.pid || 'me'] && contribOf(opp, p.pid || null) > 0)) value *= 1 + 0.3 * ai.grudge;
      const alreadyTop = mine > 0 && mine >= topOther;
      const timing = closing ? 1.4 : f.monthsLeft === 2 ? 1.1 : 0.75;
      plans.push({ f, sideIdx, need, value, closing, deny, stake: mine > 0, alreadyTop,
                   score: value * timing * (alreadyTop ? 1.25 : 1) / Math.max(4, need) });
    });
    plans.sort((a, b) => b.score - a.score);

    // fund the best few, by focus; lost causes wait, stakes get defended
    const maxFights = Math.max(1, Math.round(1 + (1 - ai.focus) * 3)) + (surplus > 3 ? 1 : 0);
    const cap = Math.max(10, Math.floor(r.chest * TUNE.aiMaxShare));
    let funded = 0;
    r.plan = {}; r.eyeing = [];
    for (const p of plans) {
      if (p.need === 0) continue;                                   // already where they want to be
      const capFor = p.deny ? r.chest : cap;                          // denying the leader credit is worth the whole chest
      if (funded >= maxFights || (p.need > capFor && !p.stake)) { r.eyeing.push({ title: p.f.title, side: p.sideIdx }); continue; }
      const pool = left + ((p.closing && p.stake) || p.deny ? reserve : 0);  // a closing stake (or a denial) may raid the reserve
      const amt = Math.min(p.need, p.stake || p.deny ? pool : Math.min(pool, capFor));
      if (amt < 3) { r.eyeing.push({ title: p.f.title, side: p.sideIdx }); continue; }
      commitRival(r, p.f, p.sideIdx, amt);
      if (amt > left) { reserve -= amt - left; left = 0; } else left -= amt;
      r.plan[p.f.defId] = { side: p.sideIdx, amt, title: p.f.title };
      funded++;
    }
    // press the advantage: whatever's left beyond a month or two of income
    // goes on top of the fights already funded, best first
    const keep = Math.round(income * (1 + ai.patience));
    let extra = Math.max(0, left - keep);
    const fundedPlans = plans.filter(p => r.plan[p.f.defId]);
    if (extra > 0 && fundedPlans.length) {
      const shares = fundedPlans.length === 1 ? [1] : fundedPlans.map((p, i) => i === 0 ? 0.6 : 0.4 / (fundedPlans.length - 1));
      fundedPlans.forEach((p, i) => { const add = Math.floor(extra * shares[i]); if (add > 0) { commitRival(r, p.f, p.sideIdx, add); r.plan[p.f.defId].amt += add; left -= add; } });
    }
    r.chest = left + reserve;
    r.eyeing = r.eyeing.slice(0, 2);
  });
}

// the town reads the rivals' books: hoarding and all-in months make the paper
function rivalTelegraphs(newsFor) {
  if (aiLevel() <= TUNE.aiDiceLevel) return;
  if (!W.trackNews && W.rivals.some(r => r.tracking)) {
    W.trackNews = true;
    newsAll(newsFor, { h: 'THE TOWN NOTICES: RIVAL FUNDRAISING SURGES', s: 'Somebody’s monthly output is the talk of every development office in Washington. From here on, rival war chests track the leading institution’s production — the bigger you build, the harder they raise.' });
  }
  if (aiLevel() < TUNE.aiPoolLevel) return;
  W.fights.forEach(f => f.sides.forEach(s => {
    if (!s.pool) return;
    f.poolNews = f.poolNews || {};
    Object.entries(s.pool).forEach(([junior, senior]) => {
      if (f.poolNews[junior] || Math.random() > 0.5) return;
      f.poolNews[junior] = true;
      newsAll(newsFor, { h: `${junior.toUpperCase()} FOLDS ITS MONEY INTO ${senior.toUpperCase()}’S PILE`, s: `Two development offices, one line item on “${f.title}.” Their stakes now count as one backer — beat the pool, not the fragment.` });
    });
  }));
  W.rivals.forEach(r => {
    const funded = Object.values(r.plan || {});
    const spent = funded.reduce((a, p) => a + p.amt, 0);
    const big = funded.find(p => p.amt >= 40 && p.amt >= spent * 0.6);
    if (big && r.allInNews !== big.title && Math.random() < 0.5) {
      r.allInNews = big.title;
      newsAll(newsFor, { h: `${r.short.toUpperCase()} GOES ALL-IN ON ${big.title.split(':')[0].toUpperCase()}`, s: `✦${big.amt} in a single month on “${big.title}.” ${r.short} has decided this is the one.` });
    } else if ((r.chest || 0) >= (r.income || 1) * 3 && (r.hoardNews === undefined || r.hoardNews <= W.month - 4) && Math.random() < 0.5) {
      r.hoardNews = W.month;
      newsAll(newsFor, { h: `${r.short.toUpperCase()} SITS ON A WAR CHEST`, s: `Roughly ✦${r.chest} banked and barely a pushpin moved. ${(AI_STYLES[rivalAI(r).style] || AI_STYLES.establishment).hoard}` });
    }
  });
}

// what the leaderboard tells you about a rival's mind
function rivalTip(r) {
  const ai = rivalAI(r), st = AI_STYLES[ai.style] || AI_STYLES.establishment;
  const parts = [`${st.label}: ${st.blurb}`];
  if (aiLevel() <= TUNE.aiDiceLevel) parts.push('rolls dice — fixed weights, no memory');
  else {
    parts.push(`war chest ✦${r.chest || 0} (income ~✦${r.income || Math.round(r.budget)}/mo)`);
    const funded = Object.values(r.plan || {}).map(p => `${p.title.split(':')[0]} ✦${p.amt}`);
    if (funded.length) parts.push(`this month: ${funded.join(', ')}`);
    if (r.eyeing && r.eyeing.length) parts.push(`eyeing: ${r.eyeing.map(e => e.title.split(':')[0]).join(', ')}`);
  }
  if (r.wants) parts.push(`hiring in ${r.wants} after losing there twice`);
  return parts.join(' · ');
}

// a Gov Relations Lead reads the rivals' intentions on the fight cards
function intelText(f, si) {
  if (aiLevel() <= TUNE.aiDiceLevel || !specCount('govrel')) return '';
  const names = W.rivals.filter(r => (r.eyeing || []).some(e => e.title === f.title && e.side === si)).map(r => `${r.short} (✦${r.chest || 0} banked)`);
  return names.length ? `<div class="pline dim intel" title="Your Gov Relations Lead hears things: these rivals are weighing this side for a future month.">👁 eyeing this side: ${names.join(', ')}</div>` : '';
}

// ---------- month end ----------
// ================= the month, in three phases =================
// world-pre: rivals commit, clocks tick, fights resolve, the town talks.
// player:    one institution's economy, staff, donors, crises, markets.
// world-post: the fight board refills, the calendar turns, the vote nears.
// Single-player runs all three in a row with W === G; the campaign server
// runs world-pre once, player for every human, then world-post.

function monthWorldPre(newsFor) {
  // 1. rivals pile on — and the town reads their books
  rivalCommits();
  rivalTelegraphs(newsFor);

  // 2. clocks tick; fights resolve (unless a shutdown froze the Hill)
  if (W.freeze > 0) {
    W.freeze--;
    newsAll(newsFor, { h: 'THE HILL IS DARK', s: 'Shutdown month: no clocks tick, nothing resolves. Everyone keeps piling money on regardless.' });
    logAll('Shutdown: fight clocks frozen this month.');
  } else {
    W.fights.forEach(f => f.monthsLeft--);
    W.fights.filter(f => f.monthsLeft <= 0).forEach(f => resolveFight(f, newsFor));
    W.fights = W.fights.filter(f => f.monthsLeft > 0);
  }
  W.fights.forEach(f => f.monthUsed = {});

  // 7.5 the leaderboard has a story: lead changes make the paper
  {
    const top = standings()[0];
    const leader = top.v > 0 ? top.short : null;
    if (leader && leader !== W.leaderShort) {
      if (top.human) newsAll(newsFor, { h: `${top.short.toUpperCase()}${top.pname ? ` (${top.pname.toUpperCase()})` : ''} TAKES THE LEAD`, s: `${top.v} victories banked. Enjoy it: the whole town now spends harder against the favorite.` });
      else newsAll(newsFor, { h: `${leader.toUpperCase()} SEIZES THE LEAD`, s: `${top.v} victories banked. Their press release uses the word “momentum” four times.` });
      logAll(`Leaderboard: ${leader} now leads with ${top.v}.`);
    }
    W.leaderShort = leader;
  }

  // 7.6 rivals do rival things — some of it moves their own donors
  if (Math.random() < 0.35) {
    const r = pick(W.rivals), mv = pick(RIVAL_MOVES);
    if (mv.conf) bumpRivalConf(r, mv.conf);
    newsAll(newsFor, { h: mv.h.replace('{RIVAL}', r.short.toUpperCase()), s: mv.s.replace('{RIVAL}', r.short) + (mv.conf ? ` (Their donor confidence ${mv.conf > 0 ? '+' : ''}${mv.conf}.)` : '') });
  }
  // 7.7 rival donor confidence drifts home
  W.rivals.forEach(r => { const c = rivalConf(r); if (c < TUNE.confStart) bumpRivalConf(r, Math.min(TUNE.confDrift, TUNE.confStart - c)); else if (c > TUNE.confStart) bumpRivalConf(r, -1); });

}

function monthPlayer(news) {
  G.stats.months++;

  // 3. scholars produce influence
  const prod = production();
  G.influence += prod;

  // 4. donors pay
  const grants = monthlyGrants();
  G.cash += grants;
  G.donors.forEach(d => d.paid = (d.paid || 0) + d.grant);

  // 4.5 grant cycles sunset — one month of grace to renew on stricter terms
  const gone = [];
  G.donors.forEach(d => {
    if (d.lapsing) {
      gone.push(d); // grace month passed unanswered
      bumpConf(TUNE.confLapse, `${d.name} lapsed`);
      news.push({ h: `${d.name.toUpperCase()} MOVES ON`, s: `The renewal window closed. ${fmtMoney(d.grant)}/mo departs with a warm note and a colder mailing-list removal.` });
      logLine(`${d.name} lapsed — no renewal. ${fmtMoney(d.grant)}/mo gone.`);
      G.donorDeck.unshift(d.id);
    } else if (d.term !== undefined && W.month - d.joined >= d.term - 1) {
      d.lapsing = true;
      news.push({ h: `${d.name.toUpperCase()} GRANT CYCLE ENDING`, s: `Renew within the month — on stricter terms, for ✦${renewCost(d)} — or the ${fmtMoney(d.grant)}/mo sunsets.` });
      logLine(`${d.name}'s cycle is ending: renew (stricter terms) or let it lapse.`);
    }
  });
  G.donors = G.donors.filter(d => !gone.includes(d));

  // 4.6 the whales: compounding money, tightening circle, new whims
  whaleMonth(news);

  // 4.7 fickle donors sometimes gut their own grant
  G.donors.filter(d => d.flaw === 'fickle' && !d.lapsing).forEach(d => {
    if (Math.random() < 0.15) {
      const cut = Math.round(d.grant / 3);
      d.grant -= cut;
      news.push({ h: `${d.name.toUpperCase()} REVISES ITS “GIVING PRIORITIES”`, s: `Their monthly grant drops ${fmtMoney(cut)} to ${fmtMoney(d.grant)}. No reason given; none ever is.` });
      logLine(`${d.name} (fickle) cut its own grant by ${fmtMoney(cut)}.`);
    }
  });

  // 5. donor demands checked (renewed donors tolerate only one strike;
  //    lapsing donors are already out the door and don't bother striking)
  const strikeCap = d => (d.renewals ? 1 : TUNE.strikeLimit);
  G.donors.forEach(d => {
    if (d.lapsing) return;
    if (!demandMet(d)) {
      d.strikes++;
      logLine(`${d.name}: demand unmet (${demandText(d)}). Strike ${d.strikes}/${strikeCap(d)}.`);
    }
  });
  const leaving = G.donors.filter(d => !d.lapsing && d.strikes >= strikeCap(d));
  leaving.forEach(d => {
    news.push({ h: `${d.name.toUpperCase()} PULLS FUNDING`, s: `“We wish the institution well,” says statement that does not wish the institution well. ${fmtMoney(d.grant)}/mo, gone.` });
    logLine(`${d.name} walks. ${fmtMoney(d.grant)}/mo, gone.`);
    bumpConf(d.whale ? TUNE.whaleWalkConf : TUNE.confWalk, `${d.name} walked${d.whale ? ' (the whale)' : ''}`);
    rec().donorsLost++;
  });
  G.donors = G.donors.filter(d => d.strikes < TUNE.strikeLimit);

  // 5.5 donor confidence: drift, stewardship, and a shaky base biting back
  confidenceMonth(news);
  { const R = rec(); R.minConf = Math.min(R.minConf, G.confidence); if (playerLeadsBoard()) R.monthsLed++; }

  // 6. pay the bills
  const costs = monthlyCosts();
  G.cash -= costs;

  // 6.4 scholars do things: quirks with teeth, and the revolving door
  scholarMonth(news);
  G.scholars.filter(s => s.tapped && s.tapped.deadline <= W.month).forEach(s => serveInGovernment(s, news));
  revolvingDoor(news);

  // 6.45 moping fades a notch each month
  G.scholars.forEach(s => { if (s.mope > 0) s.mope--; });

  // 6.5 unsupported scholars lose patience (paid this month, then they quit)
  const cap = supportCap();
  const quitting = [];
  G.scholars.forEach((s, i) => {
    if (i < cap) { s.strikes = 0; return; }
    s.strikes = (s.strikes || 0) + 1;
    if (s.strikes >= TUNE.scholarStrikeLimit) quitting.push(s);
    else logLine(`${s.name} has no ops support and is grumbling (${s.strikes}/${TUNE.scholarStrikeLimit}).`);
  });
  if (quitting.length) {
    G.scholars = G.scholars.filter(s => !quitting.includes(s));
    quitting.forEach(s => {
      news.push({ h: `${s.name.toUpperCase()} QUITS, CITING “LACK OF INSTITUTIONAL SUPPORT”`, s: 'Storms out of a building they were never given keys to. Effective immediately.' });
      logLine(`${s.name} quits — ${TUNE.scholarStrikeLimit} straight months without ops support.`);
      rec().scholarsLost++;
    });
  }

  // 6.52 divas drive colleagues out
  G.scholars.filter(s => s.diva).forEach(diva => {
    if (Math.random() >= TUNE.divaQuitChance) return;
    const others = [...G.scholars.filter(s => s !== diva), ...G.ops];
    if (!others.length) return;
    const v = pick(others);
    if (v.kind === 'scholar') G.scholars = G.scholars.filter(x => x !== v);
    else G.ops = G.ops.filter(x => x !== v);
    news.push({ h: `${v.name.toUpperCase()} RESIGNS, CITING “CREATIVE DIFFERENCES” WITH ${diva.name.toUpperCase()}`, s: 'Colleagues describe the difference as “one of them is impossible.” The impossible one stays.' });
    logLine(`${v.name} quit over ${diva.name}. The diva's output remains excellent.`);
  });

  // 6.53 junior fellows pipeline: every few months a cohort resolves — usually a
  // junior in the focus issue, sometimes nobody, occasionally a star or a stray
  if (G.programs.fellows) {
    G.progMonths = G.progMonths || {};
    G.progMonths.fellows = (G.progMonths.fellows || 0) + 1;
    if (G.progMonths.fellows % TUNE.fellowsEvery === 0) {
      const focus = G.progFocus || weakestTag();
      const roll = Math.random();
      if (roll < 0.2) {
        news.push({ h: 'JUNIOR FELLOWS COHORT PRODUCES NO ONE', s: `Four Tylers went to law school. The ${focus} pipeline runs dry this cycle; the program grinds on.` });
        logLine(`Junior Fellows: the ${focus} cohort washed out.`);
      } else {
        const star = roll >= 0.85, stray = roll >= 0.75 && roll < 0.85;
        const jr = genScholar(true);
        jr.tag = stray ? pick(TAGS.filter(t => t !== focus)) : focus;
        jr.lean = Math.sign(tank().align) || 0; jr.big = false; jr.diva = false;
        jr.salary = star ? ri(14, 18) : ri(10, 14);
        jr.out = star ? ri(15, 19) : ri(8, 12);
        jr.quirk = star ? 'Was, until recently, an intern. Now terrifying.' : 'Was, until recently, named Tyler.';
        G.scholars.push(jr);
        news.push({ h: star ? `JUNIOR FELLOW ${jr.name.toUpperCase()} IS, IT TURNS OUT, BRILLIANT` : `JUNIOR FELLOW ${jr.name.toUpperCase()} PROMOTED TO ACTUAL SCHOLAR`,
          s: `${TAG_NAMES[jr.tag]}${stray ? ' — not the focus, but talent is talent' : ''}: ✦${jr.out}/mo at ${fmtMoney(jr.salary)}/mo. Grown in-house.` });
        logLine(`Junior Fellows graduates ${jr.name} (${TAG_NAMES[jr.tag]}${star ? ', a star' : ''}).`);
      }
    }
  }

  // 6.55 unresolved poach bids: the scholar takes the offer
  G.scholars.filter(s => s.poach && s.poach.deadline <= W.month).forEach(s => {
    const r = W.rivals.find(x => x.short === s.poach.by);
    if (r) r.budget += TUNE.poachRivalGain;
    G.scholars = G.scholars.filter(x => x !== s);
    news.push({ h: `${s.name.toUpperCase()} DEFECTS TO ${s.poach.by.toUpperCase()}`, s: `The offer sat unanswered. Their new business cards are already printed.` });
    logLine(`${s.name} defected to ${s.poach.by} — the bid went unmatched.`);
  });

  // 6.56 a rival makes a run at one of your scholars (grudges make it a habit)
  const grudges = W.rivals.filter(r => vendettaAgainstMe(r));
  if (G.scholars.length >= 2 && !G.scholars.some(s => s.poach) && Math.random() < TUNE.poachChance * (grudges.length ? TUNE.vendettaMult : 1)) {
    const rival = grudges.length ? pick(grudges) : pick(W.rivals);
    const pool = [...G.scholars].sort((a, b) => b.out - a.out);
    // with aim: the scholar that hurts them most — your best in the field they
    // keep losing, else in one of their own issues
    const wantTag = aiLevel() >= 2 ? [rival.wants, ...rival.tags].find(t => t && pool.some(s => s.tag === t)) : null;
    const target = wantTag ? pool.find(s => s.tag === wantTag) : pick(pool.slice(0, 3));
    const offer = Math.ceil(target.salary * (1 + ri(25, 40) / 100));
    target.poach = { by: rival.short, salary: offer, deadline: W.month + 1 };
    news.push({ h: `${rival.short.toUpperCase()} MAKES A RUN AT ${target.name.toUpperCase()}`, s: `They're offering ${fmtMoney(offer)}/mo (currently ${fmtMoney(target.salary)}). Match it from the staff panel, or lose them next month.` });
    logLine(`${rival.short} is courting ${target.name} at ${fmtMoney(offer)}/mo — match or let them walk.`);
  }

  // 6.57 unresolved donor bids: the donor takes the other offer
  G.donors.filter(d => d.poach && d.poach.deadline <= W.month).forEach(d => donorDefects(d, news));

  // 6.58 a rival makes a run at one of your donors
  {
    const pool = activeDonors().filter(d => !d.poach);
    if (pool.length >= 2 && !G.donors.some(d => d.poach) && Math.random() < TUNE.donorPoachChance * (grudges.length ? TUNE.vendettaMult : 1)) {
      const rival = grudges.length ? pick(grudges) : pick(W.rivals);
      const weak = pool.filter(d => d.strikes > 0 || !demandMet(d) || d.flaw === 'fickle');
      // with aim: the wobbly donor who'd fit their shop best
      const fits = aiLevel() >= 2 ? weak.filter(d => (d.demand.tag && rival.tags.includes(d.demand.tag)) || d.lean * rival.align > 0) : [];
      const target = fits.length ? pick(fits) : weak.length ? pick(weak) : [...pool].sort((a, b) => b.grant - a.grant)[0];
      target.poach = { by: rival.short, deadline: W.month + 1, cost: recultivateCost(target) };
      news.push({ h: `${rival.short.toUpperCase()} COURTS ${target.name.toUpperCase()}`, s: `A dinner, a deck, a naming opportunity. Re-cultivate them for ✦${target.poach.cost} from the donor panel this month, or the ${fmtMoney(target.grant)}/mo follows the flattery.` });
      logLine(`${rival.short} is courting ${target.name} — re-cultivate (✦${target.poach.cost}) or lose them next month.`);
    }
  }

  // 6.59 ops bids: only a rival with a grudge bothers with your support staff
  G.ops.filter(o => o.poach && o.poach.deadline <= W.month).forEach(o => {
    G.ops = G.ops.filter(x => x !== o);
    news.push({ h: `${o.name.toUpperCase()} DEFECTS TO ${o.poach.by.toUpperCase()}`, s: 'The offer sat unanswered. Someone else now knows where the projector cable lives.' });
    logLine(`${o.name} left for ${o.poach.by} — the bid went unmatched.`);
  });
  if (grudges.length && G.ops.length >= 1 && !G.ops.some(o => o.poach) && Math.random() < TUNE.opsPoachChance * grudges.length) {
    const rival = pick(grudges);
    const target = pick(G.ops.filter(o => o.spec || (o.supports === undefined ? TUNE.supportRatio : o.supports) >= 2)) || pick(G.ops);
    const offer = Math.ceil(target.salary * (1 + ri(20, 35) / 100));
    target.poach = { by: rival.short, salary: offer, deadline: W.month + 1 };
    news.push({ h: `${rival.short.toUpperCase()} MAKES A RUN AT ${target.name.toUpperCase()}`, s: `The vendetta reaches the ops floor: ${fmtMoney(offer)}/mo (now ${fmtMoney(target.salary)}). Match it from the staff panel, or lose them next month.` });
    logLine(`${rival.short} is courting ${target.name} (ops) at ${fmtMoney(offer)}/mo — match or let them walk.`);
  }

  // 6.62 whisper campaigns: a rival with a grudge works your donors' phones
  grudges.forEach(r => {
    if (Math.random() >= TUNE.whisperChance) return;
    const shielded = commsShield();
    const hit = shielded ? Math.ceil(TUNE.whisperHit / 2) : TUNE.whisperHit;
    bumpConf(hit, `whisper campaign by ${r.short}`);
    news.push({ h: `${r.short.toUpperCase()} WHISPERS TO YOUR DONORS`, s: `“Have you seen their numbers?” Donor confidence ${hit}${shielded ? ' — your comms shop got ahead of it' : '; a comms desk would have halved it'}.` });
    logLine(`${r.short}'s whisper campaign: confidence ${hit}.`);
  });

  // 6.6 annual reviews: every December, payroll ratchets up
  if ((W.month + 1) % 12 === 0) {
    [...G.scholars, ...G.ops].forEach(p => p.salary = Math.ceil(p.salary * (1 + TUNE.annualRaisePct)));
    news.push({ h: 'ANNUAL REVIEWS CONCLUDE; EVERYONE REMAINS UNDERPAID', s: `Across-the-board raises land: payroll up ${Math.round(TUNE.annualRaisePct * 100)}%. The interns split a pizza.` });
  }

  // 7. solvency
  if (G.cash < 0) {
    G.negStreak++;
    if (G.negStreak >= 2) { gameOver(news); return; }
    news.push({ h: `${tank().short.toUpperCase()} MISSES PAYROLL`, s: 'The board circulates a resume template. One more month in the red and the doors close.' });
  } else {
    G.negStreak = 0;
  }

  // 8. refresh this institution's markets
  if (G.hireMarket.length) G.hireMarket.shift();
  while (G.hireMarket.length < TUNE.hireSlots) drawHire();
  if (Math.random() < 0.4 && G.donorMarket.length) {
    const gone = G.donorMarket.shift();
    G.donorDeck.unshift(gone.id);
  }
  while (G.donorMarket.length < TUNE.donorSlots && drawDonorToMarket()) {}

  // 8.4 chaotic ops roll their attendance for the coming month
  rollChaos();

  // 8.5 a crisis may land (never two at once)
  if (!G.crisis && Math.random() < TUNE.crisisChance) drawCrisis(news);

  // 9. slow news day? the three branches never disappoint
  if (Math.random() < TUNE.flavorChance) {
    shuffle(FLAVOR_NEWS).slice(0, Math.random() < 0.4 ? 2 : 1)
      .forEach(p => news.push({ h: p.h, s: p.s }));
  }

  G.monthCommits = {}; // engagement ledger resets after demands were judged
  G.stats.peakCash = Math.max(G.stats.peakCash, G.cash);
}

// returns true when the campaign ended (Election Night)
function monthWorldPost(newsFor) {
  // the fight board refills — unless August emptied the town
  const nextEvent = calendarOf(W.month + 1);
  if (nextEvent === 'august') {
    newsAll(newsFor, { h: 'AUGUST RECESS: THE TOWN EMPTIES', s: 'No new fights reach the board this month. Everyone who matters is at a beach house with a donor — courting runs 20% cheaper.' });
    logAll('August recess: no new fights; courting −20% this month.');
  } else {
    while (W.fights.length < TUNE.fightSlots) drawFight();
  }

  W.month++;
  if (W.month >= TUNE.electionMonth) {
    players().forEach(P => withPlayer(P, () => { if (!G.electionResult) electionDay(newsFor(P)); }));
    return true;
  }
  if (W.month === TUNE.electionSeasonStart) {
    const item = { h: 'ELECTION SEASON BEGINS — SIX MONTHS TO THE VOTE', s: `Every institution in town opens its war chest: rival influence spending runs ${Math.round((TUNE.electionSeasonMult - 1) * 100)}% hotter from here to Election Night. Fights get louder, credit gets pricier, and the leaderboard is watching. Plan accordingly.`, big: true };
    players().forEach(p => newsFor(p).unshift(item));
    logAll('ELECTION SEASON: rival spending +50% until the vote.');
    sfx('season');
  }
  // the calendar turns
  const evt = calendarOf(W.month);
  if (evt === 'sotu') { const tmp = []; drawMarqueeFight(tmp); tmp.forEach(i => newsAll(newsFor, i)); }
  if (evt === 'offyear') {
    const rows = standings().slice(0, 3).map((r, i) => `${i + 1}. ${r.short}${r.pname ? ` (${r.pname})` : ''} — ${r.v}`).join('  ·  ');
    newsAll(newsFor, { h: 'ONE YEAR OUT: THE STANDINGS', s: `Off-year elections come and go; the town checks the only scoreboard it cares about. ${rows}.` });
  }
  if (evt === 'primaries') players().forEach(P => withPlayer(P, () => { if (!G.crisis && !G.over) forceCrisis('endorse', newsFor(P)); }));
  return false;
}

function endMonth() {
  if (G.over) return;
  if (G.crisis) { flash('The Bugle EXTRA is waiting — resolve the crisis first.'); renderCrisis(); return; }
  if (typeof NET !== 'undefined' && NET.active) { netEndMonth(); return; }
  const news = [...(G.pendingNews || [])];
  G.pendingNews = [];
  const newsFor = () => news;
  monthWorldPre(newsFor);
  monthPlayer(news);
  if (G.over) return;                    // folded: the obituary already printed
  if (monthWorldPost(newsFor)) return;   // Election Night handled the finale
  save(); render();
  if (news.length) showPaper(news);
}
function resolveFight(f, newsFor) {
  const [a, b] = f.sides;
  const pA = Math.round(winProbA(f) * 100);
  const roll = ri(1, 100);
  const winner = roll <= pA ? a : b;
  const loser = winner === a ? b : a;
  const winProb = winner === a ? pA : 100 - pA;
  const upset = winProb < 35;
  const meter = {
    pA, roll,
    aLabel: a.label.split(':')[0], bLabel: b.label.split(':')[0],
    winLabel: winner.label.split(':')[0],
  };
  const baseSub = `“${winner.label}” prevails ${winner.total}–${loser.total} — a ${winProb}% shot${upset ? ', and the town is stunned' : ''}.`;

  // the victory is banked by whoever carried the winning side hardest —
  // a rival institution or one of the humans (ties go to the humans)
  let topRival = null, topAmt = 0;
  Object.entries(winner.rivals || {}).forEach(([short, amt]) => {
    if (amt > topAmt) { topAmt = amt; topRival = short; }
  });
  const hc = humanContribs(winner);
  const topHuman = hc[0] && hc[0].amt >= topAmt ? hc[0].p : null;
  if (topHuman) {
    withPlayer(topHuman, () => {
      G.stats.won++;
      bumpConf(TUNE.confWin, `banked ${f.title.split(':')[0].slice(0, 28)}`);
      const R = rec(); R.wonByTag[f.tag] = (R.wonByTag[f.tag] || 0) + 1;
      if (!R.bestUpset || winProb < R.bestUpset.prob) R.bestUpset = { title: f.title, prob: winProb };
    });
  } else if (topRival) {
    const r = W.rivals.find(x => x.short === topRival);
    if (r) { r.victories = (r.victories || 0) + 1; r.vByTag = r.vByTag || {}; r.vByTag[f.tag] = (r.vByTag[f.tag] || 0) + 1; bumpRivalConf(r, TUNE.rivalConfWin); }
  }
  // a hearing in a rival's name: the probe side winning rattles their donors
  if (f.targetRival && winner === f.sides[0]) {
    const r = W.rivals.find(x => x.short === f.targetRival);
    if (r) {
      bumpRivalConf(r, -10);
      r.dents = r.dents || []; r.dents.push({ n: 0, conf: -10, why: `the ${f.title.split(':')[0].toLowerCase()}`, m: W.month });
      newsAll(newsFor, { h: `${r.short.toUpperCase()} HAULED BEFORE THE COMMITTEE`, s: `The probe finds “irregularities,” a word that does a lot of work. ${r.short}'s donors are calling. Their confidence −10.` });
    }
  }
  // rivals who carried a third or more of the losing pile feel it at home
  Object.entries(loser.rivals || {}).forEach(([short, amt]) => {
    if (loser.total > 0 && amt >= loser.total * 0.3) {
      const r = W.rivals.find(x => x.short === short);
      if (!r) return;
      bumpRivalConf(r, TUNE.rivalConfLoss);
      r.lostByTag = r.lostByTag || {};
      r.lostByTag[f.tag] = (r.lostByTag[f.tag] || 0) + 1;
      if (aiLevel() >= 2 && f.tag && r.lostByTag[f.tag] >= 2) {
        if (!r.tags.includes(f.tag) && r.tags.length < 4) {
          r.tags.push(f.tag); r.lostByTag[f.tag] = 0;
          newsAll(newsFor, { h: `${r.short.toUpperCase()} ADDS ${f.tag} TO ITS PORTFOLIO`, s: `Two losses in ${TAG_NAMES[f.tag]} and one strategy memo later, ${r.short} is staffing up in the field. Expect them in every ${f.tag} fight from here.` });
        } else r.wants = f.tag;   // hire into it — off someone else's bench
      }
    }
  });
  const creditName = topHuman ? (topHuman.name ? `${tankOf(topHuman).short} (${topHuman.name})` : tankOf(topHuman).short) : topRival;

  players().forEach(P => withPlayer(P, () => {
    const news = newsFor(P);
    const mine = yoursOf(winner), lost = yoursOf(loser);
    const banks = topHuman === P;
    const creditLine = banks ? `${tank().short} banks the victory.`
      : creditName ? `${creditName} banks the victory.` : 'Nobody in particular claims it.';
    let sub = baseSub;
    if (lost > 0) {
      const R = rec();
      const lp = 100 - winProb; // odds the losing side (yours) had
      if (lp >= 75) R.favoredLosses++;
      if (!R.worstBeat || lp > R.worstBeat.prob) R.worstBeat = { title: f.title, prob: lp };
    }
    if (mine > 0) {
      G.scholars.forEach(s => { if (s.tag === f.tag && s.mope > 0) { s.mope = 0; logLine(`${s.name} is buoyed by the ${f.tag} win — morale restored.`); } });
      const share = winner.total > 0 ? mine / winner.total : 1;
      { const RR = rec(); RR.wins = RR.wins || []; RR.wins.push({ id: f.defId, title: f.title, share: Math.round(share * 100), prob: winProb, banks }); }
    const R = fightReward(f);
    const gains = [];
    if (R.cash) { const pay = Math.round(R.cash * share); G.cash += pay; gains.push(fmtMoney(pay)); }
    if (R.inf) { const gain = Math.round(R.inf * share); G.influence += gain; gains.push(`✦${gain} of clout`); }
    if (R.special === 'scholar') {
      const sch = genScholar(false);
      G.scholars.push(sch);
      gains.push(`${sch.name} (${TAG_NAMES[sch.tag]}) joins the roster, gratis`);
    } else if (R.special === 'donorlead') {
      if (drawDonorToMarket()) {
        const d = G.donorMarket[G.donorMarket.length - 1];
        d.cost = Math.ceil(d.cost / 2);
        d.lead = true;
        gains.push(`a warm intro: ${d.name} appears in the donor market at half price`);
      } else {
        gains.push('a promise that “our people will call your people”');
      }
    } else if (R.special === 'absolve') {
      G.donors.forEach(d => d.strikes = Math.max(0, d.strikes - 1));
      gains.push('a grateful town forgets old grudges (all donor strikes −1)');
    } else if (R.special === 'ally') {
      G.allies = G.allies || {};
      G.allies[f.tag] = Math.min(3, (G.allies[f.tag] || 0) + 1);
      gains.push(`a friend on the bench: +${Math.round(TUNE.allyBonus * 100)}% on your ${f.tag} commits, permanently`);
    }
      sub += ` ${creditLine} The spoils: ${gains.join('; ')}.`;
      news.push({ h: `${upset ? 'UPSET: ' : ''}${f.title.toUpperCase()}${banks ? ` — VICTORY FOR ${tank().short.toUpperCase()}` : ' — RESOLVED'}`, s: sub, big: banks, meter });
      logLine(`${banks ? 'VICTORY BANKED' : 'Backed the winner'}: ${f.title} → ${gains.join('; ')} (${Math.round(share * 100)}% of the winning side).`);
    } else if (lost > 0) {
      G.stats.lost++;
      { const RR = rec(); RR.losses = RR.losses || []; RR.losses.push({ id: f.defId, title: f.title, lost, prob: 100 - winProb }); }
    // morale: a contested loss deflates the matching bench; a repeat loss
    // while they're already moping sends some packing
    const bench = G.scholars.filter(s => s.tag === f.tag);
    if (!bench.length && G.scholars.length) {
      rec().noBench++;
      // you picked a fight in a field you know nothing about, and lost:
      // the whole building is embarrassed
      G.scholars.forEach(s => s.mope = Math.max(s.mope || 0, TUNE.moraleMonths));
      news.push({ h: `AMATEUR HOUR AT ${tank().short.toUpperCase()}`, s: `You contested a ${f.tag} fight with no ${f.tag} scholars on staff — and lost. The entire roster is demoralized (−${Math.round((1 - TUNE.moraleMult) * 100)}% output, ${TUNE.moraleMonths} months).` });
      logLine(`No-bench ${f.tag} loss: the WHOLE roster is demoralized. Stay in your lane, or staff up before wandering.`);
    }
    const quitters = [];
    bench.forEach(s => {
      if (s.mope > 0 && Math.random() < TUNE.moraleQuitChance) quitters.push(s);
      else s.mope = TUNE.moraleMonths;
    });
    quitters.forEach(s => {
      G.scholars = G.scholars.filter(x => x !== s);
      news.push({ h: `${s.name.toUpperCase()} LEAVES FOR GREENER PASTURES`, s: `The ${f.tag} losses, they say, “weren't why.” They were why.` });
      logLine(`${s.name} quit after another ${f.tag} defeat — morale matters.`);
    });
    if (bench.length > quitters.length) logLine(`Your ${f.tag} bench is demoralized: output −${Math.round((1 - TUNE.moraleMult) * 100)}% for ${TUNE.moraleMonths} months (a ${f.tag} win snaps them out of it).`);
      const refund = fightType(f).refund ? Math.round(lost * fightType(f).refund) : 0;
      if (refund) G.influence += refund;
      sub += ` ${creditLine} ${tank().short} spent ${lost} influence on the losing side${refund ? ` — riders get traded: ✦${refund} comes back` : ''}. A fellow calls it “directionally correct.”`;
      news.push({ h: `${upset ? 'UPSET: ' : ''}${f.title.toUpperCase()} — RESOLVED`, s: sub, meter });
      logLine(`LOSS: ${f.title}. ${lost} influence down the drain.`);
    } else {
      news.push({ h: `${upset ? 'UPSET: ' : ''}${f.title.toUpperCase()} — RESOLVED`, s: `${sub} ${creditLine} You watched from the sidelines.`, meter });
      logLine(`${f.title} resolved without you. ${creditLine}`);
    }
  }));
}
function rec() { G.recap = G.recap || { wonByTag: {}, donorsLost: 0, scholarsLost: 0, crises: 0, monthsLed: 0, noBench: 0, testimonies: 0, testimonyWins: 0, favoredLosses: 0, minConf: 100 }; return G.recap; }

function standings() {
  const rows = players().map(p => {
    const t = tankOf(p);
    const you = p === G || (!!G && !!G.pid && p.pid === G.pid);
    return { short: t.short, name: t.name, pname: p.name || null, pid: p.pid || null, human: true,
             v: p.stats ? p.stats.won : (p.v || 0), you, align: t.align,
             conf: p.confidence !== undefined ? p.confidence : (p.conf === undefined ? null : p.conf) };
  });
  W.rivals.forEach(r => rows.push({ short: r.short, name: r.name, v: r.victories || 0, you: false, human: false, align: r.align }));
  rows.sort((x, y) => y.v - x.v || (x.you ? -1 : y.you ? 1 : 0)); // you win ties
  return rows;
}

function recapItems(rows, rank, win) {
  const R = rec();
  const items = [];
  const tagsLine = Object.entries(R.wonByTag).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(' · ') || 'none';
  items.push({ h: 'THE CAMPAIGN IN NUMBERS', s: `${G.stats.won} victories banked (${tagsLine}) · ${G.stats.lost} contested losses · led the board ${R.monthsLed} of ${TUNE.electionMonth} months · ${R.crises} crises · ${R.donorsLost} donors walked, ${R.scholarsLost} scholars quit · peak treasury ${fmtMoney(G.stats.peakCash)}.` });
  // why it went that way
  if (!win) {
    const top = rows[0];
    const r = W.rivals.find(x => x.short === top.short);
    const byTag = Object.entries((r && r.vByTag) || {}).sort((a, b) => b[1] - a[1]);
    if (byTag.length) {
      const [tag, n] = byTag[0];
      const bench = G.scholars.filter(s => s.tag === tag).length;
      const yours = R.wonByTag[tag] || 0;
      items.push({ h: 'WHY IT WENT THAT WAY', s: `${top.short} banked ${n} of their ${top.v} victories in ${tag}, where you ${bench ? `finished with a bench ${bench} deep and banked ${yours}` : 'had no bench at all'}. The margin was ${top.v - G.stats.won}.` });
    }
  } else {
    const byTag = Object.entries(R.wonByTag).sort((a, b) => b[1] - a[1]);
    const runner = rows[1];
    if (byTag.length) items.push({ h: 'WHY IT WENT THAT WAY', s: `Your edge was ${byTag[0][0]}: ${byTag[0][1]} victories, your deepest lane. ${runner ? `${runner.short} finished ${G.stats.won - runner.v} behind.` : ''}` });
  }
  // the fights that mattered, with their icons
  const wins = (R.wins || []).filter(w => w.banks).sort((a, b) => b.share - a.share || a.prob - b.prob).slice(0, 6);
  if (wins.length) items.push({ h: 'BIGGEST WINS', html: recapGrid(wins, 'win') });
  const losses = (R.losses || []).sort((a, b) => b.lost - a.lost).slice(0, 6);
  if (losses.length) items.push({ h: 'WORST LOSSES', html: recapGrid(losses, 'loss') });
  // moments
  const moments = [];
  if (R.testimonies) moments.push(`Testimony: ${R.testimonyWins}/${R.testimonies}`);
  if (R.oppoHits) moments.push(`Oppo files landed: ${R.oppoHits}`);
  if (R.raids) moments.push(`Raids: ${R.raids}`);
  const allies = Object.entries(G.allies || {});
  if (allies.length) moments.push(`Allies in government: ${allies.map(([t, n]) => `${t} ×${n}`).join(', ')}`);
  const mvp = [...G.donors].sort((a, b) => (b.paid || 0) - (a.paid || 0))[0];
  if (mvp && mvp.paid) moments.push(`Most valuable donor: ${mvp.name} (${fmtMoney(mvp.paid)} over the campaign)`);
  if (moments.length) items.push({ h: 'MOMENTS', s: moments.join(' · ') });
  // titles, as badges
  const titles = [];
  if (win && R.monthsLed <= 3) titles.push('sandbagger');
  if (R.noBench >= 2) titles.push('amateur');
  if (G.scholars.some(s => s.diva)) titles.push('diva');
  if (G.programs.wing) titles.push('landlord');
  if (allies.reduce((a, [, n]) => a + n, 0) >= 2) titles.push('revolving');
  if (R.minConf >= 60) titles.push('iron');
  if (R.favoredLosses >= 2) titles.push('wire');
  if (R.crises >= 4 && G.donors.length >= 3) titles.push('crisis');
  if ((R.oppoHits || 0) >= 3) titles.push('oppo');
  if ((R.raids || 0) >= 3) titles.push('raider');
  if (titles.length) items.push({ h: 'TITLES EARNED', s: titles.map(k => BADGES[k].label).join(' · '),
    html: `<div class="badgegrid">${titles.map(k => { const b = BADGES[k]; return `<div class="badge" title="${b.desc}">${iconImg(b.icon, 'lg')}<div class="rc-title">${b.label}</div><div class="rc-sub">${b.desc}</div></div>`; }).join('')}</div>` });
  return items;
}

function recapGrid(list, kind) {
  return `<div class="recapgrid">${list.map(w => `<div class="recapcell" title="${w.title}">${iconImg('fight_' + w.id, 'lg')}
    <div class="rc-title">${w.title.split(':')[0].slice(0, 30)}</div>
    <div class="rc-sub">${kind === 'win' ? `${w.share}% of the pile · a ${w.prob}% shot` : `✦${w.lost} down the drain · ${w.prob}% to win`}</div></div>`).join('')}</div>`;
}

function electionDay(news) {
  G.over = true;
  const rows = standings();
  const rank = rows.findIndex(r => r.you) + 1;
  const win = rank === 1 && rows[0].v > 0;
  G.electionResult = { win, rank, victories: G.stats.won };
  sfx(win ? 'win' : 'lose');
  const list = rows.map((r, i) => `${i + 1}. ${r.short} — ${r.v}`).join('   ·   ');
  const items = [
    win
      ? { h: `${tank().name.toUpperCase()} NAMED MOST INFLUENTIAL THINK TANK IN WASHINGTON`, s: `Election Night, November 2028. ${G.stats.won} policy ${G.stats.won === 1 ? 'victory' : 'victories'} banked since January 2027. The gala will be insufferable.`, big: true }
      : { h: `${rows[0].pname ? rows[0].pname.toUpperCase() + "'S " : ''}${rows[0].short.toUpperCase()} NAMED MOST INFLUENTIAL THINK TANK; ${tank().short.toUpperCase()} RANKS #${rank}`, s: `Election Night, November 2028. You banked ${G.stats.won} ${G.stats.won === 1 ? 'victory' : 'victories'} to their ${rows[0].v}. There is always the next cycle.`, big: true },
    { h: 'FINAL STANDINGS', s: list },
    ...recapItems(rows, rank, win),
    ...news,
  ];
  recordRun(rank, win);
  save();
  render();
  G.finalPaper = items;
  startReturns(rows, items);
}

// election-night returns: counts tick up and the board reshuffles live
let returnsTimer = null;
function startReturns(rows, items) {
  const win = $('#returnsWin');
  if (!win || !win.classList) { showPaper(items, true); return; }
  const shown = rows.map(r => ({ ...r, d: 0 }));
  const draw = () => {
    const sorted = [...shown].sort((a, b) => b.d - a.d || (a.you ? -1 : b.you ? 1 : 0));
    $('#returnsBody').innerHTML = `<table class="ledger lb returns">${sorted.map((r, i) =>
      `<tr class="${r.you ? 'you' : ''}"><td class="rank">${i + 1}</td><td>${iconImg('tank_' + tankIdByShort(r.short), 'sm')} ${r.short}${r.you ? ' ★' : ''}</td><td class="amt">${r.d}</td><td class="amt dim">/ ${r.v}</td></tr>`).join('')}</table>`;
  };
  win.classList.remove('hidden');
  $('#returnsNote').textContent = 'Polls are closed. Returns are coming in…';
  $('#returnsBtn').textContent = 'Skip to the verdict';
  draw();
  let i = 0;
  if (returnsTimer) clearInterval(returnsTimer);
  returnsTimer = setInterval(() => {
    const pending = shown.filter(r => r.d < r.v);
    if (!pending.length) { finishReturns(); return; }
    const r = pending[i % pending.length]; r.d++; i++;
    sfx('click');
    draw();
  }, 160);
}

function finishReturns() {
  if (returnsTimer) { clearInterval(returnsTimer); returnsTimer = null; }
  const win = $('#returnsWin');
  if (!win) return;
  const er = G.electionResult || {};
  $('#returnsNote').textContent = er.win ? `${tank().short} is the most influential think tank in Washington.` : `${tank().short} finishes #${er.rank}.`;
  $('#returnsBtn').textContent = 'Read the Campaign Recap ▶';
  $('#returnsBtn').dataset.act = 'returnsdone';
}

// ---------- hall of records (your own finishes) ----------
function recordRun(rank, win) {
  try {
    const runs = JSON.parse(localStorage.getItem('ttt-runs') || '[]');
    runs.unshift({ tank: tank().short, v: G.stats.won, rank, win, when: new Date().toISOString().slice(0, 10) });
    localStorage.setItem('ttt-runs', JSON.stringify(runs.slice(0, 12)));
  } catch (e) {}
}

function renderHall() {
  let runs = [];
  try { runs = JSON.parse(localStorage.getItem('ttt-runs') || '[]'); } catch (e) {}
  const hall = $('#hallBody');
  if (hall && hall.classList) {
    hall.innerHTML = runs.map(r => `<div class="pline">${r.when} · <b>${r.tank}</b> · ${r.v} victories · #${r.rank}${r.win ? ' 🏆' : ''}</div>`).join('');
    $('#hallBox').classList.toggle('hidden', !runs.length);
  }
}

function gameOver(news) {
  G.over = true;
  sfx('lose');
  save();
  render();
  const s = G.stats;
  showPaper([
    { h: `${tank().name.toUpperCase()} FOLDS`, s: 'Fellows scatter to podcasts. The donor wall is auctioned by the marble pound. The election proceeds without you.', big: true },
    { h: 'THE NUMBERS', s: `${s.months} months of operation · ${s.won} fights won · ${s.lost} lost · peak treasury ${fmtMoney(s.peakCash)}.` },
  ], true);
}

// ---------- log / news ----------
function logLine(text) {
  G.log.unshift({ m: W.month, text });
  if (G.log.length > 80) G.log.pop();
}

function meterHTML(m) {
  if (!m) return '';
  return `
    <div class="rollmeter">
      <div class="rollbar"><div class="rollA" style="width:${m.pA}%"></div><div class="needle" data-roll="${m.roll}"></div></div>
      <div class="rolltext">${m.aLabel} wins on 1–${m.pA}, ${m.bLabel} on ${Math.min(100, m.pA + 1)}–100 · the wire reads <b>${m.roll}</b> → <b>${m.winLabel}</b></div>
    </div>`;
}

function showPaper(items, isGameOver) {
  const lead = items.find(i => i.big) || items[0];
  const rest = items.filter(i => i !== lead);
  $('#paperDate').textContent = `${dateStr(W.month)} — Vol. ${W.month + 1} — Still 75¢`;
  $('#paperLead').innerHTML = `<div class="headline">${lead.h}</div>${lead.s ? `<div class="subhead">${lead.s}</div>` : ''}${lead.html || ''}${meterHTML(lead.meter)}`;
  $('#paperRest').innerHTML = rest.map(i =>
    `<div class="paper-item"><div class="headline-sm">${i.h}</div>${i.s && !i.html ? `<div class="subhead-sm">${i.s}</div>` : ''}${i.html || ''}${meterHTML(i.meter)}</div>`).join('');
  $('#paperBtn').textContent = isGameOver ? 'Start Over' : 'Continue';
  $('#paperBtn').dataset.act = isGameOver ? 'restart' : 'closepaper';

  $('#paper').classList.remove('hidden');
  sfx('paper');
  if (items.some(i => i.meter)) sfx('roll');
  // sweep each needle to its rolled number after the paper lands
  setTimeout(() => {
    document.querySelectorAll('#paper .needle').forEach(n => { n.style.left = n.dataset.roll + '%'; });
  }, 80);
}

// ---------- save / load ----------
function save() { if (NET.active) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify({ G, uid })); } catch (e) {} }
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    G = data.G; W = G; uid = data.uid || 1000;
    if (G) { // older saves predate grant cycles, scholar patience, victories
      (G.donors || []).forEach(d => { if (d.term === undefined) d.term = 18; });
      (G.scholars || []).forEach(s => { if (s.strikes === undefined) s.strikes = 0; });
      (W.rivals || []).forEach(r => { if (r.victories === undefined) r.victories = 0; });
      if (G.confidence === undefined) { G.confidence = TUNE.confStart; G.confLog = []; G.courtsThisMonth = 0; }
      // retired support titles that sounded like development staff
      const retitled = { 'Development Associate': 'Logistics Coordinator', 'Grants Manager': 'Finance Manager', 'Comms Director': 'Comms Coordinator' };
      [...(G.ops || []), ...(G.hireMarket || [])].forEach(o => { if (o.kind === 'ops' && !o.spec && retitled[o.role]) o.role = retitled[o.role]; });
      if (!G.v || G.v < 2) { // rebase rival budgets onto the tuned scale
        const defs = TANKS.concat(NPC_TANKS);
        (W.rivals || []).forEach(r => {
          const def = defs.find(t => t.short === r.short);
          if (def) r.budget = Math.round(def.budget * TUNE.rivalBudgetMult);
        });
        G.v = 2;
      }
    }
    return !!G && !G.over;
  } catch (e) { return false; }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

// ---------- rendering ----------
function showScreen(which) {
  $('#startScreen').classList.toggle('hidden', which !== 'start');
  $('#gameScreen').classList.toggle('hidden', which !== 'game');
}

function renderStart() {
  renderHall();
  const sel = $('#netTank');
  if (sel && !sel.options.length) sel.innerHTML = TANKS.map(t => `<option value="${t.id}">${t.name} (${t.diff})</option>`).join('');
  const hasSave = (() => { try { const r = localStorage.getItem(SAVE_KEY); if (!r) return false; const d = JSON.parse(r); return d.G && !d.G.over; } catch (e) { return false; } })();
  $('#resumeBox').classList.toggle('hidden', !hasSave);
  $('#continueRow').innerHTML = hasSave
    ? `<button class="btn big" data-act="continue">▶ Resume Saved Game</button>` : '';
  $('#tankPicker').innerHTML = TANKS.map(t => `
    <div class="card tankcard">
      <div class="cardhead">${iconImg('tank_' + t.id, 'lg')}<span>${t.name}</span></div>
      <div class="cardbody">
        <div class="tankmeta">${leanChip(t.align)} <span class="chip">${t.size}</span> <span class="chip" title="${AI_LEVEL_TEXT[t.diff] || ''}">${t.diff}</span></div>
        <div class="motto">“${t.motto}”</div>
        <div class="blurb">${t.blurb}</div>
        <div class="statline">💰 ${fmtMoney(t.cash)} · 👤 ${t.scholars} scholars, ${t.ops} ops · 🎩 ${t.donors.length} donor${t.donors.length === 1 ? '' : 's'} · ✦ ${t.influence}</div>
        <button class="btn" data-act="pick" data-id="${t.id}">Run This Shop</button>
      </div>
    </div>`).join('');
}

function render() {
  if (!G) return;
  const t = tank();
  const net = monthlyGrants() - monthlyCosts();
  const cap = supportCap();

  $('#tbTank').textContent = t.short.toUpperCase();
  const monthsLeft = TUNE.electionMonth - W.month;
  const inSeason = W.month >= TUNE.electionSeasonStart && monthsLeft > 0;
  const cal = CALENDAR_LABEL[calendarOf(W.month)] ? ` · ${CALENDAR_LABEL[calendarOf(W.month)]}` : '';
  $('#tbDate').textContent = monthsLeft <= 0 ? 'ELECTION NIGHT'
    : inSeason ? `${dateStr(W.month)}${cal} · ⚡ ELECTION SEASON · ${monthsLeft} mo`
    : `${dateStr(W.month)}${cal} · ${monthsLeft} mo to election`;
  setMuted(muted);
  $('#tbDate').className = inSeason ? 'tbval season' : 'tbval';
  $('#tbCash').innerHTML = `${fmtMoney(G.cash)} <span class="dim">(${fmtSigned(net)}/mo)</span>`;
  $('#tbCash').className = G.cash < 0 ? 'tbval bad' : 'tbval';
  $('#tbInf').innerHTML = `✦ ${G.influence} <span class="dim">(+${production()}/mo)</span>`;
  $('#tbStaff').textContent = `${G.scholars.length} scholars / ${cap} supported`;

  const ph = $('#prospectHireBtn'), pd = $('#prospectDonorBtn');
  const pph = prospectPrice('hire'), ppd = prospectPrice('donor');
  if (ph) { ph.textContent = `PROSPECT (${fmtMoney(pph.cash)} + ✦${pph.inf})`; ph.disabled = G.cash < pph.cash || G.influence < pph.inf; }
  if (pd) { pd.textContent = `PROSPECT (${fmtMoney(ppd.cash)} + ✦${ppd.inf})`; pd.disabled = G.cash < ppd.cash || G.influence < ppd.inf; }

  renderFights();
  renderHireMarket();
  renderDonorMarket();
  renderStaff(cap);
  renderPrograms();
  renderMyDonors();
  const hdr = $('#donorConfHdr');
  if (hdr) { const c = G.confidence === undefined ? TUNE.confStart : G.confidence; const b = confBand(c); hdr.textContent = ` · CONFIDENCE ${c} (${b.label.toUpperCase()})`; hdr.title = confLedgerText(); }
  renderReport();
  renderBugle();
  renderCrisis();
}

function renderStaff(cap) {
  // display groups scholars by specialty so bench depth is obvious;
  // ops coverage itself still follows seniority (first hires keep support)
  const entries = G.scholars.map((s, i) => ({ s, supported: i < cap }));
  entries.sort((a, b) => TAGS.indexOf(a.s.tag) - TAGS.indexOf(b.s.tag));
  const scholars = [];
  let lastTag = null;
  entries.forEach(({ s, supported }) => {
    if (s.tag !== lastTag) {
      lastTag = s.tag;
      const es = entries.filter(e => e.s.tag === s.tag);
      const bench = es.reduce((a, e) => a + (e.supported ? e.s.out : Math.floor(e.s.out * TUNE.unsupportedMult)), 0);
      scholars.push(`<div class="taghead">${tagChip(s.tag)} <span class="dim">×${es.length} · ✦${bench}/mo · commits +${Math.round((expertiseMult(s.tag) - 1) * 100)}%</span></div>`);
    }
    scholars.push(`
      <div class="person ${supported ? '' : 'unsup'}">
        ${iconImg(s.icon)}
        <div class="pcontent">
          <div class="pline">
            <b>${s.name}</b>${s.big ? ' <span class="star" title="Big Name">★</span>' : ''} ${tagChip(s.tag)} ${leanChip(s.lean || 0)}${s.mope > 0 ? ` <span class="chip raid" title="Demoralized by a ${s.tag} defeat: output −${Math.round((1 - TUNE.moraleMult) * 100)}% for ${s.mope} more month${s.mope > 1 ? 's' : ''}. Losing ${s.tag} again risks their departure; a ${s.tag} win restores them instantly.">😞 −${Math.round((1 - TUNE.moraleMult) * 100)}%</span>` : ''}${s.from ? ` <span class="chip" title="Poached from a rival">ex-${s.from}</span>` : ''}${s.diva ? ` <span class="chip diva" title="Brilliant, impossible: every month there's a ${Math.round(TUNE.divaQuitChance * 100)}% chance a colleague quits over them.">🔥 DIVA</span>` : ''}
            ${supported ? '' : `<span class="warn" title="No ops support — half output, and they quit after ${TUNE.scholarStrikeLimit} straight unsupported months">⚠ half rate · patience ${'●'.repeat(s.strikes || 0)}${'○'.repeat(Math.max(0, TUNE.scholarStrikeLimit - (s.strikes || 0)))}${(s.strikes || 0) === TUNE.scholarStrikeLimit - 1 ? ' — one more month and they quit' : ''}</span>`}
          </div>
          <div class="pline dim">✦ ${supported ? s.out : Math.floor(s.out * TUNE.unsupportedMult)}/mo · ${fmtMoney(s.salary)}/mo</div>
          <div class="pline quirk">${s.quirk}</div>
          ${s.tapped ? `<div class="pline poachline">🏛 <b>Tapped for government</b> — ${s.tapped.post}. Decide this month:
            <button class="btn tiny" data-act="serve" data-id="${s.id}" title="They leave; you gain a permanent ally in government on ${s.tag} (+10% on your ${s.tag} commits)">Let Them Serve</button>
            <button class="btn tiny" data-act="keep" data-id="${s.id}" title="Costs ✦25">Talk Them Out of It (✦25)</button></div>` : ''}
          ${s.poach ? `<div class="pline poachline">⚠ <b>${s.poach.by}</b> is offering <b>${fmtMoney(s.poach.salary)}/mo</b> (now ${fmtMoney(s.salary)}). Decide before month's end:
            <button class="btn tiny" data-act="match" data-id="${s.id}">Match</button>
            <button class="btn tiny" data-act="release" data-id="${s.id}">Let Them Walk</button></div>`
          : `<button class="btn tiny" data-act="fire" data-kind="scholar" data-id="${s.id}">Let Go</button>`}
        </div>
      </div>`);
  });
  const ops = [];
  G.ops.forEach(o => {
    ops.push(`
      <div class="person">
        ${iconImg(o.icon)}
        <div class="pcontent">
          <div class="pline"><b>${o.name}</b>${o.spec ? ` <span class="chip ${SPECIALISTS.find(x => x.id === o.spec).dud ? 'raid' : 'want'}" title="${SPECIALISTS.find(x => x.id === o.spec).tip}">${SPECIALISTS.find(x => x.id === o.spec).fx.toUpperCase()}</span>` : ''}${o.trait ? ` <span class="chip ${o.trait.id === 'expense' || o.trait.id === 'chaotic' ? 'raid' : 'want'}" title="${o.trait.tip}">${o.trait.label}</span>` : ''}${o.flaked ? ' <span class="chip raid" title="They simply did not come in this month. Zero support delivered.">GHOSTING</span>' : ''}</div>
          <div class="pline dim">${o.role} · ${o.spec ? 'no scholar support' : `supports <b>${o.flaked ? 0 : (o.supports === undefined ? TUNE.supportRatio : o.supports)}</b>`} · ${fmtMoney(o.salary)}/mo</div>
          <div class="pline quirk">${o.quirk}</div>
          ${o.poach ? `<div class="pline poachline">⚠ <b>${o.poach.by}</b> is offering <b>${fmtMoney(o.poach.salary)}/mo</b> (now ${fmtMoney(o.salary)}). Decide before month's end:
            <button class="btn tiny" data-act="matchops" data-id="${o.id}">Match</button>
            <button class="btn tiny" data-act="releaseops" data-id="${o.id}">Let Them Walk</button></div>`
          : `<button class="btn tiny" data-act="fire" data-kind="ops" data-id="${o.id}">Let Go</button>`}
        </div>
      </div>`);
  });
  $('#scholarsBody').innerHTML = scholars.join('') || '<div class="empty">No scholars. No scholars, no influence.</div>';
  $('#opsBody').innerHTML = ops.join('') || '<div class="empty">No ops staff. Scholars are wandering the halls unsupported.</div>';
}

function renderPrograms() {
  const running = PROGRAMS.filter(p => G.programs[p.id]).length;
  const btn = $('#progBtn');
  if (btn) btn.textContent = `PROGRAMS (${running} ON)`;
  $('#programsBody').innerHTML = PROGRAMS.map(p => {
    const on = G.programs[p.id];
    const wanted = G.donors.some(d => d.demand.type === 'PROGRAM' && d.demand.pid === p.id);
    const fellowsNote = p.id === 'fellows' && on
      ? ` · next cohort in ${TUNE.fellowsEvery - (((G.progMonths || {}).fellows || 0) % TUNE.fellowsEvery)} mo` : '';
    const focus = p.id === 'fellows' ? (G.progFocus || weakestTag()) : null;
    const nextFocus = focus ? TAGS[(TAGS.indexOf(focus) + 1) % TAGS.length] : null;
    const focusLine = focus ? `<div class="pline">Sourcing focus: ${tagChip(focus)} <button class="btn tiny" data-act="progfocus" data-tag="${nextFocus}" title="Each cohort usually yields a junior ${focus} scholar; sometimes nobody, occasionally a star or a stray from another field">change ▸</button></div>` : '';
    const costLine = p.once
      ? `${fmtMoney(p.once)} once${p.cost ? ` + ${fmtMoney(p.cost)}/mo upkeep` : ''} · ${programBenefit(p)}`
      : `${fmtMoney(p.cost)}/mo · ${programBenefit(p)}${fellowsNote}`;
    const button = p.once
      ? (on ? '<span class="chip on" title="Endowed in perpetuity — this cannot be shut down">PERMANENT</span>'
            : `<button class="btn tiny" data-act="prog" data-id="${p.id}" ${G.cash < p.once ? 'disabled' : ''}>Endow (${fmtMoney(p.once)})</button>`)
      : `<button class="btn tiny" data-act="prog" data-id="${p.id}">${on ? 'Shut Down' : 'Launch'}</button>`;
    return `
      <div class="program ${on ? 'on' : ''}">
        ${iconImg('program_' + p.id)}
        <div class="pcontent">
          <div class="pline"><b>${p.name}</b> ${on ? '<span class="chip on">RUNNING</span>' : ''} ${wanted ? '<span class="chip want" title="A current donor demands this">DONOR BAIT</span>' : ''}</div>
          <div class="pline dim">${costLine}</div>
          ${focusLine}
          <div class="pline quirk">${p.blurb}</div>
          ${button}
        </div>
      </div>`;
  }).join('');
}

// what a program actually buys you — money, a bonus, or the donors who demand it
function programBenefit(p) {
  const deck = DONORS.filter(d => d.demand && d.demand.type === 'PROGRAM' && d.demand.pid === p.id).length;
  const mine = G.donors.filter(d => d.demand.type === 'PROGRAM' && d.demand.pid === p.id).length;
  const parts = [];
  if (p.inf) parts.push(`✦ +${p.inf}/mo`);
  if (p.id === 'warroom') parts.push(`+${Math.round(TUNE.warroomBonus * 100)}% on every commit`);
  if (p.id === 'fellows') parts.push(`a scholar cohort every ${TUNE.fellowsEvery} months`);
  if (p.id === 'wing') parts.push('rent halved, forever');
  if (p.id === 'chair') parts.push('permanent');
  if (deck) parts.push(`demanded by ${deck} donor${deck > 1 ? 's' : ''} in the deck${mine ? ` (${mine} of yours)` : ''}`);
  return parts.join(' · ') || 'prestige only';
}

function donorPFChips(d) {
  let s = '';
  if (d.raidedFrom) s += ` <span class="chip" title="Lured away from ${d.raidedFrom}">ex-${d.raidedFrom}</span>`;
  if (d.perk && DONOR_PERKS[d.perk]) s += ` <span class="chip want" title="${DONOR_PERKS[d.perk].tip}">${DONOR_PERKS[d.perk].label}</span>`;
  if (d.flaw && DONOR_FLAWS[d.flaw]) s += ` <span class="chip raid" title="${DONOR_FLAWS[d.flaw].tip}">${DONOR_FLAWS[d.flaw].label}</span>`;
  if (d.whale) s += ` <span class="chip raid" title="${DONOR_FLAWS.whale.tip}">🐋 WHALE</span>`;
  return s;
}

function renderMyDonors() {
  const rows = G.donors.map(d => {
    const met = demandMet(d);
    return `
      <div class="person donor">
        ${iconImg('donor_' + d.id)}
        <div class="pcontent">
          <div class="pline"><b>${d.name}</b> ${leanChip(d.lean)}${donorPFChips(d)}</div>
          <div class="pline dim">${fmtMoney(d.grant)}/mo · ${d.term === undefined ? '♾ no cycle' : `⌛ cycle: ${Math.max(0, d.term - (W.month - d.joined))} mo left`}</div>
          <div class="pline ${met ? 'ok' : 'warn'}">${met ? '✓' : '✗'} ${demandText(d)}${d.demand.type === 'ENGAGE' ? (W.fights.some(f => f.tag === d.demand.tag) ? ` <span class="dim">(this month: ✦${(G.monthCommits || {})[d.demand.tag] || 0})</span>` : ` <span class="dim">(no ${d.demand.tag} fight on the board — excused this month)</span>`) : ''}</div>
          ${(() => {
            const cap = d.renewals ? 1 : TUNE.strikeLimit;
            return `<div class="pline dim">${d.renewals ? '<span class="chip want" title="Renewed relationship: stricter terms, and a single strike ends it">RENEWED</span> ' : ''}Strikes: ${'●'.repeat(d.strikes)}${'○'.repeat(Math.max(0, cap - d.strikes))}${d.strikes === cap - 1 ? ' <span class="warn">— one more and they walk</span>' : ''}</div>`;
          })()}
          ${d.poach ? `<div class="pline poachline">⚠ <b>${d.poach.by}</b> is courting them. Re-cultivate for <b>✦${d.poach.cost}</b> or they defect at month's end:
            <button class="btn tiny" data-act="recultivate" data-id="${d.id}" ${G.influence < d.poach.cost ? 'disabled' : ''}>Re-cultivate (✦${d.poach.cost})</button>
            <button class="btn tiny" data-act="letgo" data-id="${d.id}">Let Them Go</button></div>`
          : d.lapsing ? `<div class="pline poachline">⌛ <b>Cycle over.</b> Renew for ✦${renewCost(d)} on stricter terms${d.demand.type === 'ENGAGE' ? ` (wants ✦${d.demand.amt + 5}/mo)` : d.demand.type === 'ROSTER' ? ' (wants 2 scholars)' : ''} — one strike ends a renewed deal — or let it lapse:
            <button class="btn tiny" data-act="renew" data-id="${d.id}">Renew</button>
            <button class="btn tiny" data-act="lapse" data-id="${d.id}">Let Lapse</button></div>`
          : `<button class="btn tiny" data-act="drop" data-id="${d.id}">Part Ways</button>`}
        </div>
      </div>`;
  });
  $('#myDonorsBody').innerHTML = rows.join('') || '<div class="empty">No funders. The treasury drains.</div>';
}

// shown on fight cards when your bench amplifies commits there
function expertiseChip(tag) {
  const n = G.scholars.filter(s => s.tag === tag).length;
  if (!n) return ` <span class="chip nobench" title="No ${tag} scholars on staff: no commit bonus here — and losing a contested ${tag} fight demoralizes your ENTIRE roster (−${Math.round((1 - TUNE.moraleMult) * 100)}% for ${TUNE.moraleMonths} months).">⚠ no bench</span>`;
  const pct = Math.round((expertiseMult(tag) - 1) * 100);
  const wr = G.programs.warroom ? ` The War Room adds ${Math.round(TUNE.warroomBonus * 100)} points of that.` : '';
  return ` <span class="chip on" title="Due to expertise, influence you commit here gets a +${pct}% bonus (${n} ${tag} scholar${n > 1 ? 's' : ''} on staff).${wr}">★ +${pct}%</span>`;
}

// who's behind each side of a fight, sorted big to small
function backersText(s) {
  const mine = yoursOf(s);
  const entries = Object.entries(s.rivals || {}).sort((x, y) => y[1] - x[1]);
  const humans = Object.entries(s.players || {}).filter(([pid]) => !(G && pid === G.pid)).map(([pid, v]) => [playerName(pid), v]);
  const all = [...entries, ...humans].sort((x, y) => y[1] - x[1]);
  const parts = all.map(([n, v]) => `${n} ${v}`);
  const attributed = all.reduce((a, e) => a + e[1], 0);
  const other = s.total - mine - attributed;
  if (other > 0) parts.push(`Others ${other}`);
  if (mine > 0) parts.unshift(`<b>You ${mine}</b>`);
  return parts.length ? '⚑ ' + parts.join(' · ') : '⚑ no backers yet';
}

function renderFights() {
  $('#fightsBody').innerHTML = W.fights.map((f, fi) => {
    const [a, b] = f.sides;
    const pWin = Math.round(winProbA(f) * 100);
    const pctA = Math.max(2, Math.min(98, pWin));
    return `
      <div class="card fightcard">
        <div class="cardhead fight">${iconImg('fight_' + f.defId, 'sm')}<span class="ftype ${f.type}" title="${fightType(f).tip || ''}">${f.type}</span><span>${f.title}</span></div>
        <div class="cardbody">
          <div class="fightmeta">${tagChip(f.tag)} <span class="chip">⏳ ${f.monthsLeft} mo</span> <span class="chip gold" title="${rewardTip(f)}">🏆 ${rewardText(f)}</span>${expertiseChip(f.tag)}${fightCap(f) ? ` <span class="chip" title="Rulemaking docket: at most ✦${fightCap(f)} per institution per month. Patient positions beat dumps.">📋 ✦${(f.monthUsed || {})[G.pid || 'me'] || 0}/${fightCap(f)} this month</span>` : ''}${f.targetRival ? ` <span class="chip vend" title="${f.targetRival} is in the hot seat: if the probe side wins, their donor confidence drops 10. They will defend themselves.">🎯 ${f.targetRival.toUpperCase()}</span>` : ''}</div>
          ${testimonyReady(f) ? (() => {
            const w = bestWitness(f.tag), st = testifyStakes(f, w), pc = testifyPrepCost();
            const p0 = Math.round(testifyOdds(w, false, f) * 100), p1 = Math.round(testifyOdds(w, true, f) * 100);
            return `<div class="pline"><button class="btn tiny" data-act="testify" data-f="${fi}" title="${w.name} takes the stand for “${st.side.label}”: ${p0}% they command the room (+${st.gain} — 1.5× their output, or a tenth of the other side's pile, whichever is bigger); otherwise −${st.loss} (${Math.round(TUNE.testifyFlubPct * 100)}% of your stake, never more than their output) and a bruised ego.">📣 Testify: ${w.name} · ${p0}% for +${st.gain}, else −${st.loss}</button> <button class="btn tiny" data-act="testify" data-f="${fi}" data-prep="1" ${G.influence < pc ? 'disabled' : ''} title="Murder boards and a haircut: +${Math.round(TUNE.testifyPrepBonus * 100)}% odds${pc ? ` for ✦${pc}` : ' — free, your Comms Director runs prep'}">Prep & testify (${pc ? `✦${pc}, ` : ''}${p1}%)</button></div>`;
          })() : ''}
          ${f.testimony ? `<div class="pline ${f.testimony.ok ? 'ok' : 'warn'}">📣 ${f.testimony.who} ${f.testimony.ok ? 'commanded the hearing room' : 'flubbed the hearing'}: ${f.testimony.eff > 0 ? '+' : ''}${f.testimony.eff}</div>` : ''}
          <div class="tug" title="Odds if it resolved right now. Influence ratios are sharpened (a 2:1 lead wins ~85%) — but the wire decides, and upsets happen."><div class="tugA" style="width:${pctA}%"></div></div>
          ${f.sides.map((s, si) => `
            <div class="sideline">
              <span class="sidelabel"><span class="sidemark ${si === 0 ? 'a' : 'b'}" title="This side's segment of the bar is ${si === 0 ? 'gold' : 'violet'}">${si === 0 ? '◤' : '◢'}</span> ${s.label} ${leanChip(s.lean)}</span>
              <span class="sidenums">${s.total} <span class="dim prob">· ${si === 0 ? pWin : 100 - pWin}%</span></span>
              <span class="sidebtns">
                <button class="btn tiny" data-act="commit" data-f="${fi}" data-s="${si}" data-amt="5">+5</button>
                <button class="btn tiny" data-act="commit" data-f="${fi}" data-s="${si}" data-amt="25">+25</button>
              </span>
            </div>
            <div class="backers dim">${backersText(s)}</div>${intelText(f, si)}`).join('')}
        </div>
      </div>`;
  }).join('');
  $('#fightDeckCount').textContent = `DECK: ${W.fightDeck.length}`;
}

function renderReport() {
  const s = G.stats;
  const grants = monthlyGrants(), payroll = payrollCost(), rent = effectiveRent(), prog = programsCost();
  const net = grants - payroll - rent - prog;
  const seasonal = W.month >= TUNE.electionSeasonStart ? TUNE.electionSeasonMult : 1;
  const lbRows = standings().map((row, i) => {
    const rival = row.human ? null : W.rivals.find(r => r.short === row.short);
    const budget = row.you ? `✦+${production()}` : rival ? `✦~${rival.income || Math.round(rival.budget * seasonal * rivalConfMult(rival))}` : '—';
    const c = row.you ? (G.confidence === undefined ? TUNE.confStart : G.confidence) : rival ? rivalConf(rival) : row.conf;
    const band = c === null || c === undefined ? null : confBand(c);
    const gauge = band ? `<span class="minigauge" title="Donor confidence ${c} · ${band.label}${rival ? ` — spending ×${rivalConfMult(rival)}` : ''}"><i class="conffill ${band.id}" style="width:${c}%"></i></span>` : '';
    const dents = rival && rival.dents && rival.dents.length ? `<span class="chip dent" title="${dentText(rival)}">💢${rival.dents.length}</span>` : '';
    const vend = rival && vendettaAgainstMe(rival) ? `<span class="chip vend" title="Vendetta against you: twice the poaching of your scholars, donors and ops, plus whisper campaigns against your donor base">⚔</span>` : '';
    const oppo = !row.you && !G.over ? `<button class="btn tiny oppo" data-act="oppo" data-target="${row.human ? row.pid : row.short}" title="Commission an oppo file on ${row.short} (✦${oppoCost()}, ${Math.round(oppoOdds() * 100)}% to land): their donor confidence ${TUNE.oppoHit}, or it blows back on yours (${TUNE.oppoBlowback}). One a month; each file costs ✦${TUNE.oppoStep} more than the last.${row.human ? '' : ' Either way they take it personally.'}" ${G.oppoMonth === W.month || G.influence < oppoCost() ? 'disabled' : ''}>📁</button>` : '';
    return `<tr class="${row.you ? 'you' : ''}">
      <td class="rank">${i + 1}</td>
      <td><span ${rival ? `class="rivalname" title="${rivalTip(rival)}"` : ''}>${iconImg('tank_' + tankIdByShort(row.short), 'sm')} ${row.short}</span>${row.pname ? ` <span class="dim">· ${row.pname}</span>` : ''}${rival && aiLevel() > TUNE.aiDiceLevel && (rival.chest || 0) >= (rival.income || rival.budget) * 3 ? ` <span class="chip" title="War chest: ✦${rival.chest} banked. Expect it in a closing month.">🏦</span>` : ''}${row.you ? (i === 0 && row.v > 0 ? ' ★ <span title="You lead the board: the whole town is spending harder and counter-bidding the sides you top.">🔥</span>' : ' ★') : (row.human && i === 0 && row.v > 0 ? ' 🔥' : '')}</td>
      <td>${leanChip(row.align)}</td>
      <td class="amt">${row.v}</td>
      <td class="amt dim">${budget}</td>
      <td class="lbx">${gauge}${dents}${vend}${oppo}</td>
    </tr>`;
  }).join('');
  $('#reportBody').innerHTML = `
    <div class="pline"><b>${tank().name}</b></div>
    <div class="pline quirk">“${tank().motto}”</div>
    <div class="subdivider">RECORD</div>
    <div class="pline">${s.months} months · <b>${s.won} victories banked</b> · ${s.lost} losing sides</div>
    <div class="pline">Peak treasury: ${fmtMoney(s.peakCash)}</div>
    <div class="subdivider">MONTHLY LEDGER</div>
    <table class="ledger">
      <tr><td>Grants</td><td class="amt ok">${fmtSigned(grants)}</td></tr>
      <tr><td>Payroll</td><td class="amt">${fmtSigned(-payroll)}</td></tr>
      <tr><td>Rent</td><td class="amt">${fmtSigned(-rent)}</td></tr>
      <tr><td>Programs</td><td class="amt">${fmtSigned(-prog)}</td></tr>
      <tr class="net"><td>Net</td><td class="amt ${net < 0 ? 'warn' : 'ok'}">${fmtSigned(net)}</td></tr>
    </table>
    ${Object.keys(G.allies || {}).length ? `<div class="subdivider">ALLIES IN GOVERNMENT</div><div class="pline">${Object.entries(G.allies).map(([t, n]) => `${tagChip(t)} ×${n} <span class="dim">(+${n * Math.round(TUNE.allyBonus * 100)}% commits)</span>`).join(' ')}</div>` : ''}
    <div class="subdivider">DONOR CONFIDENCE</div>
    ${(() => {
      const c = G.confidence === undefined ? TUNE.confStart : G.confidence;
      const b = confBand(c);
      const over = activeDonors().length - stewardCap();
      return `<div class="confrow" title="${confLedgerText()} — Confident ≥70: courting −5%. Watchful 40–69: 10%/mo a donor strikes. Spooked 20–39: 25%/mo strikes, courting +25%, renewals ×2. Exodus <20: a donor leaves every month.">
        <div class="confbar"><div class="conffill ${b.id}" style="width:${c}%"></div></div>
        <span class="${b.cls}"><b>${c}</b> · ${b.label}</span></div>
      <div class="pline dim">Stewardship: ${activeDonors().length}/${stewardCap()} donors${over > 0 ? ` <span class="warn">— ${over} over capacity, confidence bleeds</span>` : ''}</div>`;
    })()}
    <div class="subdivider">LEADERBOARD — POLICY VICTORIES</div>
    <table class="ledger lb">
      <tr class="lbhead"><td>#</td><td>TANK</td><td>LEAN</td><td class="amt">W</td><td class="amt">✦/mo</td><td title="Donor confidence · dents you've put in them · vendettas · the oppo file">BASE</td></tr>
      ${lbRows}
    </table>`;
}

function tankIdByShort(short) {
  const t = TANKS.find(x => x.short === short) || NPC_TANKS.find(x => x.short === short);
  return t ? t.id : 'bland';
}

function renderBugle() {
  $('#bugleBody').innerHTML = G.log.map(l =>
    `<div class="logline"><span class="logdate">${dateStr(l.m)}</span> ${l.text}</div>`).join('')
    || '<div class="empty">Nothing yet. A slow town, until it isn’t.</div>';
}

function renderHireMarket() {
  $('#hireBody').innerHTML = G.hireMarket.map((h, i) => {
    if (h.kind === 'scholar') {
      return `
        <div class="card hirecard">
          <div class="cardhead small">${h.name}${h.big ? ' ★' : ''}</div>
          <div class="cardbody mrow">
            ${iconImg(h.icon)}
            <div class="mcontent">
              <div class="pline">${tagChip(h.tag)} ${leanChip(h.lean || 0)}${h.from ? ` <span class="chip raid" title="Currently at a rival. Hiring is a raid: 1.5× signing bonus, and ${h.from} permanently loses ~${TUNE.raidBudgetHit}/mo of influence budget">AT ${h.from.toUpperCase()}</span>` : ''}${h.diva ? ` <span class="chip diva" title="Enormous output — and every month there's a ${Math.round(TUNE.divaQuitChance * 100)}% chance a colleague quits over them.">🔥 DIVA</span>` : ''}</div>
              <div class="pline">✦ ${h.out}/mo · ${fmtMoney(h.salary)}/mo</div>
              <div class="pline quirk">${h.quirk}</div>
              <button class="btn tiny" data-act="hire" data-idx="${i}">Hire (${fmtMoney(hireBonus(h))} bonus)</button>${fitTipHire(h)}
            </div>
          </div>
        </div>`;
    }
    return `
      <div class="card hirecard ops">
        <div class="cardhead small">${h.name}</div>
        <div class="cardbody mrow">
          ${iconImg(h.icon)}
          <div class="mcontent">
            <div class="pline"><span class="chip">OPS</span> <span class="dim">${h.role}</span>${h.spec ? ` <span class="chip ${SPECIALISTS.find(x => x.id === h.spec).dud ? 'raid' : 'want'}" title="${SPECIALISTS.find(x => x.id === h.spec).tip}">${SPECIALISTS.find(x => x.id === h.spec).fx.toUpperCase()}</span>` : ''}${h.trait ? ` <span class="chip ${h.trait.id === 'expense' || h.trait.id === 'chaotic' ? 'raid' : 'want'}" title="${h.trait.tip}">${h.trait.label}</span>` : ''}</div>
            <div class="pline">${h.spec ? 'No scholar support — a specialist' : `Supports <b>${h.supports}</b> scholar${h.supports > 1 ? 's' : ''}`} · ${fmtMoney(h.salary)}/mo</div>
            <div class="pline quirk">${h.quirk}</div>
            <button class="btn tiny" data-act="hire" data-idx="${i}">Hire (${fmtMoney(hireBonus(h))} bonus)</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderDonorMarket() {
  $('#donorMarketBody').innerHTML = G.donorMarket.map((d, i) => `
    <div class="card hirecard donor">
      <div class="cardhead small">${d.name}</div>
      <div class="cardbody mrow">
        ${iconImg('donor_' + d.id)}
        <div class="mcontent">
          <div class="pline">${leanChip(d.lean)} <b>${fmtMoney(d.grant)}/mo</b> <span class="dim">· ${d.term === undefined ? 'no cycle' : d.term + ' mo cycle'}</span>${d.lead ? ' <span class="chip want" title="Won in a policy fight: half-price courtship">WARM INTRO</span>' : ''}${d.from ? ` <span class="chip vend" title="Currently funds ${d.from}. Courting them costs ${TUNE.donorRaidMult}× — ${d.fromPid ? `it's a bid: ${d.from} gets a month to re-cultivate them, and your influence is spent either way` : `${d.from}'s budget takes a permanent −${TUNE.donorRaidHit}, and they swear a vendetta: twice the poaching of your scholars, ops and donors, plus whisper campaigns, for the rest of the game`}.">⚔ FUNDS ${d.from.toUpperCase()}</span>` : ''}${donorPFChips(d)}</div>
          ${(() => { const def = DONORS.find(x => x.id === d.id); return def && def.requireText ? `<div class="pline ok" title="You currently qualify">🔑 ${def.requireText}</div>` : ''; })()}
          <div class="pline warn">Demands: ${demandText(d)}</div>
          <div class="pline quirk">${d.blurb}</div>
          <button class="btn tiny" data-act="court" data-idx="${i}" ${G.influence < courtCost(d) ? 'disabled' : ''}>Court (✦ ${courtCost(d)})</button>${fitTipDonor(d)}
        </div>
      </div>
    </div>`).join('');
  $('#donorDeckCount').textContent = `DECK: ${G.donorDeck.length}`;
}

// ---------- events ----------
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  sfx(act === 'hire' ? 'hire' : act === 'court' || act === 'renew' ? 'court' : act === 'commit' ? 'commit' : 'click');
  if (act === 'mute') { setMuted(!muted); return; }
  if (act === 'netcreate') { netCreate(); return; }
  if (act === 'netjoin') { netJoin(); return; }
  if (act === 'netstart') { netStart(); return; }
  if (act === 'netleave') { if (confirm('Leave this campaign?')) netLeave(); return; }
  if (NET.active && NET_ACTS.has(act)) { if (netConfirm(act, b.dataset)) netAction(act, b.dataset); return; }
  if (NET.active && act === 'newgame') { if (confirm('Leave the online campaign and return to the start screen?')) netLeave(); return; }
  if (NET.active && act === 'restart') { netLeave(); return; }
  if (act === 'pick') newGame(b.dataset.id);
  else if (act === 'continue') { if (load()) { showScreen('game'); render(); } }
  else if (act === 'end') endMonth();
  else if (act === 'hire') actHire(+b.dataset.idx);
  else if (act === 'fire') actFire(b.dataset.kind, +b.dataset.id);
  else if (act === 'court') actCourt(+b.dataset.idx);
  else if (act === 'drop') actDrop(b.dataset.id);
  else if (act === 'prog') actProgram(b.dataset.id);
  else if (act === 'prospect') actProspect(b.dataset.kind);
  else if (act === 'progfocus') actProgFocus(b.dataset.tag);
  else if (act === 'crisischoice') actCrisis(+b.dataset.idx);
  else if (act === 'testify') actTestify(+b.dataset.f, b.dataset.prep === '1');
  else if (act === 'recultivate') actRecultivate(b.dataset.id);
  else if (act === 'letgo') actLetGo(b.dataset.id);
  else if (act === 'matchops') actMatchOps(+b.dataset.id);
  else if (act === 'releaseops') actReleaseOps(+b.dataset.id);
  else if (act === 'oppo') actOppo(b.dataset.target);
  else if (act === 'returnsdone') { $('#returnsWin').classList.add('hidden'); showPaper(G.finalPaper || [], true); }
  else if (act === 'returnsskip') finishReturns();

  else if (act === 'serve') actServe(+b.dataset.id);
  else if (act === 'keep') actKeepScholar(+b.dataset.id);
  else if (act === 'renew') actRenew(b.dataset.id);
  else if (act === 'lapse') actLapse(b.dataset.id);
  else if (act === 'match') actMatch(+b.dataset.id);
  else if (act === 'release') actRelease(+b.dataset.id);
  else if (act === 'commit') actCommit(+b.dataset.f, +b.dataset.s, +b.dataset.amt);
  else if (act === 'closepaper') $('#paper').classList.add('hidden');
  else if (act === 'restart') { clearSave(); $('#paper').classList.add('hidden'); G = null; W = null; renderStart(); showScreen('start'); }
  else if (act === 'newgame') {
    if (!G || confirm('Abandon the current institution and start fresh?')) {
      clearSave(); G = null; W = null; renderStart(); showScreen('start');
    }
  }
  else if (act === 'help') $('#helpWin').classList.toggle('hidden');
  else if (act === 'progwin') $('#progWin').classList.toggle('hidden');
  else if (act === 'tutorial') startTutorial();
  else if (act === 'tutnext') { if (tutStep >= TUTORIAL.length - 1) endTutorial(); else { tutStep++; renderTutorial(); } }
  else if (act === 'tutback') { if (tutStep > 0) { tutStep--; renderTutorial(); } }
  else if (act === 'tutskip') endTutorial();
});

// ---------- online campaigns: several humans, one shared world ----------
// The Worker (worker/src) holds the world and runs the engine; this client
// renders the server's view and forwards actions. See README for the flow.
const NET = { active: false, code: null, pid: null, token: null, monthSeq: -1, paperSeq: 0, timer: null, ended: false, host: false, shownResult: false };
const NET_DEFAULT_URL = 'https://think-tank-tycoon.timhwang.workers.dev';
const NET_ACTS = new Set(['hire', 'fire', 'court', 'drop', 'prog', 'progfocus', 'commit', 'prospect', 'renew', 'lapse', 'match', 'release', 'crisischoice', 'testify', 'serve', 'keep', 'recultivate', 'letgo', 'matchops', 'releaseops', 'oppo']);

function netUrl() { try { return localStorage.getItem('ttt-net-url') || NET_DEFAULT_URL; } catch (e) { return NET_DEFAULT_URL; } }
function netSaveCreds() { try { localStorage.setItem('ttt-net', JSON.stringify({ code: NET.code, pid: NET.pid, token: NET.token })); } catch (e) {} }
function netClearCreds() { try { localStorage.removeItem('ttt-net'); } catch (e) {} }

async function netCall(path, body, method) {
  const opts = { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify({ pid: NET.pid, token: NET.token, ...body });
  const auth = !body && NET.pid ? `?pid=${encodeURIComponent(NET.pid)}&token=${encodeURIComponent(NET.token)}` : '';
  try {
    const r = await fetch(`${netUrl()}/room${path}${auth}`, opts);
    return await r.json();
  } catch (e) {
    return { error: 'The campaign server did not answer. Is it deployed? (' + (e.message || e) + ')' };
  }
}

function netStopPolling() { if (NET.timer) { clearInterval(NET.timer); NET.timer = null; } if (NET.clock) { clearInterval(NET.clock); NET.clock = null; } }

async function netCreate() {
  const name = ($('#netName').value || '').trim() || 'Host';
  const tankId = $('#netTank').value;
  const turnSeconds = +($('#netTurn') ? $('#netTurn').value : 120) || 120;
  const r = await netCall('', { name, tankId, turnSeconds });
  if (r.error) return flash(r.error);
  NET.code = r.code; NET.pid = r.pid; NET.token = r.token; NET.host = true;
  netSaveCreds();
  netLobby();
}

async function netJoin() {
  const name = ($('#netName').value || '').trim() || 'Player';
  const tankId = $('#netTank').value;
  const code = ($('#netCode').value || '').trim().toUpperCase();
  if (code.length !== 5) return flash('Enter the five-letter campaign code.');
  const r = await netCall(`/${code}/join`, { name, tankId });
  if (r.error) return flash(r.error);
  NET.code = code; NET.pid = r.pid; NET.token = r.token; NET.host = false;
  netSaveCreds();
  netLobby();
}

function netLobby() {
  $('#onlineForm').classList.add('hidden');
  $('#lobby').classList.remove('hidden');
  $('#lobbyCode').textContent = NET.code;
  netStopPolling();
  const tick = async () => {
    const v = await netCall(`/${NET.code}`);
    if (v.error) { netStopPolling(); flash(v.error); netLeave(); return; }
    NET.host = v.hostPid === NET.pid;
    $('#lobbyPlayers').innerHTML = v.players.map(p => {
      const t = TANKS.find(x => x.id === p.tankId);
      return `<div class="pline">${iconImg('tank_' + p.tankId, 'sm')} <b>${p.name}</b> · ${t ? t.name : p.tankId}${p.pid === v.hostPid ? ' <span class="chip">HOST</span>' : ''}</div>`;
    }).join('');
    $('#lobbyStart').classList.toggle('hidden', !NET.host);
    $('#lobbyWait').classList.toggle('hidden', NET.host);
    $('#lobbyStart').disabled = v.players.length < 2;
    if (v.phase !== 'lobby') { netStopPolling(); netEnter(v); }
  };
  tick();
  NET.timer = setInterval(tick, 2500);
}

async function netStart() {
  const v = await netCall(`/${NET.code}/start`, {});
  if (v.error) return flash(v.error);
  netStopPolling();
  netEnter(v);
}

function netApplyView(v) {
  G = v.me;
  W = v.world;
  NET.monthSeq = v.monthSeq;
  NET.ended = !!(v.players.find(p => p.pid === NET.pid) || {}).ended;
  const waiting = (v.waiting || []).filter(n => n !== (v.players.find(p => p.pid === NET.pid) || {}).name);
  const wait = $('#waitWin');
  if (NET.ended && v.phase === 'playing') {
    wait.classList.remove('hidden');
    $('#waitNames').textContent = waiting.length ? waiting.join(', ') : 'the server';
  } else wait.classList.add('hidden');
  // the shot clock: the month resolves at the deadline whether or not everyone ended
  if (v.turnSeconds && v.turnStarted && v.phase === 'playing') {
    const remaining = v.turnSeconds * 1000 - ((v.now || Date.now()) - v.turnStarted);
    NET.deadline = Date.now() + Math.max(0, remaining);
    NET.turnSeconds = v.turnSeconds;
  } else NET.deadline = null;
  netTickClock();
  if (!NET.clock) NET.clock = setInterval(netTickClock, 1000);
  const btn = document.querySelector('[data-act="end"]');
  if (btn) { btn.disabled = NET.ended || !!G.over; btn.textContent = NET.ended ? 'WAITING…' : 'END MONTH ▶'; }
}

function netTickClock() {
  const chip = $('#netChip');
  if (!NET.active) { if (chip) chip.textContent = ''; return; }
  let clock = '';
  if (NET.deadline) {
    const left = Math.max(0, Math.round((NET.deadline - Date.now()) / 1000));
    clock = ` · ⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const wc = $('#waitClock');
    if (wc) wc.textContent = `The month resolves in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} regardless.`;
    if (left === 0 && !NET.expiredPoll) { NET.expiredPoll = true; netPoll(); setTimeout(() => { NET.expiredPoll = false; netPoll(); }, 2500); }
  }
  if (chip) chip.textContent = `CAMPAIGN ${NET.code}${clock}`;
}

function netEnter(v) {
  NET.active = true;
  netApplyView(v);
  showScreen('game');
  render();
  if (G.paper && G.paper.length && G.paperSeq !== NET.paperSeq) { NET.paperSeq = G.paperSeq; showPaper(G.paper, false); }
  if (G.electionResult && !NET.shownResult) { NET.shownResult = true; recordRun(G.electionResult.rank, G.electionResult.win); startReturns(standings(), G.finalPaper || []); }
  let seen = false;
  try { seen = !!localStorage.getItem('ttt-tut-seen'); } catch (e) {}
  if (!seen) startTutorial();
  netStopPolling();
  NET.timer = setInterval(netPoll, 3000);
}

async function netPoll() {
  if (!NET.active) return;
  const v = await netCall(`/${NET.code}`);
  if (v.error) return;
  const monthAdvanced = v.monthSeq !== NET.monthSeq;
  netApplyView(v);
  render();
  if (monthAdvanced && G.paper && G.paper.length && G.paperSeq !== NET.paperSeq) { NET.paperSeq = G.paperSeq; showPaper(G.paper, false); }
  if (G.electionResult && !NET.shownResult) { NET.shownResult = true; recordRun(G.electionResult.rank, G.electionResult.win); startReturns(standings(), G.finalPaper || []); }
  if (G.over && !G.electionResult && !NET.shownResult && G.paper) { NET.shownResult = true; showPaper(G.paper, true); }
}

async function netAction(type, ds) {
  if (NET.ended) return flash('You already ended this month — waiting on the others.');
  const args = { idx: ds.idx, id: ds.id, kind: ds.kind, f: ds.f, s: ds.s, amt: ds.amt, tag: ds.tag, target: ds.target, prep: ds.prep };
  const v = await netCall(`/${NET.code}/action`, { type, args });
  if (v.error) flash(v.error);
  if (v.me) { netApplyView(v); render(); }
}

async function netEndMonth() {
  const v = await netCall(`/${NET.code}/end`, {});
  if (v.error) { flash(v.error); if (v.me) { netApplyView(v); render(); } return; }
  const monthAdvanced = v.monthSeq !== NET.monthSeq;
  netApplyView(v);
  render();
  if (monthAdvanced && G.paper && G.paper.length && G.paperSeq !== NET.paperSeq) { NET.paperSeq = G.paperSeq; showPaper(G.paper, false); }
  if (G.electionResult && !NET.shownResult) { NET.shownResult = true; recordRun(G.electionResult.rank, G.electionResult.win); startReturns(standings(), G.finalPaper || []); }
}

async function netLeave() {
  if (NET.code && NET.pid) netCall(`/${NET.code}/leave`, {});
  netStopPolling();
  netClearCreds();
  Object.assign(NET, { active: false, code: null, pid: null, token: null, monthSeq: -1, paperSeq: 0, ended: false, host: false, shownResult: false, deadline: null });
  const chip = $('#netChip'); if (chip) chip.textContent = '';
  G = null; W = null;
  $('#onlineForm').classList.remove('hidden');
  $('#lobby').classList.add('hidden');
  $('#waitWin').classList.add('hidden');
  renderStart();
  showScreen('start');
}

// a previous session in this browser: rejoin where we left off
async function netResume() {
  let creds = null;
  try { creds = JSON.parse(localStorage.getItem('ttt-net') || 'null'); } catch (e) {}
  if (!creds || !creds.code) return;
  Object.assign(NET, creds);
  const v = await netCall(`/${NET.code}`);
  if (v.error) { netClearCreds(); Object.assign(NET, { code: null, pid: null, token: null }); return; }
  if (v.phase === 'lobby') netLobby(); else netEnter(v);
}

// confirmations the server can't ask for
function netConfirm(act, ds) {
  if (act === 'fire') { const list = ds.kind === 'scholar' ? G.scholars : G.ops; const p = list.find(x => x.id === +ds.id); return !p || confirm(`Let ${p.name} go? Severance ${fmtMoney(p.salary * TUNE.severanceMonths)}.`); }
  if (act === 'drop') { const d = G.donors.find(x => x.id === ds.id); return !d || confirm(`Part ways with ${d.name}? Their ${fmtMoney(d.grant)}/mo goes with them.`); }
  if (act === 'match') { const s = G.scholars.find(x => x.id === +ds.id); return !s || !s.poach || confirm(`Match ${s.poach.by}'s offer? Salary rises to ${fmtMoney(s.poach.salary)}/mo, permanently.`); }
  if (act === 'release') return confirm('Let them walk to the rival?');
  if (act === 'prog') { const p = PROGRAMS.find(x => x.id === ds.id); return !p || !p.once || G.programs[p.id] || confirm(`Commit ${fmtMoney(p.once)} to the ${p.name}? This is permanent.`); }
  return true;
}

// ---------- tutorial (first game, and on demand) ----------
const TUTORIAL = [
  { sel: '.topbar', title: 'THE TOP BAR',
    body: '<p>Your dashboard. <b>TREASURY</b> is cash and your net monthly flow. <b>INFLUENCE</b> (✦) is what scholars mint each month — and what you spend on fights and donors. <b>STAFF</b> shows how many scholars your ops can support.</p><p>The <b>DATE</b> counts down to Election Night, November 2028. <b>END MONTH ▶</b> advances the clock; everything resolves then. <b>?</b> reopens the rules.</p>' },
  { sel: '.rowtop > .window:nth-child(1)', title: 'POLICY FIGHTS',
    body: '<p>The arena. Four fights are live at any time. Commit ✦ to a side with <b>+5</b> / <b>+25</b>; the bar and percentages show <b>live win odds</b>. The ⚑ lines show who is backing each side and with how much.</p><p>When the ⏳ clock hits zero the wire rolls — and the <b>victory goes to the winning side\'s single top contributor</b>. ★ marks fights where your bench earns a bonus; <b>⚠ no bench</b> warns that a loss there demoralizes everyone.</p>' },
  { sel: '.rowtop > .window:nth-child(2)', title: 'HIRING MARKET',
    body: '<p>Candidates rotate monthly. <b>Scholars</b> mint ✦ — their tag is their expertise, their lean sets partisan pricing (the ▼/▲ tips show exactly how much). <b>Ops</b> either support scholars (capacity on the card) or are specialists with one function.</p><p>Read the numbers: some deals are bad on purpose. <b>PROSPECT</b> re-deals the market for a rising price.</p>' },
  { sel: '.rowtop > .window:nth-child(3)', title: 'DONOR MARKET',
    body: '<p>Court donors with ✦; they pay monthly grants on a cycle. Every donor has a <b>DEMAND</b> — a scholar on staff, a program running, monthly influence in their pet issue, or ideological purity. Unmet demands earn strikes; two strikes and they walk.</p><p>Perks and flaws are called out on the card. A few blue-chip patrons only appear once your existing base qualifies.</p>' },
  { sel: '.rowbottom > .window:nth-child(1)', title: 'YOUR INSTITUTION',
    body: '<p>Your roster: <b>SCHOLARS</b> grouped by specialty (when you are over capacity, the earliest hires keep ops coverage), <b>OPERATIONS</b>, and your <b>DONORS</b> with demands, strikes and cycle countdowns.</p><p>Renewal offers and rival poach bids appear on these cards — answer them before the month ends. <b>PROGRAMS</b> opens vanity programs and long-term investments.</p>' },
  { sel: '.rowbottom > .window:nth-child(2)', title: 'HQ REPORT',
    body: '<p>Your books and the race. The monthly <b>ledger</b>; <b>DONOR CONFIDENCE</b> — a shaky base throws strikes, so grow only as fast as your development staff can steward; and the <b>LEADERBOARD</b> — rank, lean, victories, monthly spend.</p><p>Bank the most victories by Election Night to win.</p>' },
  { sel: '#bugleWin', title: 'THE BELTWAY BUGLE',
    body: '<p>The paper of record. The ticker logs everything you do. At month\'s end the front page reports resolutions (with their rolls), departures, raises, and the occasional <b>EXTRA</b> — a crisis you must decide before play continues.</p><p>Six months out it announces Election Season. Then, one November night, it prints the verdict.</p>' },
  { sel: null, title: 'THE ASSIGNMENT',
    body: '<p><b>Scholars mint influence; influence wins fights and courts donors; donors fund scholars.</b> Every point spent on glory is a point not invested in the machine — and the town hates a winner.</p><p>Twenty-two months. Go.</p>' },
];
let tutStep = -1;

function startTutorial() { tutStep = 0; renderTutorial(); }

function endTutorial() {
  tutStep = -1;
  renderTutorial();
  try { localStorage.setItem('ttt-tut-seen', '1'); } catch (e) {}
}

function renderTutorial() {
  document.querySelectorAll('.tut-focus').forEach(e => e.classList.remove('tut-focus'));
  const win = $('#tutorialWin');
  if (tutStep < 0) { win.classList.add('hidden'); return; }
  const st = TUTORIAL[tutStep];
  if (st.sel) {
    const el = document.querySelector(st.sel);
    if (el && el.classList) {
      el.classList.add('tut-focus');
      if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
  $('#tutTitle').textContent = `${st.title} · ${tutStep + 1}/${TUTORIAL.length}`;
  $('#tutBody').innerHTML = st.body;
  $('#tutBack').disabled = tutStep === 0;
  $('#tutNext').textContent = tutStep === TUTORIAL.length - 1 ? 'Start Playing ▶' : 'Next ▶';
  win.classList.remove('hidden');
}

// ---------- instant tooltips ----------
// native title tooltips need a ~1s motionless hover; replace them all with
// an immediate Win95-style tip box
const tipBox = document.createElement('div');
tipBox.id = 'tooltip';
tipBox.className = 'hidden';
document.body.appendChild(tipBox);

document.addEventListener('mouseover', e => {
  const t = e.target.closest('[data-tip], [title]');
  if (!t) { tipBox.classList.add('hidden'); return; }
  if (t.getAttribute('title')) { // migrate so the native tooltip never doubles up
    t.dataset.tip = t.getAttribute('title');
    t.removeAttribute('title');
  }
  if (!t.dataset.tip) { tipBox.classList.add('hidden'); return; }
  tipBox.textContent = t.dataset.tip;
  tipBox.classList.remove('hidden');
  const r = t.getBoundingClientRect();
  const w = tipBox.offsetWidth;
  tipBox.style.left = Math.max(4, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
  tipBox.style.top = (r.bottom + 6 + tipBox.offsetHeight > window.innerHeight
    ? r.top - tipBox.offsetHeight - 6 : r.bottom + 6) + 'px';
});
document.addEventListener('scroll', () => tipBox.classList.add('hidden'), true);

// ---------- boot ----------
renderStart();
showScreen('start');
if (typeof fetch === 'function' && typeof location !== 'undefined') netResume();
