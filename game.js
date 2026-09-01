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
  let big = false;
  if (!starter && Math.random() < 0.12) { big = true; out += 10; }
  // starters mostly share the shop's politics; the open market is a grab bag
  const tSign = Math.sign(tank().align);
  const r = Math.random();
  const lean = starter ? ((tSign !== 0 && r < 0.6) ? tSign : 0)
                       : (r < 0.3 ? -1 : r < 0.7 ? 0 : 1);
  const sch = {
    id: uid++, kind: 'scholar', name, big, lean,
    tag: pick(TAGS), salary: salary + (big ? 15 : 0), out,
    quirk: pick(SCHOLAR_QUIRKS),
    icon: 'scholar_' + ri(1, 12),
  };
  // some market scholars are sitting at a rival right now — hiring is a raid
  if (!starter && G && G.rivals && G.rivals.length && Math.random() < TUNE.raidChance) {
    sch.from = pick(G.rivals).short;
    sch.out += 4;    // proven operator
    sch.salary += 6; // knows it
  }
  return sch;
}

function genOps() {
  const rIdx = Math.floor(Math.random() * OPS_ROLES.length);
  return {
    id: uid++, kind: 'ops', name: genName(false),
    role: OPS_ROLES[rIdx], salary: ri(7, 12), supports: TUNE.supportRatio,
    quirk: pick(OPS_QUIRKS),
    icon: 'ops_' + (rIdx + 1),
  };
}

function buildRivals(chosenId) {
  const mk = t => ({
    short: t.short, name: t.name, align: t.align,
    budget: Math.round(t.budget * TUNE.rivalBudgetMult), tags: t.tags,
    victories: 0,
  });
  const rivals = TANKS.filter(t => t.id !== chosenId).map(mk);
  NPC_TANKS.forEach(t => rivals.push(mk(t)));
  return rivals;
}

function mkDonorInstance(defId) {
  const d = DONORS.find(x => x.id === defId);
  return {
    ...d, demand: { ...d.demand }, strikes: 0, joined: G ? G.month : 0,
    grant: Math.round(d.grant * TUNE.grantMult),
    term: ri(TUNE.grantTermMin, TUNE.grantTermMax),
  };
}

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

function drawDonorToMarket() {
  if (!G.donorDeck.length) {
    const unavailable = new Set([...G.donors.map(d => d.id), ...G.donorMarket.map(d => d.id)]);
    G.donorDeck = shuffle(DONORS.map(d => d.id).filter(id => !unavailable.has(id)));
    if (!G.donorDeck.length) return false; // literally everyone already funds you
  }
  G.donorMarket.push(mkDonorInstance(G.donorDeck.pop()));
  return true;
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
    log: [], negStreak: 0, over: false, monthCommits: {}, v: 2,
    stats: { months: 0, won: 0, lost: 0, peakCash: t.cash },
  };
  PROGRAMS.forEach(p => G.programs[p.id] = false);
  for (let i = 0; i < t.scholars; i++) G.scholars.push(genScholar(true));
  for (let i = 0; i < t.ops; i++) G.ops.push(genOps());
  t.donors.forEach(id => G.donors.push(mkDonorInstance(id)));
  while (G.fights.length < TUNE.fightSlots) drawFight();
  while (G.donorMarket.length < TUNE.donorSlots && drawDonorToMarket()) {}
  while (G.hireMarket.length < TUNE.hireSlots) drawHire();
  logLine(`${t.name} opens its doors. Motto: “${t.motto}”`);
  save();
  showScreen('game');
  render();
}

// ---------- derived numbers ----------
function supportCap() { return G.ops.length * TUNE.supportRatio; }

function production() {
  const cap = supportCap();
  let sum = 0;
  G.scholars.forEach((s, i) => { sum += i < cap ? s.out : Math.floor(s.out * TUNE.unsupportedMult); });
  PROGRAMS.forEach(p => { if (G.programs[p.id]) sum += p.inf; });
  return sum;
}

function payrollCost() {
  let c = 0;
  G.scholars.forEach(s => c += s.salary);
  G.ops.forEach(o => c += o.salary);
  return c;
}

function programsCost() {
  let c = 0;
  PROGRAMS.forEach(p => { if (G.programs[p.id]) c += p.cost; });
  return c;
}

function monthlyCosts() { return tank().rent + payrollCost() + programsCost(); }

function monthlyGrants() { return G.donors.reduce((a, d) => a + d.grant, 0); }

// ---------- demands ----------
function demandText(d) {
  const dm = d.demand;
  if (dm.type === 'ROSTER') return `Wants a ${dm.tag} scholar on staff`;
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
  if (dm.type === 'ROSTER') return G.scholars.some(s => s.tag === dm.tag);
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

// partisan fit: matching leans discount a hire/courtship, crossing costs extra
function fitMult(lean, matchMult, opposeMult) {
  const m = (lean || 0) * Math.sign(tank().align);
  return m > 0 ? matchMult : m < 0 ? opposeMult : 1;
}

function hireBonus(h) {
  let b = h.salary * TUNE.signingMonths;
  if (h.kind !== 'scholar') return Math.ceil(b);
  b *= fitMult(h.lean, TUNE.hireMatchMult, TUNE.hireOpposeMult);
  if (h.from) b *= TUNE.raidBonusMult; // buying out a rival's fellow
  return Math.ceil(b);
}

function courtCost(d) {
  return Math.ceil(d.cost * TUNE.courtCostMult * fitMult(d.lean, TUNE.donorMatchMult, TUNE.donorOpposeMult));
}

// glyph for a price the player's politics moved
function fitMark(lean) {
  const m = (lean || 0) * Math.sign(tank().align);
  return m > 0 ? ' <span class="ok" title="Shares your politics: discounted">▼</span>'
       : m < 0 ? ' <span class="warn" title="Crosses the aisle: premium">▲</span>' : '';
}

// matching scholars amplify influence committed to a fight of their tag
function expertiseMult(tag) {
  const n = G.scholars.filter(s => s.tag === tag).length;
  return 1 + Math.min(TUNE.expertiseCap, TUNE.expertisePerScholar * n);
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
  if (!confirm(`Let ${p.name} go? Severance: ${fmtMoney(sev)}.`)) return;
  G.cash -= sev;
  list.splice(i, 1);
  logLine(`${p.name} has “left to pursue outside opportunities.” Severance ${fmtMoney(sev)}.`);
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
  G.donors.push(d);
  drawDonorToMarket();
  logLine(`${d.name} is now a funder (${fmtMoney(d.grant)}/mo). Demand: ${demandText(d)}.`);
  save(); render();
}

function actDrop(id) {
  const i = G.donors.findIndex(d => d.id === id);
  if (i < 0) return;
  const d = G.donors[i];
  if (!confirm(`Part ways with ${d.name}? Their ${fmtMoney(d.grant)}/mo goes with them.`)) return;
  G.donors.splice(i, 1);
  logLine(`Parted ways with ${d.name}. The lunch was described as “cordial.”`);
  save(); render();
}

function actProgram(pid) {
  const p = PROGRAMS.find(x => x.id === pid);
  G.programs[pid] = !G.programs[pid];
  logLine(G.programs[pid] ? `Launched the ${p.name} (${fmtMoney(p.cost)}/mo).` : `Quietly shut down the ${p.name}.`);
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

// ---------- rival AI ----------
function rivalCommits() {
  G.rivals.forEach(r => {
    const targets = [];
    G.fights.forEach(f => {
      let sideIdx = -1;
      const pref = f.sides.findIndex(s => s.lean * r.align > 0);
      if (pref >= 0) sideIdx = pref;
      else if (f.tag && r.tags.includes(f.tag)) {
        if (f.rivalPicks[r.short] === undefined) f.rivalPicks[r.short] = ri(0, 1);
        sideIdx = f.rivalPicks[r.short];
      }
      if (sideIdx >= 0) targets.push({ f, sideIdx, w: r.tags.includes(f.tag) ? 2 : 1 });
    });
    if (!targets.length) return;
    const budget = Math.round(r.budget * (0.75 + Math.random() * 0.5));
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
  const news = [];
  G.stats.months++;

  // 1. rivals pile on
  rivalCommits();

  // 2. clocks tick; fights resolve
  G.fights.forEach(f => f.monthsLeft--);
  G.fights.filter(f => f.monthsLeft <= 0).forEach(f => resolveFight(f, news));
  G.fights = G.fights.filter(f => f.monthsLeft > 0);

  // 3. scholars produce influence
  const prod = production();
  G.influence += prod;

  // 4. donors pay
  const grants = monthlyGrants();
  G.cash += grants;

  // 4.5 grant cycles sunset (they pay their final month first)
  const expired = G.donors.filter(d => d.term !== undefined && G.month - d.joined >= d.term - 1);
  expired.forEach(d => {
    news.push({ h: `${d.name.toUpperCase()} GRANT CYCLE CONCLUDES`, s: `${fmtMoney(d.grant)}/mo sunsets on schedule after ${d.term} months. “Do stay in touch,” they say, warmly, leaving.` });
    logLine(`${d.name}'s grant cycle ended (${d.term} months). Court them again someday.`);
    G.donorDeck.unshift(d.id);
  });
  G.donors = G.donors.filter(d => !expired.includes(d));

  // 5. donor demands checked
  G.donors.forEach(d => {
    if (!demandMet(d)) {
      d.strikes++;
      logLine(`${d.name}: demand unmet (${demandText(d)}). Strike ${d.strikes}/${TUNE.strikeLimit}.`);
    }
  });
  const leaving = G.donors.filter(d => d.strikes >= TUNE.strikeLimit);
  leaving.forEach(d => {
    news.push({ h: `${d.name.toUpperCase()} PULLS FUNDING`, s: `“We wish the institution well,” says statement that does not wish the institution well. ${fmtMoney(d.grant)}/mo, gone.` });
    logLine(`${d.name} walks. ${fmtMoney(d.grant)}/mo, gone.`);
  });
  G.donors = G.donors.filter(d => d.strikes < TUNE.strikeLimit);

  // 6. pay the bills
  const costs = monthlyCosts();
  G.cash -= costs;

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
    });
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

  // 8. refresh markets
  if (G.hireMarket.length) G.hireMarket.shift();
  while (G.hireMarket.length < TUNE.hireSlots) drawHire();
  if (Math.random() < 0.4 && G.donorMarket.length) {
    const gone = G.donorMarket.shift();
    G.donorDeck.unshift(gone.id);
  }
  while (G.donorMarket.length < TUNE.donorSlots && drawDonorToMarket()) {}
  while (G.fights.length < TUNE.fightSlots) drawFight();

  // 9. slow news day? the three branches never disappoint
  if (Math.random() < TUNE.flavorChance) {
    shuffle(FLAVOR_NEWS).slice(0, Math.random() < 0.4 ? 2 : 1)
      .forEach(p => news.push({ h: p.h, s: p.s }));
  }

  G.monthCommits = {}; // engagement ledger resets after demands were judged
  G.month++;
  G.stats.peakCash = Math.max(G.stats.peakCash, G.cash);
  if (G.month >= TUNE.electionMonth) { electionDay(news); return; }
  save(); render();
  if (news.length) showPaper(news);
}

function resolveFight(f, news) {
  const [a, b] = f.sides;
  const winner = a.total === b.total ? pick([a, b]) : (a.total > b.total ? a : b);
  const loser = winner === a ? b : a;
  const tie = a.total === b.total;
  let sub = `“${winner.label}” prevails ${winner.total}–${loser.total}${tie ? ' after a coin flip nobody will discuss' : ''}.`;

  // the victory is banked by whoever carried the winning side hardest
  let topRival = null, topAmt = 0;
  Object.entries(winner.rivals || {}).forEach(([short, amt]) => {
    if (amt > topAmt) { topAmt = amt; topRival = short; }
  });
  const playerBanks = winner.yours > 0 && winner.yours >= topAmt; // ties go to you
  if (playerBanks) {
    G.stats.won++;
  } else if (topRival) {
    const r = G.rivals.find(x => x.short === topRival);
    if (r) r.victories = (r.victories || 0) + 1;
  }
  const creditLine = playerBanks ? `${tank().short} banks the victory.`
    : topRival ? `${topRival} banks the victory.` : 'Nobody in particular claims it.';

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
    news.push({ h: playerBanks ? `${f.title.toUpperCase()} — VICTORY FOR ${tank().short.toUpperCase()}` : `${f.title.toUpperCase()} — RESOLVED`, s: sub, big: playerBanks });
    logLine(`${playerBanks ? 'VICTORY BANKED' : 'Backed the winner'}: ${f.title} → ${gains.join('; ')} (${Math.round(share * 100)}% of the winning side).`);
  } else if (loser.yours > 0) {
    G.stats.lost++;
    sub += ` ${creditLine} ${tank().short} spent ${loser.yours} influence on the losing side. A fellow calls it “directionally correct.”`;
    news.push({ h: `${f.title.toUpperCase()} — RESOLVED`, s: sub });
    logLine(`LOSS: ${f.title}. ${loser.yours} influence down the drain.`);
  } else {
    news.push({ h: `${f.title.toUpperCase()} — RESOLVED`, s: `${sub} ${creditLine} You watched from the sidelines.` });
    logLine(`${f.title} resolved without you. ${creditLine}`);
  }
}

function standings() {
  const rows = [
    { short: tank().short, name: tank().name, v: G.stats.won, you: true },
    ...G.rivals.map(r => ({ short: r.short, name: r.name, v: r.victories || 0, you: false })),
  ];
  rows.sort((x, y) => y.v - x.v || (x.you ? -1 : y.you ? 1 : 0)); // you win ties
  return rows;
}

function electionDay(news) {
  G.over = true;
  const rows = standings();
  const rank = rows.findIndex(r => r.you) + 1;
  const win = rank === 1 && rows[0].v > 0;
  G.electionResult = { win, rank, victories: G.stats.won };
  const list = rows.map((r, i) => `${i + 1}. ${r.short} — ${r.v}`).join('   ·   ');
  const items = [
    win
      ? { h: `${tank().name.toUpperCase()} NAMED MOST INFLUENTIAL THINK TANK IN WASHINGTON`, s: `Election Night, November 2028. ${G.stats.won} policy ${G.stats.won === 1 ? 'victory' : 'victories'} banked since January 2027. The gala will be insufferable.`, big: true }
      : { h: `${rows[0].short.toUpperCase()} NAMED MOST INFLUENTIAL THINK TANK; ${tank().short.toUpperCase()} RANKS #${rank}`, s: `Election Night, November 2028. You banked ${G.stats.won} ${G.stats.won === 1 ? 'victory' : 'victories'} to their ${rows[0].v}. There is always the next cycle.`, big: true },
    { h: 'FINAL STANDINGS', s: list },
    ...news,
  ];
  save();
  render();
  showPaper(items, true);
}

function gameOver(news) {
  G.over = true;
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

function showPaper(items, isGameOver) {
  const lead = items.find(i => i.big) || items[0];
  const rest = items.filter(i => i !== lead);
  $('#paperDate').textContent = `${dateStr(G.month)} — Vol. ${G.month + 1} — Still 75¢`;
  $('#paperLead').innerHTML = `<div class="headline">${lead.h}</div>${lead.s ? `<div class="subhead">${lead.s}</div>` : ''}`;
  $('#paperRest').innerHTML = rest.map(i =>
    `<div class="paper-item"><div class="headline-sm">${i.h}</div>${i.s ? `<div class="subhead-sm">${i.s}</div>` : ''}</div>`).join('');
  $('#paperBtn').textContent = isGameOver ? 'Start Over' : 'Continue';
  $('#paperBtn').dataset.act = isGameOver ? 'restart' : 'closepaper';
  $('#paper').classList.remove('hidden');
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
  $('#tbDate').textContent = monthsLeft > 0 ? `${dateStr(G.month)} · ${monthsLeft} mo to election` : 'ELECTION NIGHT';
  $('#tbCash').innerHTML = `${fmtMoney(G.cash)} <span class="dim">(${fmtSigned(net)}/mo)</span>`;
  $('#tbCash').className = G.cash < 0 ? 'tbval bad' : 'tbval';
  $('#tbInf').innerHTML = `✦ ${G.influence} <span class="dim">(+${production()}/mo)</span>`;
  $('#tbStaff').textContent = `${G.scholars.length} scholars / ${cap} supported`;

  renderFights();
  renderHireMarket();
  renderDonorMarket();
  renderStaff(cap);
  renderPrograms();
  renderMyDonors();
  renderReport();
  renderBugle();
}

function renderStaff(cap) {
  const rows = [];
  G.scholars.forEach((s, i) => {
    const supported = i < cap;
    rows.push(`
      <div class="person ${supported ? '' : 'unsup'}">
        ${iconImg(s.icon)}
        <div class="pcontent">
          <div class="pline">
            <b>${s.name}</b>${s.big ? ' <span class="star" title="Big Name">★</span>' : ''} ${tagChip(s.tag)} ${leanChip(s.lean || 0)}${s.from ? ` <span class="chip" title="Poached from a rival">ex-${s.from}</span>` : ''}
            ${supported ? '' : `<span class="warn" title="No ops support — half output, and they quit after ${TUNE.scholarStrikeLimit} straight unsupported months">⚠ half rate · patience ${'●'.repeat(s.strikes || 0)}${'○'.repeat(Math.max(0, TUNE.scholarStrikeLimit - (s.strikes || 0)))}${(s.strikes || 0) === TUNE.scholarStrikeLimit - 1 ? ' — one more month and they quit' : ''}</span>`}
          </div>
          <div class="pline dim">✦ ${supported ? s.out : Math.floor(s.out * TUNE.unsupportedMult)}/mo · ${fmtMoney(s.salary)}/mo</div>
          <div class="pline quirk">${s.quirk}</div>
          <button class="btn tiny" data-act="fire" data-kind="scholar" data-id="${s.id}">Let Go</button>
        </div>
      </div>`);
  });
  if (!G.scholars.length) rows.push('<div class="empty">No scholars. No scholars, no influence.</div>');
  rows.push('<div class="subdivider">OPERATIONS</div>');
  G.ops.forEach(o => {
    rows.push(`
      <div class="person">
        ${iconImg(o.icon)}
        <div class="pcontent">
          <div class="pline"><b>${o.name}</b></div>
          <div class="pline dim">${o.role} · supports ${o.supports} · ${fmtMoney(o.salary)}/mo</div>
          <div class="pline quirk">${o.quirk}</div>
          <button class="btn tiny" data-act="fire" data-kind="ops" data-id="${o.id}">Let Go</button>
        </div>
      </div>`);
  });
  if (!G.ops.length) rows.push('<div class="empty">No ops staff. Scholars are wandering the halls unsupported.</div>');
  $('#staffBody').innerHTML = rows.join('');
}

function renderPrograms() {
  $('#programsBody').innerHTML = PROGRAMS.map(p => {
    const on = G.programs[p.id];
    const wanted = G.donors.some(d => d.demand.type === 'PROGRAM' && d.demand.pid === p.id);
    return `
      <div class="program ${on ? 'on' : ''}">
        ${iconImg('program_' + p.id)}
        <div class="pcontent">
          <div class="pline"><b>${p.name}</b> ${on ? '<span class="chip on">RUNNING</span>' : ''} ${wanted ? '<span class="chip want" title="A current donor demands this">DONOR BAIT</span>' : ''}</div>
          <div class="pline dim">${fmtMoney(p.cost)}/mo${p.inf ? ` · ✦ +${p.inf}/mo` : ' · produces nothing'}</div>
          <div class="pline quirk">${p.blurb}</div>
          <button class="btn tiny" data-act="prog" data-id="${p.id}">${on ? 'Shut Down' : 'Launch'}</button>
        </div>
      </div>`;
  }).join('');
}

function renderMyDonors() {
  const rows = G.donors.map(d => {
    const met = demandMet(d);
    return `
      <div class="person donor">
        ${iconImg('donor_' + d.id)}
        <div class="pcontent">
          <div class="pline"><b>${d.name}</b> ${leanChip(d.lean)}</div>
          <div class="pline dim">${fmtMoney(d.grant)}/mo · ⌛ cycle: ${Math.max(0, d.term === undefined ? 18 : d.term - (G.month - d.joined))} mo left</div>
          <div class="pline ${met ? 'ok' : 'warn'}">${met ? '✓' : '✗'} ${demandText(d)}${d.demand.type === 'ENGAGE' ? ` <span class="dim">(this month: ✦${(G.monthCommits || {})[d.demand.tag] || 0})</span>` : ''}</div>
          <div class="pline dim">Strikes: ${'●'.repeat(d.strikes)}${'○'.repeat(Math.max(0, TUNE.strikeLimit - d.strikes))}${d.strikes === TUNE.strikeLimit - 1 ? ' <span class="warn">— one more and they walk</span>' : ''}</div>
          <button class="btn tiny" data-act="drop" data-id="${d.id}">Part Ways</button>
        </div>
      </div>`;
  });
  $('#myDonorsBody').innerHTML = rows.join('') || '<div class="empty">No funders. The treasury drains.</div>';
}

// shown on fight cards when your bench amplifies commits there
function expertiseChip(tag) {
  const n = G.scholars.filter(s => s.tag === tag).length;
  if (!n) return '';
  const pct = Math.round((expertiseMult(tag) - 1) * 100);
  return ` <span class="chip on" title="${n} ${tag} scholar${n > 1 ? 's' : ''} on staff amplify influence you commit here">★ +${pct}%</span>`;
}

// plain-language line under the fight meta when the bench boosts commits
function expertiseNote(tag) {
  const n = G.scholars.filter(s => s.tag === tag).length;
  if (!n) return '';
  const pct = Math.round((expertiseMult(tag) - 1) * 100);
  return `<div class="pline dim expnote">Due to expertise, influence you commit here gets a +${pct}% bonus (${n} ${tag} scholar${n > 1 ? 's' : ''} on staff).</div>`;
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
    const total = a.total + b.total;
    const pctA = total === 0 ? 50 : Math.max(4, Math.min(96, Math.round(a.total / total * 100)));
    return `
      <div class="card fightcard">
        <div class="cardhead fight">${iconImg('fight_' + f.defId, 'sm')}<span class="ftype ${f.type}">${f.type}</span><span>${f.title}</span></div>
        <div class="cardbody">
          <div class="fightmeta">${tagChip(f.tag)} <span class="chip">⏳ ${f.monthsLeft} mo</span> <span class="chip gold">🏆 ${rewardText(f)}</span>${expertiseChip(f.tag)}</div>
          ${expertiseNote(f.tag)}
          <div class="tug"><div class="tugA" style="width:${pctA}%"></div></div>
          ${f.sides.map((s, si) => `
            <div class="sideline">
              <span class="sidelabel">${si === 0 ? '◤' : '◢'} ${s.label} ${leanChip(s.lean)}</span>
              <span class="sidenums">${s.total}</span>
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
  const grants = monthlyGrants(), payroll = payrollCost(), rent = tank().rent, prog = programsCost();
  const net = grants - payroll - rent - prog;
  const cap = supportCap();
  const lbRows = standings().map((row, i) => {
    const budget = row.you ? `+${production()}` : `~${G.rivals.find(r => r.short === row.short).budget}`;
    return `<tr class="${row.you ? 'you' : ''}">
      <td>${i + 1}</td>
      <td>${iconImg('tank_' + tankIdByShort(row.short), 'sm')} ${row.short}${row.you ? ' ★' : ''}</td>
      <td class="amt">${row.v}</td>
      <td class="amt dim">✦${budget}</td>
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
    <div class="subdivider">INFLUENCE</div>
    <div class="pline">Banked ✦ ${G.influence} · producing +${production()}/mo</div>
    <div class="pline dim">${Math.min(G.scholars.length, cap)}/${G.scholars.length} scholars supported</div>
    <div class="subdivider">LEADERBOARD — POLICY VICTORIES</div>
    <table class="ledger lb">
      <tr class="lbhead"><td>#</td><td>TANK</td><td class="amt">W</td><td class="amt">✦/mo</td></tr>
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
              <div class="pline">${tagChip(h.tag)} ${leanChip(h.lean || 0)}${h.from ? ` <span class="chip raid" title="Currently at a rival. Hiring is a raid: 1.5× signing bonus, and ${h.from} permanently loses ~${TUNE.raidBudgetHit}/mo of influence budget">AT ${h.from.toUpperCase()}</span>` : ''}</div>
              <div class="pline">✦ ${h.out}/mo · ${fmtMoney(h.salary)}/mo</div>
              <div class="pline quirk">${h.quirk}</div>
              <button class="btn tiny" data-act="hire" data-idx="${i}">Hire (${fmtMoney(hireBonus(h))} bonus)</button>${fitMark(h.lean)}
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
            <div class="pline"><span class="chip">OPS</span> <span class="dim">${h.role}</span></div>
            <div class="pline">Supports ${h.supports} scholars · ${fmtMoney(h.salary)}/mo</div>
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
          <div class="pline">${leanChip(d.lean)} <b>${fmtMoney(d.grant)}/mo</b> <span class="dim">· ${d.term} mo cycle</span>${d.lead ? ' <span class="chip want" title="Won in a policy fight: half-price courtship">WARM INTRO</span>' : ''}</div>
          <div class="pline warn">Demands: ${demandText(d)}</div>
          <div class="pline quirk">${d.blurb}</div>
          <button class="btn tiny" data-act="court" data-idx="${i}" ${G.influence < courtCost(d) ? 'disabled' : ''}>Court (✦ ${courtCost(d)})</button>${fitMark(d.lean)}
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
  if (act === 'pick') newGame(b.dataset.id);
  else if (act === 'continue') { if (load()) { showScreen('game'); render(); } }
  else if (act === 'end') endMonth();
  else if (act === 'hire') actHire(+b.dataset.idx);
  else if (act === 'fire') actFire(b.dataset.kind, +b.dataset.id);
  else if (act === 'court') actCourt(+b.dataset.idx);
  else if (act === 'drop') actDrop(b.dataset.id);
  else if (act === 'prog') actProgram(b.dataset.id);
  else if (act === 'commit') actCommit(+b.dataset.f, +b.dataset.s, +b.dataset.amt);
  else if (act === 'closepaper') $('#paper').classList.add('hidden');
  else if (act === 'restart') { clearSave(); $('#paper').classList.add('hidden'); G = null; renderStart(); showScreen('start'); }
  else if (act === 'newgame') {
    if (!G || confirm('Abandon the current institution and start fresh?')) {
      clearSave(); G = null; renderStart(); showScreen('start');
    }
  }
  else if (act === 'help') $('#helpWin').classList.toggle('hidden');
});

// ---------- boot ----------
renderStart();
showScreen('start');
