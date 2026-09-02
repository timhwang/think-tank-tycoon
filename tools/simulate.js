#!/usr/bin/env node
// Monte Carlo balance harness. Stubs the DOM, loads the REAL data.js +
// game.js, and drives bot strategies through endMonth() so tuning is
// validated against the actual engine, not a reimplementation.
//
//   node tools/simulate.js [runs-per-cell] [months]
//
// Prints survival rate, median months survived, and mean final treasury
// for every tank x strategy cell.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.dirname(__dirname);

// ---------- DOM stubs: absorb every render write ----------
function stubEl() {
  return {
    classList: { add() {}, remove() {}, toggle() {} },
    dataset: {},
    style: {},
    set innerHTML(v) {}, get innerHTML() { return ''; },
    set textContent(v) {}, get textContent() { return ''; },
    set className(v) {}, get className() { return ''; },
  };
}
const EL = stubEl();

const sandbox = {
  document: {
    querySelector: () => EL, querySelectorAll: () => [], addEventListener() {},
    createElement: () => stubEl(), body: { appendChild() {} },
  },
  window: {},
  alert() {},
  confirm() { return true; },
  console,
  Math, JSON, Object, Array, Number, String, Boolean, Set, Map, Date, RegExp, parseInt, parseFloat, isNaN,
};
sandbox.globalThis = sandbox;

// ---------- assemble one script: data + engine + bot driver ----------
const dataSrc = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
const gameSrc = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');

const driverSrc = `
// ================= bot driver (runs inside the game scope) =================

function affordableHires() {
  return G.hireMarket.map((h, i) => ({ h, i })).filter(x => hireBonus(x.h) <= G.cash - 100);
}

function botNaive() {
  // keeps a vague eye on support, otherwise acts on impulse
  if (G.scholars.length > supportCap()) {
    const ops = affordableHires().filter(x => x.h.kind === 'ops');
    if (ops.length && Math.random() < 0.6) actHire(ops[0].i);
  } else if (Math.random() < 0.3) {
    const c = affordableHires();
    if (c.length) actHire(pick(c).i);
  }
  if (Math.random() < 0.5) {
    const affordable = G.donorMarket.map((d, i) => ({ d, i })).filter(x => courtCost(x.d) <= G.influence);
    if (affordable.length) actCourt(pick(affordable).i);
  }
  let guard = 0;
  while (G.influence >= 40 && Math.random() < 0.6 && guard++ < 4) {
    const fi = Math.floor(Math.random() * G.fights.length);
    actCommit(fi, ri(0, 1), 25);
  }
}

function botDecent() {
  // 1. keep everyone supported (but never spend the last dollar on it)
  while (G.scholars.length > supportCap() && G.cash > 250) {
    const ops = affordableHires().filter(x => x.h.kind === 'ops')
      .sort((a, b) => a.h.salary - b.h.salary);
    if (!ops.length) break;
    actHire(ops[0].i);
  }
  // 2. programs: run what a current funder demands, shut down the rest
  PROGRAMS.forEach(p => {
    const wanted = G.donors.some(d => d.demand.type === 'PROGRAM' && d.demand.pid === p.id);
    if (wanted !== !!G.programs[p.id] && (wanted || p.inf === 0)) actProgram(p.id);
  });
  // 3. court the best donor we can satisfy, keeping an influence reserve
  const courtable = G.donorMarket.map((d, i) => ({ d, i })).filter(x => {
    const c = courtCost(x.d);
    if (c > G.influence - 50 || c > production() * 2.5) return false;
    const dm = x.d.demand;
    if (dm.type === 'ROSTER') return G.scholars.some(s => s.tag === dm.tag);
    if (dm.type === 'PROGRAM') return x.d.grant > 3 * PROGRAMS.find(p => p.id === dm.pid).cost;
    if (dm.type === 'ENGAGE') return G.scholars.filter(s => s.tag === dm.tag).length >= 1;
    return true; // NOCROSS: sure, we can behave
  }).sort((a, b) => b.d.grant - a.d.grant);
  if (courtable.length) actCourt(courtable[0].i);
  // 4. grow when rich: prefer scholars whose tag matches an ENGAGE/ROSTER need
  const net = monthlyGrants() - monthlyCosts();
  if (G.cash > 600 && net > 20 && G.scholars.length < supportCap()) {
    const c = affordableHires().filter(x => x.h.kind === 'scholar')
      .sort((a, b) => (b.h.out / b.h.salary) - (a.h.out / a.h.salary));
    if (c.length) actHire(c[0].i);
  }
  // 5. feed ENGAGE patrons first, then press the best near-term fight
  const reserve = 15;
  G.donors.filter(d => d.demand.type === 'ENGAGE').forEach(d => {
    if (G.influence < 50) return;
    const need = d.demand.amt - ((G.monthCommits || {})[d.demand.tag] || 0);
    if (need <= 0) return;
    const fi = G.fights.findIndex(f => f.tag === d.demand.tag);
    if (fi < 0) return;
    const f = G.fights[fi];
    const si = f.sides[0].total >= f.sides[1].total ? 0 : 1;
    const spend = Math.min(Math.ceil(need / expertiseMult(f.tag)), Math.max(0, G.influence - reserve));
    if (spend > 0) actCommit(fi, si, spend);
  });
  const targets = G.fights.map((f, fi) => ({ f, fi }))
    .filter(x => x.f.monthsLeft <= 2 && fightReward(x.f).cash + 10 * fightReward(x.f).inf > 150)
    .sort((a, b) => (fightReward(b.f).cash + 10 * fightReward(b.f).inf) - (fightReward(a.f).cash + 10 * fightReward(a.f).inf));
  if (targets.length && G.influence > reserve + 40) {
    const { f, fi } = targets[0];
    const si = f.sides[0].yours > 0 ? 0 : f.sides[1].yours > 0 ? 1
             : f.sides[0].total >= f.sides[1].total ? 0 : 1;
    actCommit(fi, si, Math.min(50, G.influence - reserve));
  }
}

function botShrewd() {
  // answer standing offers first: poach bids and expiring donors
  G.scholars.filter(s => s.poach).forEach(s => {
    if (s.out >= 14 && G.cash > 500) actMatch(s.id); else actRelease(s.id);
  });
  G.donors.filter(d => d.lapsing).forEach(d => {
    const cost = Math.ceil(courtCost(d) * TUNE.renewCostMult);
    const rosterOk = d.demand.type !== 'ROSTER' || G.scholars.filter(x => x.tag === d.demand.tag).length >= 2;
    if (d.grant >= 100 && cost <= G.influence - 30 && rosterOk) actRenew(d.id);
    else actLapse(d.id);
  });
  // support discipline first (capacity per salary, skip lavish offices)
  while (G.scholars.length > supportCap() && G.cash > 250) {
    const ops = affordableHires().filter(x => x.h.kind === 'ops' && (!x.h.trait || x.h.trait.id !== 'expense'))
      .sort((a, b) => (b.h.supports / b.h.salary) - (a.h.supports / a.h.salary));
    if (!ops.length) break;
    actHire(ops[0].i);
  }
  // run programs current funders demand; drop dead weight
  PROGRAMS.forEach(p => {
    const wanted = G.donors.some(d => d.demand.type === 'PROGRAM' && d.demand.pid === p.id);
    if (wanted && !G.programs[p.id] && !p.once) actProgram(p.id);
    if (!wanted && G.programs[p.id] && p.inf === 0 && !p.once && p.id !== 'warroom') actProgram(p.id);
  });
  // long-term investments once the machine hums
  const net0 = monthlyGrants() - monthlyCosts();
  if (!G.programs.journal && net0 > 50) actProgram('journal');
  if (!G.programs.warroom && net0 > 40 && G.month >= 4) actProgram('warroom');
  if (!G.programs.chair && G.cash > 1200) actProgram('chair');
  // court aggressively — breadth pays; just keep a small war chest
  const courtable = G.donorMarket.map((d, i) => ({ d, i }))
    .filter(x => courtCost(x.d) <= G.influence - 25)
    .sort((a, b) => (b.d.grant / courtCost(b.d)) - (a.d.grant / courtCost(a.d)));
  if (courtable.length) actCourt(courtable[0].i);
  // grow the bench when finances allow (divas are someone else's problem)
  const net = monthlyGrants() - monthlyCosts();
  if (G.cash > 500 && net > 0 && G.scholars.length < supportCap()) {
    const c = affordableHires().filter(x => x.h.kind === 'scholar' && !x.h.diva)
      .sort((a, b) => (b.h.out / b.h.salary) - (a.h.out / a.h.salary));
    if (c.length) actHire(c[0].i);
  }
  // feed ENGAGE patrons (cheapest way: ride the leading side)
  G.donors.filter(d => d.demand.type === 'ENGAGE').forEach(d => {
    const need = d.demand.amt - ((G.monthCommits || {})[d.demand.tag] || 0);
    if (need <= 0 || G.influence < need + 15) return;
    const fi = G.fights.findIndex(f => f.tag === d.demand.tag);
    if (fi < 0) return;
    const f = G.fights[fi];
    const si = f.sides[0].total >= f.sides[1].total ? 0 : 1;
    actCommit(fi, si, Math.ceil(need / expertiseMult(f.tag)));
  });
  // hunt victories: find the cheapest fight where we can lead the winning side
  const reserve = G.month < 4 ? 60 : 15; // build the machine first, then spend
  const plans = [];
  G.fights.forEach((f, fi) => {
    if (f.monthsLeft > 2) return; // commit late; early money invites counter-piling
    f.sides.forEach((s, si) => {
      const opp = f.sides[1 - si];
      const topOther = Math.max(0, ...Object.values(s.rivals || {}));
      // rivals surge into closing fights, so late bids need real margin
      const buffer = f.monthsLeft <= 1 ? 32 : 24;
      const eff = Math.max(topOther + buffer - s.yours, opp.total + buffer - s.total, 0);
      const raw = Math.ceil(eff / expertiseMult(f.tag)) || 1;
      plans.push({ fi, si, raw });
    });
  });
  plans.sort((a, b) => a.raw - b.raw);
  let bids = 0;
  for (const p of plans) {
    if (bids >= 3 || p.raw > G.influence - reserve) break;
    actCommit(p.fi, p.si, p.raw);
    bids++;
  }
}

globalThis.__runOne = function (tankId, strategy, maxMonths) {
  newGame(tankId);
  let guard = 0;
  while (!G.over && guard++ < (maxMonths || 40)) {
    if (strategy === 'naive') botNaive();
    else if (strategy === 'decent') botDecent();
    else if (strategy === 'shrewd') botShrewd();
    endMonth();
  }
  const er = G.electionResult;
  return {
    win: !!(er && er.win),
    rank: er ? er.rank : 8,           // folded pre-election: unranked
    madeElection: !!er,
    months: G.stats.months,
    cash: G.cash,
    victories: G.stats.won,
    topScore: Math.max(G.stats.won, ...G.rivals.map(r => r.victories || 0)),
  };
};
globalThis.__tankIds = TANKS.map(t => t.id);
globalThis.__setTune = function (patch) { Object.assign(TUNE, patch); };
`;

vm.createContext(sandbox);
vm.runInContext(dataSrc + '\n' + gameSrc + '\n' + driverSrc, sandbox, { filename: 'game-bundle.js' });

// ---------- run the grid ----------
const RUNS = parseInt(process.argv[2] || '200', 10);
const MONTHS = parseInt(process.argv[3] || '60', 10);
const tunePatch = process.env.TUNE_PATCH ? JSON.parse(process.env.TUNE_PATCH) : null;
if (tunePatch) { sandbox.__setTune(tunePatch); console.log('TUNE patch:', JSON.stringify(tunePatch)); }

const strategies = ['passive', 'naive', 'shrewd'];
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

console.log(`${RUNS} runs/cell, election at month 22\n`);
console.log('tank          strategy  win-election%  reach-election%  avg-rank  avg-victories  top-score');
console.log('------------  --------  -------------  ---------------  --------  -------------  ---------');
const summary = {};
for (const tankId of sandbox.__tankIds) {
  for (const strat of strategies) {
    const rs = [];
    for (let i = 0; i < RUNS; i++) rs.push(sandbox.__runOne(tankId, strat, MONTHS));
    const cell = {
      win: Math.round(rs.filter(r => r.win).length / RUNS * 100),
      made: Math.round(rs.filter(r => r.madeElection).length / RUNS * 100),
      rank: (rs.reduce((a, r) => a + r.rank, 0) / RUNS).toFixed(1),
      vict: (rs.reduce((a, r) => a + r.victories, 0) / RUNS).toFixed(1),
      top: (rs.reduce((a, r) => a + r.topScore, 0) / RUNS).toFixed(1),
    };
    summary[`${tankId}/${strat}`] = cell;
    console.log(
      tankId.padEnd(12), strat.padEnd(9),
      String(cell.win + '%').padStart(12),
      String(cell.made + '%').padStart(16),
      String(cell.rank).padStart(9),
      String(cell.vict).padStart(14),
      String(cell.top).padStart(10));
  }
  console.log('');
}
const overall = (s, k) => {
  const cells = Object.entries(summary).filter(([x]) => x.endsWith('/' + s)).map(([, v]) => v[k]);
  return Math.round(cells.reduce((a, b) => a + b, 0) / cells.length);
};
console.log(`overall election wins — passive ${overall('passive', 'win')}%, naive ${overall('naive', 'win')}%, shrewd ${overall('shrewd', 'win')}%`);
