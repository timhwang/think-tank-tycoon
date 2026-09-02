// Think Tank Tycoon — campaign server.
// One Durable Object per campaign room holds the shared world and every
// player's institution, and runs the real game engine (bundled in engine.js)
// to apply actions and resolve months once everyone has ended theirs.
import { createCampaign, applyAction, canEnd, resolveMonth, viewFor, autoCrisis } from './engine.js';

const TURN_DEFAULT = 120, TURN_MIN = 30, TURN_MAX = 900;

const ALLOWED_ORIGINS = ['https://timhwang.github.io', 'http://localhost:8769', 'http://127.0.0.1:8769'];

function cors(req) {
  const origin = req.headers.get('Origin') || '';
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
const json = (req, obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...cors(req) } });

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 5 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
const makeToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'room') return json(req, { ok: true, service: 'think-tank-tycoon campaign server' });
    // POST /room -> create; everything else is /room/:CODE/...
    let code = parts[1];
    if (!code) {
      if (req.method !== 'POST') return json(req, { error: 'POST to create a room' }, 405);
      code = makeCode();
    }
    code = code.toUpperCase();
    const id = env.CAMPAIGN.idFromName(code);
    const stub = env.CAMPAIGN.get(id);
    const forward = new Request(`https://campaign/${code}/${parts.slice(2).join('/')}${url.search}`, req);
    const res = await stub.fetch(forward);
    const body = await res.text();
    return new Response(body, { status: res.status, headers: { 'Content-Type': 'application/json', ...cors(req) } });
  },
};

export class Campaign {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async load() {
    if (!this.meta) this.meta = (await this.state.storage.get('meta')) || null;
    if (!this.world && this.meta && this.meta.phase !== 'lobby') this.world = await this.state.storage.get('world');
    return this.meta;
  }

  async saveAll() {
    await this.state.storage.put('meta', this.meta);
    if (this.world) await this.state.storage.put('world', this.world);
  }

  auth(pid, token) {
    const p = this.meta && this.meta.players.find(x => x.pid === pid);
    return p && p.token === token ? p : null;
  }

  async fetch(req) {
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean); // [CODE, action?]
    const code = parts[0];
    const action = parts[1] || '';
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const q = Object.fromEntries(url.searchParams);
    const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status });

    await this.load();

    // ---- create ----
    if (!action && req.method === 'POST') {
      if (this.meta) return reply({ error: 'Room exists' }, 409);
      const name = String(body.name || 'Host').slice(0, 24);
      const pid = 'p1', token = makeToken();
      const turnSeconds = Math.max(TURN_MIN, Math.min(TURN_MAX, +body.turnSeconds || TURN_DEFAULT));
      this.meta = { code, phase: 'lobby', created: Date.now(), hostPid: pid, turnSeconds, turnStarted: null,
        players: [{ pid, name, tankId: body.tankId, token, ended: false }] };
      await this.saveAll();
      return reply({ code, pid, token });
    }
    if (!this.meta) return reply({ error: 'No such room' }, 404);

    // ---- join ----
    if (action === 'join') {
      if (this.meta.phase !== 'lobby') return reply({ error: 'Campaign already started' }, 409);
      if (this.meta.players.length >= 6) return reply({ error: 'Room is full' }, 409);
      if (this.meta.players.some(p => p.tankId === body.tankId)) return reply({ error: 'That institution is taken' }, 409);
      const pid = 'p' + (this.meta.players.length + 1), token = makeToken();
      this.meta.players.push({ pid, name: String(body.name || 'Player').slice(0, 24), tankId: body.tankId, token, ended: false });
      await this.saveAll();
      return reply({ code, pid, token });
    }

    // everything below needs auth
    const me = this.auth(body.pid || q.pid, body.token || q.token);
    if (!me) return reply({ error: 'Not a member of this room' }, 403);

    // ---- lobby state / start ----
    if (action === 'start') {
      if (me.pid !== this.meta.hostPid) return reply({ error: 'Only the host starts' }, 403);
      if (this.meta.phase !== 'lobby') return reply({ error: 'Already started' }, 409);
      if (this.meta.players.length < 2) return reply({ error: 'Need at least two institutions' }, 409);
      this.world = createCampaign(this.meta.players.map(p => ({ pid: p.pid, name: p.name, tankId: p.tankId })));
      this.meta.phase = 'playing';
      this.meta.monthSeq = 0;
      await this.startClock();
      await this.saveAll();
    }

    // the shot clock ran out while nobody was looking: resolve on the next read
    if (this.meta.phase === 'playing' && this.clockExpired()) {
      await this.forceResolve();
      await this.saveAll();
    }

    if (action === 'action') {
      if (this.meta.phase !== 'playing') return reply({ error: 'Campaign not in play' }, 409);
      if (me.ended) return reply({ error: 'You already ended this month — waiting on the others.' }, 409);
      const r = applyAction(this.world, me.pid, body.type, body.args);
      await this.saveAll();
      if (!r.ok && r.msg) return reply({ ...this.view(me), error: r.msg });
      return reply(this.view(me));
    }

    if (action === 'end') {
      if (this.meta.phase !== 'playing') return reply({ error: 'Campaign not in play' }, 409);
      const why = canEnd(this.world, me.pid);
      if (why) return reply({ ...this.view(me), error: why });
      me.ended = true;
      const live = this.meta.players.filter(p => !this.world.players.find(w => w.pid === p.pid).over);
      if (live.every(p => p.ended)) await this.advance();
      await this.saveAll();
      return reply(this.view(me));
    }

    if (action === 'leave') {
      this.meta.players = this.meta.players.filter(p => p.pid !== me.pid);
      if (this.world) this.world.players = this.world.players.filter(p => p.pid !== me.pid);
      await this.saveAll();
      return reply({ ok: true });
    }

    // default: state
    return reply(this.view(me));
  }

  // ---- the shot clock ----
  clockExpired() {
    return !!this.meta.turnStarted && Date.now() > this.meta.turnStarted + this.meta.turnSeconds * 1000 + 2000;
  }

  async startClock() {
    this.meta.turnStarted = Date.now();
    await this.state.storage.setAlarm(this.meta.turnStarted + this.meta.turnSeconds * 1000 + 1500);
  }

  // resolve the month: everyone still open is ended for them (crises take the free exit)
  async advance() {
    const over = resolveMonth(this.world);
    this.meta.players.forEach(p => p.ended = false);
    this.meta.monthSeq = (this.meta.monthSeq || 0) + 1;
    if (over) { this.meta.phase = 'over'; this.meta.turnStarted = null; await this.state.storage.deleteAlarm(); }
    else await this.startClock();
  }

  async forceResolve() {
    if (!this.world || this.meta.phase !== 'playing') return;
    for (const p of this.meta.players) {
      const P = this.world.players.find(w => w.pid === p.pid);
      if (!P || P.over || p.ended) continue;
      if (P.crisis) autoCrisis(this.world, p.pid);
      p.ended = true;
      p.timedOut = (p.timedOut || 0) + 1;
    }
    await this.advance();
  }

  async alarm() {
    await this.load();
    if (!this.meta || this.meta.phase !== 'playing') return;
    if (!this.clockExpired()) { await this.state.storage.setAlarm(this.meta.turnStarted + this.meta.turnSeconds * 1000 + 1500); return; }
    await this.forceResolve();
    await this.saveAll();
  }

  view(me) {
    const base = {
      code: this.meta.code, phase: this.meta.phase, hostPid: this.meta.hostPid, monthSeq: this.meta.monthSeq || 0,
      turnSeconds: this.meta.turnSeconds, turnStarted: this.meta.turnStarted, now: Date.now(),
      players: this.meta.players.map(p => ({ pid: p.pid, name: p.name, tankId: p.tankId, ended: p.ended })),
    };
    if (this.meta.phase === 'lobby' || !this.world) return base;
    const v = viewFor(this.world, me.pid);
    return { ...base, ...v, waiting: this.meta.players.filter(p => !p.ended).map(p => p.name) };
  }
}
