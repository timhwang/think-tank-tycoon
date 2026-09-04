# 🏛 THINK TANK TYCOON

*A Strategy Game of Wealth, Power, and Terrible Ideas.*

Run a DC think tank from January 2027 to Election Night, November 2028. **Bank the most policy
victories by election day** and be crowned the most influential think tank in Washington — a victory
goes to whichever institution carried the winning side of a fight hardest, so free-riding pays cash
but never credit. A tabletop-flavored simulator in the spirit of Frontier Lab Tycoon, wearing a
SimCity 2000 costume.

## Run it

```
python3 -m http.server 8769
```

…then open http://localhost:8769. (Or just open `index.html` directly — no build step, no modules, no dependencies.)

## The loop

```
STAFF ──produce──▶ INFLUENCE ──spent on──▶ POLICY FIGHTS ──wins pay──▶ 💰
  ▲                    │
  │                    └──spent on──▶ DONORS ──grants──▶ 💰 ──pays for──▶ STAFF
```

- **Staff.** Scholars produce ✦ influence monthly; each has an issue tag, a lean, a salary, and a quirk. Ops staff support 2 scholars each — unsupported scholars produce at half rate. A rotating hiring market offers generated candidates (signing bonus = 1 month salary, halved for scholars who share your politics, 1.5× for aisle-crossers — and hardline ◀◀/▶▶ shops feel both harder: 60% off / +75%). Scholars also amplify influence you commit to fights matching their tag (+10% each, capped at +50%). Talent is partisan along real lines: left-leaning scholars run deep in climate, tech and health, right-leaning ones in fiscal, defense and trade (`TAG_WEIGHTS` in `data.js`), with a small output bonus in a movement's home fields and a penalty outside them — so a right shop hunting for good TECH mostly finds aisle-crossers at a premium. The **Junior Fellows Program** is the in-house fix: pick a sourcing focus (cycle it from the Programs window) and every four months a cohort resolves — usually a junior in that field, 20% nobody, 15% a star, 10% a stray from another field.
- **Influence.** Spend it on **policy fights** — a rotating board of 4 from a 50-card deck in eight classes (`FIGHT_TYPES` in `data.js`): BILL / EO / NOM are the standard tug-of-war; **HEARING** is fast, pays clout, boosts testimony (+20%, flubs are public) and can put a named rival in the hot seat (probe wins dent their donor confidence; they defend themselves); **RULE** runs a long comment period with a ✦30-per-institution monthly docket cap, so patience beats dumps; **COURT** is long and swingy (flatter odds curve) and seats a permanent ally on the bench; **APPROPS** riders carry marquee cash, every rival treats them as a pet issue, and losers get 40% of their stake back; **STATE** fights are cheap, quick, and ignored by each big shop 60% of the time (`stateRivalSkip`). Each fight is a tug-of-war between two sides; rival think tanks pile on every month — and surge hard into a fight's final month, so a last-minute influence dump meets a wall of closing money. The ⚑ attribution line under each side shows exactly who's backing it and with how much. When the clock hits zero **the wire decides**: influence shares set win odds on a sharpened contest curve (contestK 3.2 — a 2:1 lead wins ~90%, but upsets happen and the Bugle animates every roll). Cash and clout (✦) rewards scale by your share of the winning side, and some fights pay in kind — a grateful scholar joining free, a warm donor intro at half court cost, or amnesty on donor strikes. Rivals sit out fights beyond their pet issues (fewer, deeper piles) and surge into final months.
- **Donors.** Court them with influence (30% cheaper when they share your politics, +40% across the aisle; 40% / +60% for hardline shops); they pay monthly grants. Every donor in the 38-card deck has a **demand** — a scholar tag on the roster, a vanity program running, monthly influence pushed into their pet issue's fights, or ideological purity (back the wrong side of a fight and take an instant strike). Unmet demands = 1 strike/month; two strikes and they walk. Vanity **programs** (gala, podcast, marble lobby) cost money and produce ~nothing, but some of the richest donors won't fund you without them. The perverse incentives are the point. Three 🐋 **whales** (a sovereign wealth fund, a Koch-shaped freedom trust, an AI founders' DAF) offer enormous grants that compound 8% a month — and tolerate one fewer other funder every four months while adding a fresh whim each quarter (a program in their honor, a scholar of their choosing, a side you may not cross, influence in their pet issue). Take the money and dependence follows.
- **Raids & poaching.** Some market scholars sit at a rival (marked **AT [RIVAL]**): hiring one costs a 1.5× signing bonus and permanently dents that rival's influence budget. It cuts both ways — rivals periodically make a run at your best scholars, and you either match the offer (permanent raise) or watch them defect and strengthen that rival. Watch for 🔥 **divas**: enormous output, but colleagues keep quitting over them. Ops staff vary too: 1–3 support capacity plus rainmaker/connector/media/expensive traits. Stale market? **Prospect** buttons re-deal either market — for cash *and* influence, escalating +50% with each sweep so you can't fish for the perfect card.
- **Poaching, both directions.** Rivals court your donors — the ones with strikes, unmet demands, or fickle temperaments first — and you get a month to **re-cultivate** (about 40% of the courting cost, half with a Development Director) or watch them defect. Market donors marked **⚔ FUNDS [RIVAL]** are raids: 1.5× to court, a permanent dent in that rival's budget, and a **vendetta** — that rival poaches your scholars, donors and ops twice as often and runs whisper campaigns against your base for the rest of the game. Online, a raid card can be another human's actual funder; they get the same month to re-cultivate, and your influence is spent either way.
- **Everyone has a base.** Rivals carry a donor-confidence gauge on the leaderboard: wins, losses and their Bugle antics move it, and it scales their spending (Watchful ×0.9, Spooked ×0.75, Exodus ×0.6). The **📁 oppo file** on any leaderboard row commissions a story about them — ✦20 plus ✦10 per prior file, one a month, ~60% to land (better with comms staff): their confidence −12, or it blows back on yours (−8). Rivals take it personally either way. The 💢 chip on a rival's row logs every dent you've put in them (raids, counter-oppo, oppo files); ⚔ marks a vendetta against you.
- **Renewals.** When a grant cycle ends you get one month to renew at half courting cost — on stricter terms (tougher demand, one strike ends it) — or let the money lapse. Long-term **programs** (a house journal, a war room, junior fellows, an endowed chair, buying your own annex) trade heavy cost for compounding advantages over the 22 months.
- **The race.** Every resolved fight awards one victory to the winning side's single top contributor (ties go to you). The HQ leaderboard tracks all seven institutions live; at month 22 the election ends the game and ranks everyone. The final six months are an announced **ELECTION SEASON** — rival spending runs 50% hotter to the wire. The core tension: influence spent on victories is leakage from the scholars→donors engine — glory and growth compete for the same points.
- **Crises.** Roughly every six months the Bugle prints an EXTRA — a scandal, a funder feud, a loudmouth scholar calling a funder “a grift” on air (apologize, stand by them, let them go, or host a very tense dinner), a shutdown that freezes the Hill, a surprise recess — and you must pick your poison before the next month can begin. Every option costs something different; every crisis has a free exit that hurts, and cards that would offend donors name them (and flag who would walk). Ops split into **support generalists** (1–3 scholar capacity) and zero-support **specialists** — comms, development, editor, creative, gov-relations, each with one clear buff — plus a Senior Strategy Consultant who costs the most and does nothing. Both markets carry genuine bad apples: dud scholars (grand résumé, feeble numbers), hidden-dud ops (senior prices, 1-scholar coverage), CHAOTIC ops (3 capacity on paper, 20%/mo they deliver nothing) — no warning chips on the hidden ones; the stats are the tell, and a bad deal is still knowingly hireable when an immediate need justifies it. Prospecting past junk is exactly what the escalating sweep fees are for. Donors follow the same template: called-out perks (ANCHOR never lapses, MEGAPHONE boosts commits, MATCHING pays per other donor), called-out flaws (MEDDLER drags output, FICKLE cuts its own grant, JEALOUS resents new courtships), and blue-chip patrons that only appear once your existing donor base qualifies.
- **Cuts have consequences.** Ops can be let go freely, but firing a scholar unsettles donors (worse if it strands a donor's demand), and parting with a donor demoralizes the scholars whose issue they funded.
- **Donor confidence.** One 0–100 gauge for the whole base (HQ Report). Departures (−15 walked, −10 parted, −8 lapsed), firing a scholar (−5), courting more than one donor a month (−6 each), and holding more donors than your development staff can steward (−2/donor/month; base 3, +2 per Development Director) all shake it. Renewals (+6) and banked victories (+3) restore it, and worries fade +3/month toward 70. A Watchful base (40–69) throws nervous strikes; a Spooked one (20–39) charges +25% to court and double to renew; in Exodus (<20) a donor leaves every month. The cascade is real — and the counter-strategy (a lean, well-stewarded base) turns out to free influence for victories.
- **Scholars who do things.** Some quirks are mechanical (the cable regular mints clout or gaffes on air; the book tour pays; the podcast feud swings; the newsletter soothes donors). In a fight's final month your best matching scholar can **testify**; the button shows the exact odds and stakes (success adds 1.5× their output or a tenth of the other side's pile, whichever is bigger; a flub costs 15% of your stake, capped at the witness's output), and ✦10 preps the witness for +15% odds — free with a Comms Director. And the **revolving door** turns: government taps scholars; let them serve for a permanent ally (+10% on that issue's commits) or pay ✦25 to keep them.
- **The calendar.** State of the Union marquee fights (double rewards), August recess (no new fights, cheaper courting), the one-year-out standings, and a March 2028 endorsement dilemma. Rival moves and lead changes make the Bugle. Sound effects are synthesized in-page; mute from the top bar.
- **Election Night.** Returns come in live, then the Bugle prints the campaign recap — the numbers, your biggest wins and worst losses with their fight icons, why it went that way, the moments, and titles earned as pixel badges (ten, from THE SANDBAGGER to DIRTY TRICKSTER). A Hall of Records on the start screen keeps your finishes.
- **Tutorial.** A guided tour of every panel runs the first time you enter a game (Tour button replays it).
- **Morale.** Lose a fight you contested and its issue's scholars are demoralized (−25% output for 2 months); lose that issue again while they're down and some leave for greener pastures. A win in their field restores them instantly. Contest a fight where you employ **no matching scholars** (⚠ no bench on the card) and lose, and the **entire roster** is demoralized — wander outside your lanes at your peril.
- **Rivals with brains.** Every rival has a style — the Establishment funds broadly and defends its leads, the Battleship picks two fights and closes hard, the Dealmaker rides favorites for cheap credit, the Insurgent hunts upsets, the Sniper hoards then dumps, the Purist never crosses its lean, BLAND mirrors the leader — with four knobs each (`ai:` on the tank: focus, patience, aggression, grudge). Your institution's difficulty sets how much of it they use: every tier prices every fight (the influence needed to reach ~80% odds *and* top credit), funds the cheapest victories, and banks the rest in a war chest whose patience is a matter of style — **Easy** rivals just raise less (`aiIncomeByLevel`); **Medium** rivals raise real money; **Hard** rivals also poach with aim (your best scholar in the field they keep losing), add issues they lose twice to their portfolio, pool credit and deny the leader; **Expert** sharpens their targets and has the deepest pockets. (The old dice-rolling sprinkler survives behind `aiDiceLevel` for anyone who wants a story mode.) It's legible: hover a rival on the leaderboard for their chest, this month's spending and what they're eyeing, the Bugle reports hoarding and all-in months, and a Gov Relations Lead reads their intentions onto the fight cards. The optimizer replaced most of the old handicaps (drift, frontrunner heat and closing multipliers were all dialed down).
- **The town keeps up.** No rival's income falls below a share of the best human economy in the campaign (`rivalTrackPct`: 25% each on Easy, 30/35/40% on Medium/Hard/Expert — across six rivals that's 1.5–2.4× your output in aggregate), so a ✦200/mo machine faces ✦60–80/mo rivals instead of ✦40 ones; rivals hit 15% harder in their pet issues (`rivalBenchBonus`, their version of your expertise bonus); and from Hard up (`aiPoolLevel`) rivals **pool credit** — a junior stake folds into the biggest rival pile already on a shared side (two partners at most), so the human has to out-bid the pool, not the largest fragment — and will spend a whole chest to deny the human leader credit (`aiDenyLevel`). The sim's shrewd bot can't win Hard or Expert under those rules; a good human can.
- **The town hates a winner.** Rival budgets drift upward all game, crisis price tags scale with your treasury and production, and whenever you lead the leaderboard (🔥) every rival spends ~30% harder and throws extra weight against the sides you top. Sandbagging at #2 until late is a legitimate strategy.
- **Losing.** Two consecutive months in the red and the institution folds before the election. The treadmill is real: every December payroll rises 9%, donor grants sunset on 10–20 month cycles, and scholars quit after two straight months without ops support.

## Playing together (online campaigns)

Two to six humans in one shared campaign, each running a different institution; the unpicked ones play as AI rivals. From the start screen, **create a campaign** and send the five-letter code, or **join** one. Everyone shares the same fight board (you can back the same side as a friend and outbid them for the credit), humans appear on the leaderboard and in the ⚑ backer lines by name, and the month advances when every player has ended theirs — or when the campaign's **turn clock** runs out (1/2/5/10 minutes, chosen at creation, counting down in the top bar), so one absent player never stalls the table. The clock is a Durable Object alarm: when it fires, every open player is ended for them (an open crisis takes its free exit) and the month resolves.

The server is a Cloudflare Worker with one **Durable Object per campaign** (`worker/`). It runs the *same* engine as the browser: `tools/build-worker.js` bundles `data.js` + `game.js` with browser stubs into `worker/src/engine.js`, and the Worker calls `createCampaign` / `applyAction` / `resolveMonth` / `viewFor` on it. The client (`game.js`, the `NET` section) renders the server's view and forwards actions; it never mutates state locally while online.

```
cd worker && npm install
npm run dev      # rebuild the engine bundle and run locally on :8787
npm run deploy   # rebuild and deploy to <name>.<account>.workers.dev
```

Rebuild the bundle (`node tools/build-worker.js`) after any change to `data.js` or `game.js`, then redeploy. The client's default server URL is `NET_DEFAULT_URL` in `game.js`; set `localStorage['ttt-net-url']` to point a browser at a local Worker.

Engine notes for the shared world: `W` holds world state (month, fights, decks, rivals, calendar), `G` the current institution; single-player sets `W === G`. Fight-side contributions are per player (`side.players[pid]`), victory credit goes to the top contributor among rivals *and* humans, and the month runs in three phases — `monthWorldPre` (rivals, resolution, the town) once, `monthPlayer` per human, `monthWorldPost` (board refill, calendar, election) once.

## Balance

Tuned by Monte Carlo (`node tools/simulate.js [runs]`), which stubs the DOM, loads the real engine, and drives three bot strategies through the full 22-month campaign. Current numbers (300 runs/cell, win = ranked #1 on Election Night):

| strategy | wins the election | notes |
|---|---|---|
| passive (never acts) | **0%** | crises and renewals go unanswered; the institution hollows out |
| naive (random-ish moves) | **~1%** | chaos rarely crowns a fool anymore |
| shrewd (builds positions, buys odds, stewards a lean base) | **~27%** | the per-tank ladder is the point now: Easy tanks 48–52%, Medium 25–33%, Hard/Expert (pooled credit, leader denial) ~0% for the bot — deliberately below the old 45–50% because a good human beats this bot handily |

This is deliberately a hard game: probabilistic resolutions cap certainty, crises charge what you can
afford, no-bench losses hit the whole roster, and the frontrunner-heat mechanic means the better you're
doing, the harder the town pushes back. Ease it via `frontrunnerMult`, `rivalDriftPct`, or `crisisCashPct`.

The levers live in `TUNE` (`rivalBudgetMult`, `fightCashMult`, `grantMult`, `courtCostMult`, `scholarOutMult`, `annualRaisePct`, `grantTermMin/Max`, `electionMonth`). The rival-brain knobs (`aiTargetOdds`, `aiBuffer`, `aiIncomeMult`, `aiMaxShare`, `aiChestMonths`) only touch Medium-and-up rivals, so Easy is tuned with `rivalDriftPct`/`frontrunnerMult` and the thinking tiers with those; target odds saturate around 0.8, after which `aiIncomeMult` is the lever. Rerun the harness after touching any; `TUNE_PATCH='{"rivalBudgetMult":0.7}' node tools/simulate.js` tests a patch without editing files. The win rate is steeply sensitive to `rivalBudgetMult` (0.7 → 88%, 0.9 → 14%), so tune in small steps.

## Institutions

Six playable parody tanks across the spectrum and size ladder — from The Hutchings Institution (LARGE, Easy) down to The Subsidiarity Project (TINY, Expert) — plus The BLAND Corporation as a permanent NPC rival. Unchosen tanks become AI rivals who spend their influence budgets on fights matching their politics and pet issues.

## Layout

Top row: **Policy Fights** (the arena) beside the **Hiring Market** and **Donor Market** (the decks).
Bottom row: **Your Institution** (staff / programs / donors) beside the **HQ Report** (record, monthly ledger, influence, and The Opposition roster). The Beltway Bugle runs as a ticker along the bottom.

## Files

| file | what |
|---|---|
| `index.html` | shell, windows layout, help text |
| `style.css` | SimCity 2000 costume (bevels, dithered teal desktop, newsprint modal) |
| `data.js` | all content: `TUNE` knobs, tanks, donor deck, fight deck, programs, name/quirk pools |
| `game.js` | engine: state, turn resolution, rival AI, rendering, localStorage autosave |
| `icons/` | 86 pixel-art icons (every fight, donor, program, and tank, plus 12 scholar portraits and 8 ops roles) |
| `og.jpg` | social sharing card (JPEG ≤ ~300KB — big PNGs make unfurl scrapers give up) |
| `tools/gen_icons.py` | icon/social-card generator (OpenAI Images API → 64×64 quantized pixel art) |
| `tools/simulate.js` | Monte Carlo balance harness (real engine, stubbed DOM, bot strategies) |
| `tools/build-worker.js` | bundles the engine for the Worker (`worker/src/engine.js`, generated) |
| `worker/` | Cloudflare Worker + Durable Object campaign server (`src/index.js`) |

All balance lives in `TUNE` (top of `data.js`) and the deck entries — tweak numbers there, no engine changes needed.

### Regenerating art

Key goes in `.openai-key` at the repo root (gitignored) or `$OPENAI_API_KEY`. Then:

```
python3 tools/gen_icons.py                    # any missing icons
python3 tools/gen_icons.py --only donor_crypto --force   # redo one
python3 tools/gen_icons.py --og               # social card
```

Icon prompts live in the `ICONS` dict in that script; game.js looks up art by key (`fight_<id>`, `donor_<id>`, `program_<id>`, `tank_<id>`, `scholar_1..12`, `ops_1..8`) and degrades gracefully if a PNG is missing.

## Iteration ideas (not yet built)

- Elections every 24 months that flip which side-leans are ascendant (rewards shift).
- The Bugle's dysfunction desk driving occasional mechanical events (a shutdown freezing fight clocks, a vacated speakership reshuffling leans).
- Scandal/event deck (scholar quirks become mechanical).
- A Reputation stat separate from influence; donor tiers gated on it.
- Rivals courting donors out of the shared market; scholar poaching.
- Draggable windows, SC2K query-tool sounds, save slots.
- Deep-pocket "restricted gift" donors that pay huge but lock influence usage.
