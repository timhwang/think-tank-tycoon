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
const fmtSigned = n => (n >= 0 ? '+' : '−') + fmtMoney(Math.abs(n)).replace('$', '$');

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
  let out = Math.round(salary * 0.45) + ri(0, 8);
  let name = genName(Math.random() < 0.75);
  let big = false;
  if (!starter && Math.random() < 0.12) { big = true; out += 10; }
  return {
    id: uid++, kind: 'scholar', name, big,
    tag: pick(TAGS), salary: salary + (big ? 15 : 0), out,
    quirk: pick(SCHOLAR_QUIRKS),
  };
}

function genOps() {
  return {
    id: uid++, kind: 'ops', name: genName(false),
    role: pick(OPS_ROLES), salary: ri(7, 12), supports: TUNE.supportRatio,
    quirk: pick(OPS_QUIRKS),
  };
}

function buildRivals(chosenId) {
  const rivals = TANKS.filter(t => t.id !== chosenId).map(t => ({
    short: t.short, name: t.name, align: t.align, budget: t.budget, tags: t.tags,
  }));
  NPC_TANKS.forEach(t => rivals.push({ short: t.short, name: t.name, align: t.align, budget: t.budget, tags: t.tags }));
  return rivals;
}

function mkDonorInstance(defId) {
  const d = DONORS.find(x => x.id === defId);
  return { ...d, demand: { ...d.demand }, strikes: 0, joined: G ? G.month : 0 };
}

function drawFight() {
  if (!G.fightDeck.length) {
    const active = new Set(G.fights.map(f => f.defId));
    G.fightDeck = shuffle(FIGHTS.map(f => f.id).filter(id => !active.has(id)));
  }
  const defId = G.fightDeck.pop();
  const def = FIGHTS.find(f => f.id === defId);
  G.fights.push({
    defId, type: def.type, tag: def.tag, reward: def.reward,
    title: def.title.replace('{NOM}', genName(true)),
    monthsLeft: def.months,
    sides: def.sides.map(s => ({ label: s.label, lean: s.lean, total: 0, yours: 0 })),
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
    log: [], negStreak: 0, over: false,
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

function monthlyCosts() {
  let c = tank().rent;
  G.scholars.forEach(s => c += s.salary);
  G.ops.forEach(o => c += o.salary);
  PROGRAMS.forEach(p => { if (G.programs[p.id]) c += p.cost; });
  return c;
}

function monthlyGrants() { return G.donors.reduce((a, d) => a + d.grant, 0); }

// ---------- demands ----------
function demandText(d) {
  const dm = d.demand;
  if (dm.type === 'ROSTER') return `Wants a ${dm.tag} scholar on staff`;
  if (dm.type === 'PROGRAM') return `Wants the ${PROGRAMS.find(p => p.id === dm.pid).name} running`;
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

// ---------- player actions ----------
function actHire(idx) {
  const h = G.hireMarket[idx];
  if (!h) return;
  const bonus = h.salary * TUNE.signingMonths;
  if (G.cash < bonus) return flash(`Signing bonus is ${fmtMoney(bonus)}. You don’t have it.`);
  G.cash -= bonus;
  G.hireMarket.splice(idx, 1);
  (h.kind === 'scholar' ? G.scholars : G.ops).push(h);
  drawHire();
  logLine(`Hired ${h.name} (${h.kind === 'scholar' ? TAG_NAMES[h.tag] : h.role}). Signing bonus ${fmtMoney(bonus)}.`);
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
  if (G.influence < d.cost) return flash(`Courting ${d.name} takes ${d.cost} influence. You have ${G.influence}.`);
  G.influence -= d.cost;
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
  side.total += amt;
  side.yours += amt;
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
      if (amt > 0) t.f.sides[t.sideIdx].total += amt;
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

  // 9. slow news day?
  if (Math.random() < TUNE.flavorChance) news.push({ h: pick(FLAVOR_HEADLINES), s: '' });

  G.month++;
  G.stats.peakCash = Math.max(G.stats.peakCash, G.cash);
  save(); render();
  if (news.length) showPaper(news);
}

function resolveFight(f, news) {
  const [a, b] = f.sides;
  const winner = a.total === b.total ? pick([a, b]) : (a.total > b.total ? a : b);
  const loser = winner === a ? b : a;
  const tie = a.total === b.total;
  let sub = `“${winner.label}” prevails ${winner.total}–${loser.total}${tie ? ' after a coin flip nobody will discuss' : ''}.`;

  if (winner.yours > 0) {
    const share = winner.total > 0 ? winner.yours / winner.total : 1;
    const pay = Math.round(f.reward * share);
    G.cash += pay;
    G.stats.won++;
    sub += ` ${tank().short} claims credit everywhere; grateful allies deliver ${fmtMoney(pay)} in grants.`;
    news.push({ h: `${f.title.toUpperCase()} — RESOLVED`, s: sub, big: true });
    logLine(`WIN: ${f.title} → ${fmtMoney(pay)} (your share of the winning side: ${Math.round(share * 100)}%).`);
  } else if (loser.yours > 0) {
    G.stats.lost++;
    sub += ` ${tank().short} spent ${loser.yours} influence on the losing side. A fellow calls it “directionally correct.”`;
    news.push({ h: `${f.title.toUpperCase()} — RESOLVED`, s: sub });
    logLine(`LOSS: ${f.title}. ${loser.yours} influence down the drain.`);
  } else {
    news.push({ h: `${f.title.toUpperCase()} — RESOLVED`, s: sub + ' You watched from the sidelines.' });
    logLine(`${f.title} resolved without you.`);
  }
}

function gameOver(news) {
  G.over = true;
  save();
  render();
  const s = G.stats;
  showPaper([
    { h: `${tank().name.toUpperCase()} FOLDS`, s: 'Fellows scatter to podcasts. The donor wall is auctioned by the marble pound.', big: true },
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
  $('#continueRow').innerHTML = hasSave
    ? `<button class="btn big" data-act="continue">▶ Resume Saved Game</button>` : '';
  $('#tankPicker').innerHTML = TANKS.map(t => `
    <div class="card tankcard">
      <div class="cardhead">${t.name}</div>
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
  $('#tbDate').textContent = dateStr(G.month);
  $('#tbCash').innerHTML = `${fmtMoney(G.cash)} <span class="dim">(${fmtSigned(net)}/mo)</span>`;
  $('#tbCash').className = G.cash < 0 ? 'tbval bad' : 'tbval';
  $('#tbInf').innerHTML = `✦ ${G.influence} <span class="dim">(+${production()}/mo)</span>`;
  $('#tbStaff').textContent = `${G.scholars.length} scholars / ${cap} supported`;

  renderStaff(cap);
  renderPrograms();
  renderMyDonors();
  renderFights();
  renderBugle();
  renderHireMarket();
  renderDonorMarket();
}

function renderStaff(cap) {
  const rows = [];
  G.scholars.forEach((s, i) => {
    const supported = i < cap;
    rows.push(`
      <div class="person ${supported ? '' : 'unsup'}">
        <div class="pline">
          <b>${s.name}</b>${s.big ? ' <span class="star" title="Big Name">★</span>' : ''} ${tagChip(s.tag)}
          ${supported ? '' : '<span class="warn" title="No ops support — producing at half rate">⚠ half rate</span>'}
        </div>
        <div class="pline dim">${TAG_NAMES[s.tag]} · ✦ ${supported ? s.out : Math.floor(s.out * TUNE.unsupportedMult)}/mo · ${fmtMoney(s.salary)}/mo</div>
        <div class="pline quirk">${s.quirk}</div>
        <button class="btn tiny" data-act="fire" data-kind="scholar" data-id="${s.id}">Let Go</button>
      </div>`);
  });
  if (!G.scholars.length) rows.push('<div class="empty">No scholars. No scholars, no influence.</div>');
  rows.push('<div class="subdivider">OPERATIONS</div>');
  G.ops.forEach(o => {
    rows.push(`
      <div class="person">
        <div class="pline"><b>${o.name}</b> <span class="chip">${o.role}</span></div>
        <div class="pline dim">Supports ${o.supports} scholars · ${fmtMoney(o.salary)}/mo</div>
        <div class="pline quirk">${o.quirk}</div>
        <button class="btn tiny" data-act="fire" data-kind="ops" data-id="${o.id}">Let Go</button>
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
        <div class="pline"><b>${p.name}</b> ${on ? '<span class="chip on">RUNNING</span>' : ''} ${wanted ? '<span class="chip want" title="A current donor demands this">DONOR BAIT</span>' : ''}</div>
        <div class="pline dim">${fmtMoney(p.cost)}/mo${p.inf ? ` · ✦ +${p.inf}/mo` : ' · produces nothing'}</div>
        <div class="pline quirk">${p.blurb}</div>
        <button class="btn tiny" data-act="prog" data-id="${p.id}">${on ? 'Shut Down' : 'Launch'}</button>
      </div>`;
  }).join('');
}

function renderMyDonors() {
  const rows = G.donors.map(d => {
    const met = demandMet(d);
    return `
      <div class="person donor">
        <div class="pline"><b>${d.name}</b> ${leanChip(d.lean)}</div>
        <div class="pline dim">${fmtMoney(d.grant)}/mo</div>
        <div class="pline ${met ? 'ok' : 'warn'}">${met ? '✓' : '✗'} ${demandText(d)}</div>
        <div class="pline dim">Strikes: ${'●'.repeat(d.strikes)}${'○'.repeat(Math.max(0, TUNE.strikeLimit - d.strikes))}${d.strikes === TUNE.strikeLimit - 1 ? ' <span class="warn">— one more and they walk</span>' : ''}</div>
        <button class="btn tiny" data-act="drop" data-id="${d.id}">Part Ways</button>
      </div>`;
  });
  $('#myDonorsBody').innerHTML = rows.join('') || '<div class="empty">No funders. The treasury drains.</div>';
}

function renderFights() {
  $('#fightsBody').innerHTML = G.fights.map((f, fi) => {
    const [a, b] = f.sides;
    const total = a.total + b.total;
    const pctA = total === 0 ? 50 : Math.max(4, Math.min(96, Math.round(a.total / total * 100)));
    return `
      <div class="card fightcard">
        <div class="cardhead fight">
          <span class="ftype ${f.type}">${f.type}</span> ${f.title}
        </div>
        <div class="cardbody">
          <div class="fightmeta">${tagChip(f.tag)} <span class="chip">⏳ ${f.monthsLeft} mo</span> <span class="chip gold">🏆 ${fmtMoney(f.reward)}</span></div>
          <div class="tug"><div class="tugA" style="width:${pctA}%"></div></div>
          ${f.sides.map((s, si) => `
            <div class="sideline">
              <span class="sidelabel">${si === 0 ? '◤' : '◢'} ${s.label} ${leanChip(s.lean)}</span>
              <span class="sidenums">${s.total} <span class="dim">(you ${s.yours})</span></span>
              <span class="sidebtns">
                <button class="btn tiny" data-act="commit" data-f="${fi}" data-s="${si}" data-amt="5">+5</button>
                <button class="btn tiny" data-act="commit" data-f="${fi}" data-s="${si}" data-amt="25">+25</button>
              </span>
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');
  $('#fightDeckCount').textContent = `DECK: ${G.fightDeck.length}`;
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
          <div class="cardbody">
            <div class="pline">${tagChip(h.tag)} <span class="dim">${TAG_NAMES[h.tag]}</span></div>
            <div class="pline">✦ ${h.out}/mo · ${fmtMoney(h.salary)}/mo</div>
            <div class="pline quirk">${h.quirk}</div>
            <button class="btn tiny" data-act="hire" data-idx="${i}">Hire (${fmtMoney(h.salary * TUNE.signingMonths)} bonus)</button>
          </div>
        </div>`;
    }
    return `
      <div class="card hirecard ops">
        <div class="cardhead small">${h.name}</div>
        <div class="cardbody">
          <div class="pline"><span class="chip">OPS</span> <span class="dim">${h.role}</span></div>
          <div class="pline">Supports ${h.supports} scholars · ${fmtMoney(h.salary)}/mo</div>
          <div class="pline quirk">${h.quirk}</div>
          <button class="btn tiny" data-act="hire" data-idx="${i}">Hire (${fmtMoney(h.salary * TUNE.signingMonths)} bonus)</button>
        </div>
      </div>`;
  }).join('');
}

function renderDonorMarket() {
  $('#donorMarketBody').innerHTML = G.donorMarket.map((d, i) => `
    <div class="card hirecard donor">
      <div class="cardhead small">${d.name}</div>
      <div class="cardbody">
        <div class="pline">${leanChip(d.lean)} <b>${fmtMoney(d.grant)}/mo</b></div>
        <div class="pline warn">Demands: ${demandText(d)}</div>
        <div class="pline quirk">${d.blurb}</div>
        <button class="btn tiny" data-act="court" data-idx="${i}" ${G.influence < d.cost ? 'disabled' : ''}>Court (✦ ${d.cost})</button>
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
  else if (act === 'drop') actDrop(+b.dataset.id);
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
