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
  document: { querySelector: () => EL, querySelectorAll: () => [], addEventListener() {} },
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
  // support discipline first
  while (G.scholars.length > supportCap() && G.cash > 250) {
    const ops = affordableHires().filter(x => x.h.kind === 'ops').sort((a, b) => a.h.salary - b.h.salary);
    if (!ops.length) break;
    actHire(ops[0].i);
  }
  // run programs current funders demand; drop dead weight
  PROGRAMS.forEach(p => {
    const wanted = G.donors.some(d => d.demand.type === 'PROGRAM' && d.demand.pid === p.id);
    if (wanted && !G.programs[p.id]) actProgram(p.id);
    if (!wanted && G.programs[p.id] && p.inf === 0) actProgram(p.id);
  });
  // court aggressively — breadth pays; just keep a small war chest
  const courtable = G.donorMarket.map((d, i) => ({ d, i }))
    .filter(x => courtCost(x.d) <= G.influence - 25)
    .sort((a, b) => (b.d.grant / courtCost(b.d)) - (a.d.grant / courtCost(a.d)));
  if (courtable.length) actCourt(courtable[0].i);
  // grow the bench when finances allow
  const net = monthlyGrants() - monthlyCosts();
  if (G.cash > 500 && net > 0 && G.scholars.length < supportCap()) {
    const c = affordableHires().filter(x => x.h.kind === 'scholar')
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
  // harvest shares: small stakes on leading sides about to resolve
  G.fights.forEach((f, fi) => {
    if (f.monthsLeft > 1 || G.influence < 40) return;
    const si = f.sides[0].total >= f.sides[1].total ? 0 : 1;
    if (f.sides[si].yours === 0 && fightReward(f).cash >= 150) actCommit(fi, si, 15);
  });
}

globalThis.__runOne = function (tankId, strategy, maxMonths) {
  newGame(tankId);
  while (!G.over && G.stats.months < maxMonths) {
    if (strategy === 'naive') botNaive();
    else if (strategy === 'decent') botDecent();
    else if (strategy === 'shrewd') botShrewd();
    endMonth();
  }
  return {
    survived: !G.over,
    months: G.stats.months,
    cash: G.cash,
    won: G.stats.won,
    lost: G.stats.lost,
    scholars: G.scholars.length,
    donors: G.donors.length,
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

console.log(`${RUNS} runs/cell, ${MONTHS}-month horizon\n`);
console.log('tank          strategy  survive%  med-months  mean-cash  mean-W/L');
console.log('------------  --------  --------  ----------  ---------  --------');
const summary = {};
for (const tankId of sandbox.__tankIds) {
  for (const strat of strategies) {
    const rs = [];
    for (let i = 0; i < RUNS; i++) rs.push(sandbox.__runOne(tankId, strat, MONTHS));
    const surv = rs.filter(r => r.survived).length / RUNS;
    const cell = {
      surv: Math.round(surv * 100),
      med: median(rs.map(r => r.months)),
      cash: Math.round(rs.reduce((a, r) => a + r.cash, 0) / RUNS),
      won: (rs.reduce((a, r) => a + r.won, 0) / RUNS).toFixed(1),
      lost: (rs.reduce((a, r) => a + r.lost, 0) / RUNS).toFixed(1),
    };
    summary[`${tankId}/${strat}`] = cell;
    console.log(
      tankId.padEnd(12), strat.padEnd(9),
      String(cell.surv + '%').padStart(7),
      String(cell.med).padStart(11),
      String(cell.cash + 'k').padStart(10),
      `${cell.won}/${cell.lost}`.padStart(9));
  }
  console.log('');
}
const overall = s => {
  const cells = Object.entries(summary).filter(([k]) => k.endsWith('/' + s)).map(([, v]) => v.surv);
  return Math.round(cells.reduce((a, b) => a + b, 0) / cells.length);
};
console.log(`overall survival — passive ${overall('passive')}%, naive ${overall('naive')}%, shrewd ${overall('shrewd')}%`);
