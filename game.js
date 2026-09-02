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
let G = null;
let uid = 1;
const SAVE_KEY = 'ttt-save-v1';

function tank() { return TANKS.find(t => t.id === G.tankId); }

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
  const sch = {
    id: uid++, kind: 'scholar', name, big, lean, diva,
    tag: pick(TAGS), salary: salary + (big ? 15 : 0) + (diva ? ri(10, 16) : 0), out,
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
  if (!starter && G && G.rivals && G.rivals.length && Math.random() < TUNE.raidChance) {
    sch.from = pick(G.rivals).short;
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
  });
  const rivals = TANKS.filter(t => t.id !== chosenId).map(mk);
  NPC_TANKS.forEach(t => rivals.push(mk(t)));
  return rivals;
}

function mkDonorInstance(defId) {
  const d = DONORS.find(x => x.id === defId);
  const inst = {
    ...d, demand: { ...d.demand }, strikes: 0, joined: G ? G.month : 0,
    grant: Math.round(d.grant * TUNE.grantMult),
    term: ri(TUNE.grantTermMin, TUNE.grantTermMax),
  };
  if (d.perk === 'anchor') inst.term = undefined; // never sunsets
  return inst;
}

function drawFightInto() { const n = G.fights.length; drawFight(); return G.fights.length > n; }

function drawFight() {
  if (!G.fightDeck.length) {
    const active = new Set(G.fights.map(f => f.defId));
    G.fightDeck = shuffle(FIGHTS.map(f => f.id).filter(id => !active.has(id)));
  }
  const defId = G.fightDeck.pop();
  const def = FIGHTS.find(f => f.id === defId);
  const r = def.reward;
  G.fights.push({
    defId, type: def.type, tag: def.tag,
    reward: { cash: Math.round((r.cash || 0) * TUNE.fightCashMult), inf: r.inf || 0, special: r.special || null },
    title: def.title.replace('{NOM}', genName(true)),
    monthsLeft: def.months,
    sides: def.sides.map(s => ({ label: s.label, lean: s.lean, total: 0, yours: 0, rivals: {} })),
    rivalPicks: {}, crossed: {},
  });
}

function donorEligible(id) {
  const def = DONORS.find(d => d.id === id);
  return !def.require || def.require(G);
}

function drawDonorToMarket() {
  if (!G.donorDeck.length) {
    const unavailable = new Set([...G.donors.map(d => d.id), ...G.donorMarket.map(d => d.id)]);
    G.donorDeck = shuffle(DONORS.map(d => d.id).filter(id => !unavailable.has(id)));
    if (!G.donorDeck.length) return false; // literally everyone already funds you
  }
  // skip prerequisite donors whose gate the current base doesn't clear;
  // set them aside so they can reappear once you qualify
  const held = [];
  let id;
  while ((id = G.donorDeck.pop()) !== undefined) {
    if (donorEligible(id)) { G.donorMarket.push(mkDonorInstance(id)); G.donorDeck.unshift(...held); return true; }
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
function newGame(tankId) {
  const t = TANKS.find(x => x.id === tankId);
  G = {
    tankId, month: 0, cash: t.cash, influence: t.influence,
    scholars: [], ops: [], donors: [], programs: {},
    fights: [], hireMarket: [], donorMarket: [],
    fightDeck: shuffle(FIGHTS.map(f => f.id)),
    donorDeck: shuffle(DONORS.map(d => d.id).filter(id => !t.donors.includes(id))),
    rivals: buildRivals(tankId),
    log: [], negStreak: 0, over: false, monthCommits: {}, progMonths: {}, prospects: {},
    crisis: null, usedCrises: [], freeze: 0, v: 2,
    confidence: TUNE.confStart, confLog: [], courtsThisMonth: 0,
    allies: {}, pendingNews: [],
    stats: { months: 0, won: 0, lost: 0, peakCash: t.cash },
  };
  PROGRAMS.forEach(p => G.programs[p.id] = false);
  for (let i = 0; i < t.scholars; i++) G.scholars.push(genScholar(true));
  for (let i = 0; i < t.ops; i++) G.ops.push(genOps(true));
  t.donors.forEach(id => G.donors.push(mkDonorInstance(id)));
  rollChaos();
  while (G.fights.length < TUNE.fightSlots) drawFight();
  while (G.donorMarket.length < TUNE.donorSlots && drawDonorToMarket()) {}
  while (G.hireMarket.length < TUNE.hireSlots) drawHire();
  logLine(`${t.name} opens its doors. Motto: “${t.motto}”`);
  save();
  showScreen('game');
  render();
  let seen = false;
  try { seen = !!localStorage.getItem('ttt-tut-seen'); } catch (e) {}
  if (!seen) startTutorial();
}

// ---------- derived numbers ----------
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
      const r = pick(G.rivals);
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
  s.tapped = { deadline: G.month + 1, post: pick(GOV_POSTS).replace('{TAG}', TAG_NAMES[s.tag]) };
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
  return f.monthsLeft <= 1 && !f.testimony && f.sides.some(s => s.yours > 0) && G.scholars.some(s => s.tag === f.tag);
}

function bestWitness(tag) {
  return [...G.scholars].filter(s => s.tag === tag).sort((a, b) => b.out - a.out)[0];
}

function actTestify(fi) {
  const f = G.fights[fi];
  if (!f || !testimonyReady(f)) return;
  const s = bestWitness(f.tag);
  const side = f.sides[0].yours >= f.sides[1].yours ? f.sides[0] : f.sides[1];
  const p = Math.max(0.35, Math.min(0.9, TUNE.testifyBase + s.out / 100 + (quirkId(s) === 'veteran' ? 0.15 : 0)));
  const ok = Math.random() < p;
  G.pendingNews = G.pendingNews || [];
  { const R = rec(); R.testimonies++; if (ok) R.testimonyWins++; }
  if (ok) {
    const eff = Math.round(s.out * 1.5);
    side.total += eff; side.yours += eff;
    G.monthCommits = G.monthCommits || {}; G.monthCommits[f.tag] = (G.monthCommits[f.tag] || 0) + eff;
    f.testimony = { who: s.name, ok: true, eff };
    G.pendingNews.push({ h: `${s.name.toUpperCase()} COMMANDS THE HEARING ROOM`, s: `Members quoted the testimony back to each other. +${eff} to “${side.label}” on ${f.title}.` });
    logLine(`📣 ${s.name} testified on ${f.title}: +${eff} (${Math.round(p * 100)}% odds).`);
  } else {
    const cut = Math.round(side.yours * 0.25);
    side.yours -= cut; side.total -= cut;
    s.mope = Math.max(s.mope || 0, 1);
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
  const f = G.fights[G.fights.length - 1];
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
  G.confLog.unshift({ m: G.month, d: applied, why });
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
    const onBoard = G.fights.some(f => f.tag === dm.tag);
    return pushed >= dm.amt || !onBoard; // forgiven when their issue isn't up
  }
  return true; // NOCROSS strikes are event-driven at commit time
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

function courtCost(d) {
  const connector = G.ops.some(o => o.trait && o.trait.id === 'court') ? 0.9 : 1;
  const devdir = Math.pow(0.85, specCount('devdir'));
  const band = confBand().id;
  const mood = band === 'confident' ? 0.95 : (band === 'spooked' || band === 'exodus') ? 1.25 : 1;
  const recess = calendarOf(G.month) === 'august' ? 0.8 : 1; // gala season: everyone's at the beach, and buyable
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
function winProbA(f) {
  const a = f.sides[0].total, b = f.sides[1].total;
  if (a === 0 && b === 0) return 0.5;
  const pa = Math.pow(a, TUNE.contestK), pb = Math.pow(b, TUNE.contestK);
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
    const r = G.rivals.find(x => x.short === h.from);
    if (r) r.budget = Math.max(TUNE.raidMinBudget, r.budget - TUNE.raidBudgetHit);
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
  d.joined = G.month;
  // jealous patrons resent a new courtship
  G.donors.filter(x => x.flaw === 'jealous' && !x.lapsing).forEach(x => {
    x.strikes++;
    logLine(`${x.name} is jealous of your new courtship of ${d.name}. Strike ${x.strikes}.`);
  });
  G.donors.push(d);
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
  d.joined = G.month;
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
  const r = G.rivals.find(x => x.short === s.poach.by);
  if (r) r.budget += TUNE.poachRivalGain;
  G.scholars = G.scholars.filter(x => x !== s);
  logLine(`Let ${s.name} walk to ${s.poach.by}. Their budget swells to ~${r ? r.budget : '?'}/mo.`);
  save(); render();
}

function actCommit(fightIdx, sideIdx, amt) {
  const f = G.fights[fightIdx];
  if (!f) return;
  const side = f.sides[sideIdx];
  amt = Math.min(amt, G.influence);
  if (amt <= 0) return flash('No influence to spend. Scholars make it monthly.');
  const angry = angeredBy(f, side);
  if (angry.length) {
    const names = angry.map(d => d.name).join(', ');
    if (!confirm(`Backing “${side.label}” will anger: ${names} (+1 strike each). Proceed?`)) return;
    angry.forEach(d => {
      d.strikes++;
      f.crossed[d.id] = true;
      logLine(`${d.name} is displeased by your position on ${f.title}. (${d.strikes}/${TUNE.strikeLimit} strikes)`);
    });
  }
  G.influence -= amt;
  const eff = Math.round(amt * expertiseMult(f.tag));
  side.total += eff;
  side.yours += eff;
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
  shutdown: () => G.fights.length > 0 && !(G.freeze > 0),
  recess: () => G.fights.some(f => f.monthsLeft > 1),
  galafire: () => !!G.programs.gala,
  hack: () => G.ops.length >= 1,
  plagiarism: () => G.scholars.length >= 1,
  revolt: () => G.cash < 300,
  smear: () => true,
  center: () => G.donors.some(d => !d.lapsing) && G.cash > 250,
  union: () => G.ops.length >= 1,
};

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
      rival: pick(G.rivals).short,
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
  G.crisis = c;
  news.push({ h: `BUGLE EXTRA: ${crisisSub(def.title)}`, s: 'A decision is required before next month can begin.' });
  logLine(`CRISIS: ${crisisSub(def.title)} — decide before the next END MONTH.`);
}

function forceCrisis(id, news) {
  const def = CRISES.find(c => c.id === id);
  if (!def) return;
  G.crisis = { id, t: { rival: pick(G.rivals).short }, n: { RIVAL: pick(G.rivals).short } };
  news.push({ h: `BUGLE EXTRA: ${def.title}`, s: 'A decision is required before next month can begin.' });
  logLine(`CRISIS: ${def.title} — decide before the next END MONTH.`);
  sfx('crisis');
}

function crisisSub(text) {
  if (!G.crisis) return text;
  return text.replace(/\{(SCHOLAR|TOP|DIVA|OPS|DONOR_B|DONOR|RIVAL)\}/g, (m, k) => G.crisis.n[k] || '(someone)');
}

const CRISIS_FX = {
  oped: [
    c => { const s = G.scholars.find(x => x.id === c.t.scholar); const lean = s ? (s.lean || 0) : 0;
      const angry = lean !== 0 ? G.donors.filter(d => d.lean * lean < 0) : shuffle(G.donors).slice(0, 2);
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
    () => { G.freeze = 1; return 'The Hill goes dark for a month.'; },
    () => { G.freeze = 1; G.influence += 20; return 'The Hill goes dark; your panels mint ✦20.'; },
  ],
  recess: [
    () => { G.fights.forEach(f => f.monthsLeft = Math.min(f.monthsLeft, 1)); return 'Everything resolves at the next END MONTH.'; },
    () => { G.fights.forEach(f => f.monthsLeft = Math.min(f.monthsLeft, 1)); G.influence += 15; return 'Everything resolves next month; the scramble mints ✦15.'; },
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
    () => { G.fights.forEach(f => f.sides.forEach(s => { const cut = Math.ceil(s.yours * 0.2); s.yours -= cut; s.total -= cut; })); return 'Your standing commitments erode 20% across the board.'; },
    c => { const r = G.rivals.find(x => x.short === c.t.rival); if (r) r.budget = Math.max(TUNE.raidMinBudget, r.budget - 3); return `Counter-oppo lands: ${c.n.RIVAL}'s budget takes a permanent −3.`; },
  ],
  center: [
    c => { const d = G.donors.find(x => x.id === c.t.donor); if (d) { d.grant += 30; d.term = (d.term || 18) + 6; } return `The ${c.n.DONOR} Center opens. The plaque is enormous; the grant grows ${fmtMoney(30)}/mo.`; },
    c => { const d = G.donors.find(x => x.id === c.t.donor); if (d) d.strikes++; return `${c.n.DONOR} takes offense.`; },
  ],
  endorse: [
    () => { G.influence += 40; const sign = Math.sign(tank().align);
      const angry = sign ? G.donors.filter(d => d.lean * sign < 0 && !d.lapsing) : shuffle(activeDonors()).slice(0, 2);
      angry.forEach(d => d.strikes++);
      return `Your name is on the letter. ✦40 of relevance; ${angry.length} donor${angry.length === 1 ? '' : 's'} across the aisle took a strike.`; },
    () => { G.influence += 25; const d = pick(activeDonors()); if (d) d.strikes++;
      return `You backed the insurgent: ✦25, and ${d ? d.name : 'a donor'} is nervous about it.`; },
    () => { bumpConf(4, 'stayed above the primary'); return 'You stayed above it. The base approves; the campaigns forget you exist.'; },
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

function rivalCommits() {
  const hot = playerLeadsBoard();
  const drift = 1 + TUNE.rivalDriftPct * G.month;
  G.rivals.forEach(r => {
    const targets = [];
    G.fights.forEach(f => {
      let sideIdx = -1;
      const pet = f.tag && r.tags.includes(f.tag);
      const pref = f.sides.findIndex(s => s.lean * r.align > 0);
      if (pref >= 0) sideIdx = pref;
      else if (pet) {
        if (f.rivalPicks[r.short] === undefined) f.rivalPicks[r.short] = ri(0, 1);
        sideIdx = f.rivalPicks[r.short];
      }
      // focused shops sit out fights that aren't their issue (decided once)
      if (sideIdx >= 0 && !pet) {
        f.rivalSkips = f.rivalSkips || {};
        if (f.rivalSkips[r.short] === undefined) f.rivalSkips[r.short] = Math.random() < TUNE.rivalFocus ? 1 : 0;
        if (f.rivalSkips[r.short]) sideIdx = -1;
      }
      if (sideIdx >= 0) {
        // everyone piles in as the vote nears — last-month sniping meets a wall
        const closing = f.monthsLeft <= 1 ? TUNE.rivalCloserMult : f.monthsLeft === 2 ? 1.5 : 1;
        // and the town gangs up on a frontrunner: extra weight against sides
        // the leader currently tops
        const opp = f.sides[1 - sideIdx];
        const oppTopRival = Math.max(0, ...Object.values(opp.rivals || {}));
        const counter = hot && opp.yours > 0 && opp.yours >= oppTopRival ? TUNE.counterBidMult : 1;
        const marquee = f.marquee ? 1.5 : 1;
        targets.push({ f, sideIdx, w: (r.tags.includes(f.tag) ? 2 : 1) * closing * counter * marquee });
      }
    });
    if (!targets.length) return;
    const seasonal = G.month >= TUNE.electionSeasonStart ? TUNE.electionSeasonMult : 1;
    const heat = hot ? TUNE.frontrunnerMult : 1;
    const budget = Math.round(r.budget * drift * seasonal * heat * (0.75 + Math.random() * 0.5));
    const wSum = targets.reduce((a, t) => a + t.w, 0);
    targets.forEach(t => {
      const amt = Math.floor(budget * t.w / wSum);
      if (amt > 0) {
        const s = t.f.sides[t.sideIdx];
        s.total += amt;
        s.rivals = s.rivals || {};
        s.rivals[r.short] = (s.rivals[r.short] || 0) + amt;
      }
    });
  });
}

// ---------- month end ----------
function endMonth() {
  if (G.over) return;
  if (G.crisis) { flash('The Bugle EXTRA is waiting — resolve the crisis first.'); renderCrisis(); return; }
  const news = [...(G.pendingNews || [])];
  G.pendingNews = [];
  G.stats.months++;

  // 1. rivals pile on
  rivalCommits();

  // 2. clocks tick; fights resolve (unless a shutdown froze the Hill)
  if (G.freeze > 0) {
    G.freeze--;
    news.push({ h: 'THE HILL IS DARK', s: 'Shutdown month: no clocks tick, nothing resolves. Everyone keeps piling money on regardless.' });
    logLine('Shutdown: fight clocks frozen this month.');
  } else {
    G.fights.forEach(f => f.monthsLeft--);
    G.fights.filter(f => f.monthsLeft <= 0).forEach(f => resolveFight(f, news));
    G.fights = G.fights.filter(f => f.monthsLeft > 0);
  }

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
    } else if (d.term !== undefined && G.month - d.joined >= d.term - 1) {
      d.lapsing = true;
      news.push({ h: `${d.name.toUpperCase()} GRANT CYCLE ENDING`, s: `Renew within the month — on stricter terms, for ✦${renewCost(d)} — or the ${fmtMoney(d.grant)}/mo sunsets.` });
      logLine(`${d.name}'s cycle is ending: renew (stricter terms) or let it lapse.`);
    }
  });
  G.donors = G.donors.filter(d => !gone.includes(d));

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
    bumpConf(TUNE.confWalk, `${d.name} walked`);
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
  G.scholars.filter(s => s.tapped && s.tapped.deadline <= G.month).forEach(s => serveInGovernment(s, news));
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

  // 6.53 junior fellows pipeline: every 6th active month, one becomes real
  if (G.programs.fellows) {
    G.progMonths = G.progMonths || {};
    G.progMonths.fellows = (G.progMonths.fellows || 0) + 1;
    if (G.progMonths.fellows % 6 === 0) {
      const jr = genScholar(true);
      jr.salary = ri(10, 14); jr.out = ri(8, 12); jr.big = false; jr.diva = false;
      jr.quirk = 'Was, until recently, named Tyler.';
      G.scholars.push(jr);
      news.push({ h: `JUNIOR FELLOW ${jr.name.toUpperCase()} PROMOTED TO ACTUAL SCHOLAR`, s: `${TAG_NAMES[jr.tag]}, ✦${jr.out}/mo, ${fmtMoney(jr.salary)}/mo. The program yields again.` });
      logLine(`Junior Fellows Program graduates ${jr.name} (${TAG_NAMES[jr.tag]}).`);
    }
  }

  // 6.55 unresolved poach bids: the scholar takes the offer
  G.scholars.filter(s => s.poach && s.poach.deadline <= G.month).forEach(s => {
    const r = G.rivals.find(x => x.short === s.poach.by);
    if (r) r.budget += TUNE.poachRivalGain;
    G.scholars = G.scholars.filter(x => x !== s);
    news.push({ h: `${s.name.toUpperCase()} DEFECTS TO ${s.poach.by.toUpperCase()}`, s: `The offer sat unanswered. Their new business cards are already printed.` });
    logLine(`${s.name} defected to ${s.poach.by} — the bid went unmatched.`);
  });

  // 6.56 a rival makes a run at one of your scholars
  if (G.scholars.length >= 2 && !G.scholars.some(s => s.poach) && Math.random() < TUNE.poachChance) {
    const target = pick([...G.scholars].sort((a, b) => b.out - a.out).slice(0, 3));
    const rival = pick(G.rivals);
    const offer = Math.ceil(target.salary * (1 + ri(25, 40) / 100));
    target.poach = { by: rival.short, salary: offer, deadline: G.month + 1 };
    news.push({ h: `${rival.short.toUpperCase()} MAKES A RUN AT ${target.name.toUpperCase()}`, s: `They're offering ${fmtMoney(offer)}/mo (currently ${fmtMoney(target.salary)}). Match it from the staff panel, or lose them next month.` });
    logLine(`${rival.short} is courting ${target.name} at ${fmtMoney(offer)}/mo — match or let them walk.`);
  }

  // 6.6 annual reviews: every December, payroll ratchets up
  if ((G.month + 1) % 12 === 0) {
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

  // 7.5 the leaderboard has a story: lead changes make the paper
  {
    const top = standings()[0];
    const leader = top.v > 0 ? top.short : null;
    if (leader && leader !== G.leaderShort) {
      if (top.you) news.push({ h: `${tank().short.toUpperCase()} TAKES THE LEAD`, s: `${top.v} victories banked. Enjoy it: the whole town now spends harder against the favorite.` });
      else news.push({ h: `${leader.toUpperCase()} SEIZES THE LEAD`, s: `${top.v} victories banked. Their press release uses the word “momentum” four times.` });
      logLine(`Leaderboard: ${leader} now leads with ${top.v}.`);
    }
    G.leaderShort = leader;
  }

  // 7.6 rivals do rival things
  if (Math.random() < 0.35) {
    const r = pick(G.rivals), mv = pick(RIVAL_MOVES);
    news.push({ h: mv.h.replace('{RIVAL}', r.short.toUpperCase()), s: mv.s.replace('{RIVAL}', r.short) });
  }

  // 8. refresh markets (August recess: the Hill draws no new fights)
  const nextEvent = calendarOf(G.month + 1);
  if (G.hireMarket.length) G.hireMarket.shift();
  while (G.hireMarket.length < TUNE.hireSlots) drawHire();
  if (Math.random() < 0.4 && G.donorMarket.length) {
    const gone = G.donorMarket.shift();
    G.donorDeck.unshift(gone.id);
  }
  while (G.donorMarket.length < TUNE.donorSlots && drawDonorToMarket()) {}
  if (nextEvent === 'august') {
    news.push({ h: 'AUGUST RECESS: THE TOWN EMPTIES', s: 'No new fights reach the board this month. Everyone who matters is at a beach house with a donor — courting runs 20% cheaper.' });
    logLine('August recess: no new fights; courting −20% this month.');
  } else {
    while (G.fights.length < TUNE.fightSlots) drawFight();
  }

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
  G.month++;
  G.stats.peakCash = Math.max(G.stats.peakCash, G.cash);
  if (G.month >= TUNE.electionMonth) { electionDay(news); return; }
  if (G.month === TUNE.electionSeasonStart) {
    news.unshift({ h: 'ELECTION SEASON BEGINS — SIX MONTHS TO THE VOTE', s: `Every institution in town opens its war chest: rival influence spending runs ${Math.round((TUNE.electionSeasonMult - 1) * 100)}% hotter from here to Election Night. Fights get louder, credit gets pricier, and the leaderboard is watching. Plan accordingly.`, big: true });
    logLine('ELECTION SEASON: rival spending +50% until the vote.');
    sfx('season');
  }
  // the calendar turns
  const evt = calendarOf(G.month);
  if (evt === 'sotu') drawMarqueeFight(news);
  if (evt === 'offyear') {
    const rows = standings().slice(0, 3).map((r, i) => `${i + 1}. ${r.short} — ${r.v}`).join('  ·  ');
    news.push({ h: 'ONE YEAR OUT: THE STANDINGS', s: `Off-year elections come and go; the town checks the only scoreboard it cares about. ${rows}.` });
  }
  if (evt === 'primaries' && !G.crisis) forceCrisis('endorse', news);
  save(); render();
  if (news.length) showPaper(news);
}

function resolveFight(f, news) {
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
  let sub = `“${winner.label}” prevails ${winner.total}–${loser.total} — a ${winProb}% shot${upset ? ', and the town is stunned' : ''}.`;

  // the victory is banked by whoever carried the winning side hardest
  let topRival = null, topAmt = 0;
  Object.entries(winner.rivals || {}).forEach(([short, amt]) => {
    if (amt > topAmt) { topAmt = amt; topRival = short; }
  });
  const playerBanks = winner.yours > 0 && winner.yours >= topAmt; // ties go to you
  if (playerBanks) {
    G.stats.won++;
    bumpConf(TUNE.confWin, `banked ${f.title.split(':')[0].slice(0, 28)}`);
    const R = rec(); R.wonByTag[f.tag] = (R.wonByTag[f.tag] || 0) + 1;
    if (!R.bestUpset || winProb < R.bestUpset.prob) R.bestUpset = { title: f.title, prob: winProb };
  } else if (topRival) {
    const r = G.rivals.find(x => x.short === topRival);
    if (r) { r.victories = (r.victories || 0) + 1; r.vByTag = r.vByTag || {}; r.vByTag[f.tag] = (r.vByTag[f.tag] || 0) + 1; }
  }
  if (loser.yours > 0) {
    const R = rec();
    const lp = 100 - winProb; // odds the losing side (yours) had
    if (lp >= 75) R.favoredLosses++;
    if (!R.worstBeat || lp > R.worstBeat.prob) R.worstBeat = { title: f.title, prob: lp };
  }
  const creditLine = playerBanks ? `${tank().short} banks the victory.`
    : topRival ? `${topRival} banks the victory.` : 'Nobody in particular claims it.';

  if (winner.yours > 0) {
    G.scholars.forEach(s => { if (s.tag === f.tag && s.mope > 0) { s.mope = 0; logLine(`${s.name} is buoyed by the ${f.tag} win — morale restored.`); } });
  }

  if (winner.yours > 0) {
    const share = winner.total > 0 ? winner.yours / winner.total : 1;
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
    }
    sub += ` ${creditLine} The spoils: ${gains.join('; ')}.`;
    news.push({ h: `${upset ? 'UPSET: ' : ''}${f.title.toUpperCase()}${playerBanks ? ` — VICTORY FOR ${tank().short.toUpperCase()}` : ' — RESOLVED'}`, s: sub, big: playerBanks, meter });
    logLine(`${playerBanks ? 'VICTORY BANKED' : 'Backed the winner'}: ${f.title} → ${gains.join('; ')} (${Math.round(share * 100)}% of the winning side).`);
  } else if (loser.yours > 0) {
    G.stats.lost++;
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
    sub += ` ${creditLine} ${tank().short} spent ${loser.yours} influence on the losing side. A fellow calls it “directionally correct.”`;
    news.push({ h: `${upset ? 'UPSET: ' : ''}${f.title.toUpperCase()} — RESOLVED`, s: sub, meter });
    logLine(`LOSS: ${f.title}. ${loser.yours} influence down the drain.`);
  } else {
    news.push({ h: `${upset ? 'UPSET: ' : ''}${f.title.toUpperCase()} — RESOLVED`, s: `${sub} ${creditLine} You watched from the sidelines.`, meter });
    logLine(`${f.title} resolved without you. ${creditLine}`);
  }
}

// ---------- campaign recap bookkeeping ----------
function rec() { G.recap = G.recap || { wonByTag: {}, donorsLost: 0, scholarsLost: 0, crises: 0, monthsLed: 0, noBench: 0, testimonies: 0, testimonyWins: 0, favoredLosses: 0, minConf: 100 }; return G.recap; }

function standings() {
  const rows = [
    { short: tank().short, name: tank().name, v: G.stats.won, you: true, align: tank().align },
    ...G.rivals.map(r => ({ short: r.short, name: r.name, v: r.victories || 0, you: false, align: r.align })),
  ];
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
    const r = G.rivals.find(x => x.short === top.short);
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
  // moments
  const moments = [];
  if (R.bestUpset) moments.push(`Best upset: ${R.bestUpset.title} at ${R.bestUpset.prob}%`);
  if (R.worstBeat && R.worstBeat.prob >= 60) moments.push(`Worst beat: ${R.worstBeat.title}, lost as a ${R.worstBeat.prob}% favorite`);
  if (R.testimonies) moments.push(`Testimony: ${R.testimonyWins}/${R.testimonies}`);
  const allies = Object.entries(G.allies || {});
  if (allies.length) moments.push(`Allies in government: ${allies.map(([t, n]) => `${t} ×${n}`).join(', ')}`);
  const mvp = [...G.donors].sort((a, b) => (b.paid || 0) - (a.paid || 0))[0];
  if (mvp && mvp.paid) moments.push(`Most valuable donor: ${mvp.name} (${fmtMoney(mvp.paid)} over the campaign)`);
  if (moments.length) items.push({ h: 'MOMENTS', s: moments.join(' · ') });
  // titles
  const titles = [];
  if (win && R.monthsLed <= 3) titles.push('THE SANDBAGGER (won from behind)');
  if (R.noBench >= 2) titles.push('AMATEUR HOUR (lost twice outside your lanes)');
  if (G.scholars.some(s => s.diva)) titles.push('DIVA WHISPERER (finished with a diva on staff)');
  if (G.programs.wing) titles.push('LANDLORD (bought the annex)');
  if (allies.reduce((a, [, n]) => a + n, 0) >= 2) titles.push('REVOLVING DOOR (two or more scholars in government)');
  if (R.minConf >= 60) titles.push('IRON DEVELOPMENT (donor confidence never dipped below 60)');
  if (R.favoredLosses >= 2) titles.push('THE WIRE HATES YOU (lost two fights as a 75%+ favorite)');
  if (R.crises >= 4 && G.donors.length >= 3) titles.push('CRISIS MANAGER (four crises, base intact)');
  if (titles.length) items.push({ h: 'TITLES EARNED', s: titles.join(' · ') });
  return items;
}

function electionDay(news) {
  G.over = true;
  const rows = standings();
  const rank = rows.findIndex(r => r.you) + 1;
  const win = rank === 1 && rows[0].v > 0;
  G.electionResult = { win, rank, victories: G.stats.won };
  sfx(win ? 'win' : 'lose');
  const list = rows.map((r, i) => `${i + 1}. ${r.short} — ${r.v}`).join('   ·   ');
  const ch = loadChallenge();
  const chLine = ch ? (G.stats.won > ch.v ? ` You beat ${ch.who}'s ${ch.v}.` : G.stats.won === ch.v ? ` You tied ${ch.who}'s ${ch.v}.` : ` ${ch.who}'s ${ch.v} stands.`) : '';
  const items = [
    win
      ? { h: `${tank().name.toUpperCase()} NAMED MOST INFLUENTIAL THINK TANK IN WASHINGTON`, s: `Election Night, November 2028. ${G.stats.won} policy ${G.stats.won === 1 ? 'victory' : 'victories'} banked since January 2027. The gala will be insufferable.${chLine}`, big: true }
      : { h: `${rows[0].short.toUpperCase()} NAMED MOST INFLUENTIAL THINK TANK; ${tank().short.toUpperCase()} RANKS #${rank}`, s: `Election Night, November 2028. You banked ${G.stats.won} ${G.stats.won === 1 ? 'victory' : 'victories'} to their ${rows[0].v}. There is always the next cycle.${chLine}`, big: true },
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

// ---------- asynchronous multiplayer: challenge links + hall of records ----------
function loadChallenge() { try { return JSON.parse(localStorage.getItem('ttt-challenge') || 'null'); } catch (e) { return null; } }

function recordRun(rank, win) {
  try {
    const runs = JSON.parse(localStorage.getItem('ttt-runs') || '[]');
    runs.unshift({ tank: tank().short, v: G.stats.won, rank, win, when: new Date().toISOString().slice(0, 10) });
    localStorage.setItem('ttt-runs', JSON.stringify(runs.slice(0, 12)));
  } catch (e) {}
}

function makeChallengeLink() {
  const who = (prompt('Your name, for the challenge banner:') || 'A rival').trim().slice(0, 24) || 'A rival';
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ who, tank: tank().id, tankShort: tank().short, v: G.stats.won, rank: (G.electionResult || {}).rank || 0 }))));
  const url = `${location.origin}${location.pathname}?challenge=${payload}`;
  const box = $('#challengeBox');
  if (box) { box.value = url; box.classList.remove('hidden'); box.select(); }
  try { navigator.clipboard.writeText(url); flash('Challenge link copied. Send it to someone with opinions.'); }
  catch (e) { flash('Challenge link ready below — copy it and send it to someone with opinions.'); }
}

function bootChallenge() {
  try {
    const m = location.search.match(/[?&]challenge=([^&]+)/);
    if (m) {
      const c = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
      if (c && c.who && c.tank) localStorage.setItem('ttt-challenge', JSON.stringify(c));
      history.replaceState(null, '', location.pathname);
    }
  } catch (e) {}
}

function renderChallenge() {
  const ch = loadChallenge();
  const box = $('#challengeBanner');
  if (!box || !box.classList) return;
  if (!ch) { box.classList.add('hidden'); return; }
  const t = TANKS.find(x => x.id === ch.tank);
  box.innerHTML = `🎯 <b>CHALLENGE FROM ${ch.who.toUpperCase()}:</b> beat ${ch.v} ${ch.v === 1 ? 'victory' : 'victories'} running <b>${t ? t.name : ch.tankShort}</b>. <button class="btn tiny" data-act="pick" data-id="${ch.tank}">Accept</button> <button class="btn tiny" data-act="dismisschallenge">Dismiss</button>`;
  box.classList.remove('hidden');
  let runs = [];
  try { runs = JSON.parse(localStorage.getItem('ttt-runs') || '[]'); } catch (e) {}
  const hall = $('#hallBody');
  if (hall && hall.classList) {
    hall.innerHTML = runs.length ? runs.map(r => `<div class="pline">${r.when} · <b>${r.tank}</b> · ${r.v} victories · #${r.rank}${r.win ? ' 🏆' : ''}</div>`).join('') : '';
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
  G.log.unshift({ m: G.month, text });
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
  $('#paperDate').textContent = `${dateStr(G.month)} — Vol. ${G.month + 1} — Still 75¢`;
  $('#paperLead').innerHTML = `<div class="headline">${lead.h}</div>${lead.s ? `<div class="subhead">${lead.s}</div>` : ''}${meterHTML(lead.meter)}`;
  $('#paperRest').innerHTML = rest.map(i =>
    `<div class="paper-item"><div class="headline-sm">${i.h}</div>${i.s ? `<div class="subhead-sm">${i.s}</div>` : ''}${meterHTML(i.meter)}</div>`).join('');
  $('#paperBtn').textContent = isGameOver ? 'Start Over' : 'Continue';
  $('#paperBtn').dataset.act = isGameOver ? 'restart' : 'closepaper';
  const cb = $('#challengeBtn');
  if (cb && cb.classList) cb.classList.toggle('hidden', !(isGameOver && G.electionResult));
  const cbox = $('#challengeBox');
  if (cbox && cbox.classList) cbox.classList.add('hidden');
  $('#paper').classList.remove('hidden');
  sfx('paper');
  if (items.some(i => i.meter)) sfx('roll');
  // sweep each needle to its rolled number after the paper lands
  setTimeout(() => {
    document.querySelectorAll('#paper .needle').forEach(n => { n.style.left = n.dataset.roll + '%'; });
  }, 80);
}

// ---------- save / load ----------
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ G, uid })); } catch (e) {} }
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    G = data.G; uid = data.uid || 1000;
    if (G) { // older saves predate grant cycles, scholar patience, victories
      (G.donors || []).forEach(d => { if (d.term === undefined) d.term = 18; });
      (G.scholars || []).forEach(s => { if (s.strikes === undefined) s.strikes = 0; });
      (G.rivals || []).forEach(r => { if (r.victories === undefined) r.victories = 0; });
      if (G.confidence === undefined) { G.confidence = TUNE.confStart; G.confLog = []; G.courtsThisMonth = 0; }
      // retired support titles that sounded like development staff
      const retitled = { 'Development Associate': 'Logistics Coordinator', 'Grants Manager': 'Finance Manager', 'Comms Director': 'Comms Coordinator' };
      [...(G.ops || []), ...(G.hireMarket || [])].forEach(o => { if (o.kind === 'ops' && !o.spec && retitled[o.role]) o.role = retitled[o.role]; });
      if (!G.v || G.v < 2) { // rebase rival budgets onto the tuned scale
        const defs = TANKS.concat(NPC_TANKS);
        (G.rivals || []).forEach(r => {
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
  renderChallenge();
  const hasSave = (() => { try { const r = localStorage.getItem(SAVE_KEY); if (!r) return false; const d = JSON.parse(r); return d.G && !d.G.over; } catch (e) { return false; } })();
  $('#resumeBox').classList.toggle('hidden', !hasSave);
  $('#continueRow').innerHTML = hasSave
    ? `<button class="btn big" data-act="continue">▶ Resume Saved Game</button>` : '';
  $('#tankPicker').innerHTML = TANKS.map(t => `
    <div class="card tankcard">
      <div class="cardhead">${iconImg('tank_' + t.id, 'lg')}<span>${t.name}</span></div>
      <div class="cardbody">
        <div class="tankmeta">${leanChip(t.align)} <span class="chip">${t.size}</span> <span class="chip">${t.diff}</span></div>
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
  const monthsLeft = TUNE.electionMonth - G.month;
  const inSeason = G.month >= TUNE.electionSeasonStart && monthsLeft > 0;
  const cal = CALENDAR_LABEL[calendarOf(G.month)] ? ` · ${CALENDAR_LABEL[calendarOf(G.month)]}` : '';
  $('#tbDate').textContent = monthsLeft <= 0 ? 'ELECTION NIGHT'
    : inSeason ? `${dateStr(G.month)}${cal} · ⚡ ELECTION SEASON · ${monthsLeft} mo`
    : `${dateStr(G.month)}${cal} · ${monthsLeft} mo to election`;
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
          <button class="btn tiny" data-act="fire" data-kind="ops" data-id="${o.id}">Let Go</button>
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
      ? ` · next fellow in ${6 - (((G.progMonths || {}).fellows || 0) % 6)} mo` : '';
    const costLine = p.once
      ? `${fmtMoney(p.once)} once${p.cost ? ` + ${fmtMoney(p.cost)}/mo upkeep` : ''}${p.inf ? ` · ✦ +${p.inf}/mo` : ''}`
      : `${fmtMoney(p.cost)}/mo${p.inf ? ` · ✦ +${p.inf}/mo` : ' · produces nothing'}${fellowsNote}`;
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
          <div class="pline quirk">${p.blurb}</div>
          ${button}
        </div>
      </div>`;
  }).join('');
}

function donorPFChips(d) {
  let s = '';
  if (d.perk && DONOR_PERKS[d.perk]) s += ` <span class="chip want" title="${DONOR_PERKS[d.perk].tip}">${DONOR_PERKS[d.perk].label}</span>`;
  if (d.flaw && DONOR_FLAWS[d.flaw]) s += ` <span class="chip raid" title="${DONOR_FLAWS[d.flaw].tip}">${DONOR_FLAWS[d.flaw].label}</span>`;
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
          <div class="pline dim">${fmtMoney(d.grant)}/mo · ${d.term === undefined ? '♾ no cycle' : `⌛ cycle: ${Math.max(0, d.term - (G.month - d.joined))} mo left`}</div>
          <div class="pline ${met ? 'ok' : 'warn'}">${met ? '✓' : '✗'} ${demandText(d)}${d.demand.type === 'ENGAGE' ? (G.fights.some(f => f.tag === d.demand.tag) ? ` <span class="dim">(this month: ✦${(G.monthCommits || {})[d.demand.tag] || 0})</span>` : ` <span class="dim">(no ${d.demand.tag} fight on the board — excused this month)</span>`) : ''}</div>
          ${(() => {
            const cap = d.renewals ? 1 : TUNE.strikeLimit;
            return `<div class="pline dim">${d.renewals ? '<span class="chip want" title="Renewed relationship: stricter terms, and a single strike ends it">RENEWED</span> ' : ''}Strikes: ${'●'.repeat(d.strikes)}${'○'.repeat(Math.max(0, cap - d.strikes))}${d.strikes === cap - 1 ? ' <span class="warn">— one more and they walk</span>' : ''}</div>`;
          })()}
          ${d.lapsing ? `<div class="pline poachline">⌛ <b>Cycle over.</b> Renew for ✦${renewCost(d)} on stricter terms${d.demand.type === 'ENGAGE' ? ` (wants ✦${d.demand.amt + 5}/mo)` : d.demand.type === 'ROSTER' ? ' (wants 2 scholars)' : ''} — one strike ends a renewed deal — or let it lapse:
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
  const entries = Object.entries(s.rivals || {}).sort((x, y) => y[1] - x[1]);
  const parts = entries.map(([n, v]) => `${n} ${v}`);
  const attributed = entries.reduce((a, e) => a + e[1], 0);
  const other = s.total - s.yours - attributed;
  if (other > 0) parts.push(`Others ${other}`);
  if (s.yours > 0) parts.unshift(`<b>You ${s.yours}</b>`);
  return parts.length ? '⚑ ' + parts.join(' · ') : '⚑ no backers yet';
}

function renderFights() {
  $('#fightsBody').innerHTML = G.fights.map((f, fi) => {
    const [a, b] = f.sides;
    const pWin = Math.round(winProbA(f) * 100);
    const pctA = Math.max(2, Math.min(98, pWin));
    return `
      <div class="card fightcard">
        <div class="cardhead fight">${iconImg('fight_' + f.defId, 'sm')}<span class="ftype ${f.type}">${f.type}</span><span>${f.title}</span></div>
        <div class="cardbody">
          <div class="fightmeta">${tagChip(f.tag)} <span class="chip">⏳ ${f.monthsLeft} mo</span> <span class="chip gold" title="${rewardTip(f)}">🏆 ${rewardText(f)}</span>${expertiseChip(f.tag)}</div>
          ${testimonyReady(f) ? `<div class="pline"><button class="btn tiny" data-act="testify" data-f="${fi}" title="Your best ${f.tag} scholar takes the stand for the side you back: success adds 1.5× their output; a flub costs a quarter of your stake and their pride.">📣 Testify: ${bestWitness(f.tag).name}</button></div>` : ''}
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
            <div class="backers dim">${backersText(s)}</div>`).join('')}
        </div>
      </div>`;
  }).join('');
  $('#fightDeckCount').textContent = `DECK: ${G.fightDeck.length}`;
}

function renderReport() {
  const s = G.stats;
  const grants = monthlyGrants(), payroll = payrollCost(), rent = effectiveRent(), prog = programsCost();
  const net = grants - payroll - rent - prog;
  const seasonal = G.month >= TUNE.electionSeasonStart ? TUNE.electionSeasonMult : 1;
  const lbRows = standings().map((row, i) => {
    const budget = row.you ? `+${production()}` : `~${Math.round(G.rivals.find(r => r.short === row.short).budget * seasonal)}`;
    return `<tr class="${row.you ? 'you' : ''}">
      <td class="rank">${i + 1}</td>
      <td>${iconImg('tank_' + tankIdByShort(row.short), 'sm')} ${row.short}${row.you ? (i === 0 && row.v > 0 ? ' ★ <span title="You lead the board: the whole town is spending harder and counter-bidding the sides you top.">🔥</span>' : ' ★') : ''}</td>
      <td>${leanChip(row.align)}</td>
      <td class="amt">${row.v}</td>
      <td class="amt dim">✦${budget}</td>
    </tr>`;
  }).join('');
  $('#reportBody').innerHTML = `
    <div class="pline"><b>${tank().name}</b></div>
    <div class="pline quirk">“${tank().motto}”</div>
    ${(() => { const ch = loadChallenge(); return ch ? `<div class="pline warn">🎯 Challenge: beat ${ch.who}'s ${ch.v} (${ch.tankShort})</div>` : ''; })()}
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
      <tr class="lbhead"><td>#</td><td>TANK</td><td>LEAN</td><td class="amt">W</td><td class="amt">✦/mo</td></tr>
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
          <div class="pline">${leanChip(d.lean)} <b>${fmtMoney(d.grant)}/mo</b> <span class="dim">· ${d.term === undefined ? 'no cycle' : d.term + ' mo cycle'}</span>${d.lead ? ' <span class="chip want" title="Won in a policy fight: half-price courtship">WARM INTRO</span>' : ''}${donorPFChips(d)}</div>
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
  if (act === 'pick') newGame(b.dataset.id);
  else if (act === 'continue') { if (load()) { showScreen('game'); render(); } }
  else if (act === 'end') endMonth();
  else if (act === 'hire') actHire(+b.dataset.idx);
  else if (act === 'fire') actFire(b.dataset.kind, +b.dataset.id);
  else if (act === 'court') actCourt(+b.dataset.idx);
  else if (act === 'drop') actDrop(b.dataset.id);
  else if (act === 'prog') actProgram(b.dataset.id);
  else if (act === 'prospect') actProspect(b.dataset.kind);
  else if (act === 'crisischoice') actCrisis(+b.dataset.idx);
  else if (act === 'testify') actTestify(+b.dataset.f);
  else if (act === 'returnsdone') { $('#returnsWin').classList.add('hidden'); showPaper(G.finalPaper || [], true); }
  else if (act === 'returnsskip') finishReturns();
  else if (act === 'challenge') makeChallengeLink();
  else if (act === 'dismisschallenge') { try { localStorage.removeItem('ttt-challenge'); } catch (e) {} renderStart(); }
  else if (act === 'serve') actServe(+b.dataset.id);
  else if (act === 'keep') actKeepScholar(+b.dataset.id);
  else if (act === 'renew') actRenew(b.dataset.id);
  else if (act === 'lapse') actLapse(b.dataset.id);
  else if (act === 'match') actMatch(+b.dataset.id);
  else if (act === 'release') actRelease(+b.dataset.id);
  else if (act === 'commit') actCommit(+b.dataset.f, +b.dataset.s, +b.dataset.amt);
  else if (act === 'closepaper') $('#paper').classList.add('hidden');
  else if (act === 'restart') { clearSave(); $('#paper').classList.add('hidden'); G = null; renderStart(); showScreen('start'); }
  else if (act === 'newgame') {
    if (!G || confirm('Abandon the current institution and start fresh?')) {
      clearSave(); G = null; renderStart(); showScreen('start');
    }
  }
  else if (act === 'help') $('#helpWin').classList.toggle('hidden');
  else if (act === 'progwin') $('#progWin').classList.toggle('hidden');
  else if (act === 'tutorial') startTutorial();
  else if (act === 'tutnext') { if (tutStep >= TUTORIAL.length - 1) endTutorial(); else { tutStep++; renderTutorial(); } }
  else if (act === 'tutback') { if (tutStep > 0) { tutStep--; renderTutorial(); } }
  else if (act === 'tutskip') endTutorial();
});

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
bootChallenge();
renderStart();
showScreen('start');
