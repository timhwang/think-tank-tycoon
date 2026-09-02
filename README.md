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

- **Staff.** Scholars produce ✦ influence monthly; each has an issue tag, a lean, a salary, and a quirk. Ops staff support 2 scholars each — unsupported scholars produce at half rate. A rotating hiring market offers generated candidates (signing bonus = 1 month salary, halved for scholars who share your politics, 1.5× for aisle-crossers — and hardline ◀◀/▶▶ shops feel both harder: 60% off / +75%). Scholars also amplify influence you commit to fights matching their tag (+10% each, capped at +50%).
- **Influence.** Spend it on **policy fights** (bills, executive orders, nominations — a rotating board of 4 from a 30-card deck). Each fight is a tug-of-war between two sides; rival think tanks pile on every month — and surge hard into a fight's final month, so a last-minute influence dump meets a wall of closing money. The ⚑ attribution line under each side shows exactly who's backing it and with how much. When the clock hits zero **the wire decides**: influence shares set win odds on a sharpened contest curve (contestK 3.2 — a 2:1 lead wins ~90%, but upsets happen and the Bugle animates every roll). Cash and clout (✦) rewards scale by your share of the winning side, and some fights pay in kind — a grateful scholar joining free, a warm donor intro at half court cost, or amnesty on donor strikes. Rivals sit out fights beyond their pet issues (fewer, deeper piles) and surge into final months.
- **Donors.** Court them with influence (30% cheaper when they share your politics, +40% across the aisle; 40% / +60% for hardline shops); they pay monthly grants. Every donor in the 26-card deck has a **demand** — a scholar tag on the roster, a vanity program running, monthly influence pushed into their pet issue's fights, or ideological purity (back the wrong side of a fight and take an instant strike). Unmet demands = 1 strike/month; two strikes and they walk. Vanity **programs** (gala, podcast, marble lobby) cost money and produce ~nothing, but some of the richest donors won't fund you without them. The perverse incentives are the point.
- **Raids & poaching.** Some market scholars sit at a rival (marked **AT [RIVAL]**): hiring one costs a 1.5× signing bonus and permanently dents that rival's influence budget. It cuts both ways — rivals periodically make a run at your best scholars, and you either match the offer (permanent raise) or watch them defect and strengthen that rival. Watch for 🔥 **divas**: enormous output, but colleagues keep quitting over them. Ops staff vary too: 1–3 support capacity plus rainmaker/connector/media/expensive traits. Stale market? **Prospect** buttons re-deal either market — for cash *and* influence, escalating +50% with each sweep so you can't fish for the perfect card.
- **Renewals.** When a grant cycle ends you get one month to renew at half courting cost — on stricter terms (tougher demand, one strike ends it) — or let the money lapse. Long-term **programs** (a house journal, a war room, junior fellows, an endowed chair, buying your own annex) trade heavy cost for compounding advantages over the 22 months.
- **The race.** Every resolved fight awards one victory to the winning side's single top contributor (ties go to you). The HQ leaderboard tracks all seven institutions live; at month 22 the election ends the game and ranks everyone. The final six months are an announced **ELECTION SEASON** — rival spending runs 50% hotter to the wire. The core tension: influence spent on victories is leakage from the scholars→donors engine — glory and growth compete for the same points.
- **Crises.** Roughly every six months the Bugle prints an EXTRA — a scandal, a funder feud, a shutdown that freezes the Hill, a surprise recess — and you must pick your poison before the next month can begin. Every option costs something different; every crisis has a free exit that hurts. Ops split into **support generalists** (1–3 scholar capacity) and zero-support **specialists** — comms, development, editor, creative, gov-relations, each with one clear buff — plus a Senior Strategy Consultant who costs the most and does nothing. Both markets carry genuine bad apples: dud scholars (grand résumé, feeble numbers), hidden-dud ops (senior prices, 1-scholar coverage), CHAOTIC ops (3 capacity on paper, 20%/mo they deliver nothing) — no warning chips on the hidden ones; the stats are the tell, and a bad deal is still knowingly hireable when an immediate need justifies it. Prospecting past junk is exactly what the escalating sweep fees are for. Donors follow the same template: called-out perks (ANCHOR never lapses, MEGAPHONE boosts commits, MATCHING pays per other donor), called-out flaws (MEDDLER drags output, FICKLE cuts its own grant, JEALOUS resents new courtships), and blue-chip patrons that only appear once your existing donor base qualifies.
- **Cuts have consequences.** Ops can be let go freely, but firing a scholar unsettles donors (worse if it strands a donor's demand), and parting with a donor demoralizes the scholars whose issue they funded.
- **Donor confidence.** One 0–100 gauge for the whole base (HQ Report). Departures (−15 walked, −10 parted, −8 lapsed), firing a scholar (−5), courting more than one donor a month (−6 each), and holding more donors than your development staff can steward (−2/donor/month; base 3, +2 per Development Director) all shake it. Renewals (+6) and banked victories (+3) restore it, and worries fade +3/month toward 70. A Watchful base (40–69) throws nervous strikes; a Spooked one (20–39) charges +25% to court and double to renew; in Exodus (<20) a donor leaves every month. The cascade is real — and the counter-strategy (a lean, well-stewarded base) turns out to free influence for victories.
- **Scholars who do things.** Some quirks are mechanical (the cable regular mints clout or gaffes on air; the book tour pays; the podcast feud swings; the newsletter soothes donors). In a fight's final month your best matching scholar can **testify** — 1.5× their output to your side on success, a quarter of your stake on a flub. And the **revolving door** turns: government taps scholars; let them serve for a permanent ally (+10% on that issue's commits) or pay ✦25 to keep them.
- **The calendar.** State of the Union marquee fights (double rewards), August recess (no new fights, cheaper courting), the one-year-out standings, and a March 2028 endorsement dilemma. Rival moves and lead changes make the Bugle. Sound effects are synthesized in-page; mute from the top bar.
- **Election Night.** Returns come in live, then the Bugle prints the campaign recap — the numbers, why it went that way, the moments, and titles earned. A Hall of Records on the start screen keeps your finishes.
- **Tutorial.** A guided tour of every panel runs the first time you enter a game (Tour button replays it).
- **Morale.** Lose a fight you contested and its issue's scholars are demoralized (−25% output for 2 months); lose that issue again while they're down and some leave for greener pastures. A win in their field restores them instantly. Contest a fight where you employ **no matching scholars** (⚠ no bench on the card) and lose, and the **entire roster** is demoralized — wander outside your lanes at your peril.
- **The town hates a winner.** Rival budgets drift upward all game, crisis price tags scale with your treasury and production, and whenever you lead the leaderboard (🔥) every rival spends ~30% harder and throws extra weight against the sides you top. Sandbagging at #2 until late is a legitimate strategy.
- **Losing.** Two consecutive months in the red and the institution folds before the election. The treadmill is real: every December payroll rises 9%, donor grants sunset on 10–20 month cycles, and scholars quit after two straight months without ops support.

## Balance

Tuned by Monte Carlo (`node tools/simulate.js [runs]`), which stubs the DOM, loads the real engine, and drives three bot strategies through the full 22-month campaign. Current numbers (300 runs/cell, win = ranked #1 on Election Night):

| strategy | wins the election | notes |
|---|---|---|
| passive (never acts) | **0%** | crises and renewals go unanswered; the institution hollows out |
| naive (random-ish moves) | **~3%** | chaos rarely crowns a fool anymore |
| shrewd (builds positions, buys odds, stewards a lean base) | **~48%** | see `node tools/simulate.js` for the per-tank ladder |

This is deliberately a hard game: probabilistic resolutions cap certainty, crises charge what you can
afford, no-bench losses hit the whole roster, and the frontrunner-heat mechanic means the better you're
doing, the harder the town pushes back. Ease it via `frontrunnerMult`, `rivalDriftPct`, or `crisisCashPct`.

The levers live in `TUNE` (`rivalBudgetMult`, `fightCashMult`, `grantMult`, `courtCostMult`, `scholarOutMult`, `annualRaisePct`, `grantTermMin/Max`, `electionMonth`). Rerun the harness after touching any; `TUNE_PATCH='{"rivalBudgetMult":0.7}' node tools/simulate.js` tests a patch without editing files. The win rate is steeply sensitive to `rivalBudgetMult` (0.7 → 88%, 0.9 → 14%), so tune in small steps.

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
