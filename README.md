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
- **Influence.** Spend it on **policy fights** (bills, executive orders, nominations — a rotating board of 4 from a 30-card deck). Each fight is a tug-of-war between two sides; rival think tanks pile on every month — and surge hard into a fight's final month, so a last-minute influence dump meets a wall of closing money. The ⚑ attribution line under each side shows exactly who's backing it and with how much. When the clock hits zero the bigger pile wins; cash and clout (✦) rewards scale by your share of the winning side, and some fights pay in kind — a grateful scholar joining free, a warm donor intro at half court cost, or amnesty on donor strikes.
- **Donors.** Court them with influence (30% cheaper when they share your politics, +40% across the aisle; 40% / +60% for hardline shops); they pay monthly grants. Every donor in the 26-card deck has a **demand** — a scholar tag on the roster, a vanity program running, monthly influence pushed into their pet issue's fights, or ideological purity (back the wrong side of a fight and take an instant strike). Unmet demands = 1 strike/month; two strikes and they walk. Vanity **programs** (gala, podcast, marble lobby) cost money and produce ~nothing, but some of the richest donors won't fund you without them. The perverse incentives are the point.
- **Raids & poaching.** Some market scholars sit at a rival (marked **AT [RIVAL]**): hiring one costs a 1.5× signing bonus and permanently dents that rival's influence budget. It cuts both ways — rivals periodically make a run at your best scholars, and you either match the offer (permanent raise) or watch them defect and strengthen that rival. Watch for 🔥 **divas**: enormous output, but colleagues keep quitting over them. Ops staff vary too: 1–3 support capacity plus rainmaker/connector/media/expensive traits. Stale market? **Prospect** buttons re-deal either market — for cash *and* influence, escalating +50% with each sweep so you can't fish for the perfect card.
- **Renewals.** When a grant cycle ends you get one month to renew at half courting cost — on stricter terms (tougher demand, one strike ends it) — or let the money lapse. Long-term **programs** (a house journal, a war room, junior fellows, an endowed chair, buying your own annex) trade heavy cost for compounding advantages over the 22 months.
- **The race.** Every resolved fight awards one victory to the winning side's single top contributor (ties go to you). The HQ leaderboard tracks all seven institutions live; at month 22 the election ends the game and ranks everyone. The core tension: influence spent on victories is leakage from the scholars→donors engine — glory and growth compete for the same points.
- **Losing.** Two consecutive months in the red and the institution folds before the election. The treadmill is real: every December payroll rises 9%, donor grants sunset on 10–20 month cycles, and scholars quit after two straight months without ops support.

## Balance

Tuned by Monte Carlo (`node tools/simulate.js [runs]`), which stubs the DOM, loads the real engine, and drives three bot strategies through the full 22-month campaign. Current numbers (300 runs/cell, win = ranked #1 on Election Night):

| strategy | wins the election | notes |
|---|---|---|
| passive (never acts) | **0%** | ignores poach bids and renewals; the institution hollows out |
| naive (random-ish moves) | **~3%** | banks 4–6 victories; the leaders bank 11–15 |
| shrewd (answers offers, invests long-term, snipes closing fights) | **~70%** | mid-80s on Easy/Medium, ~74% Hard, ~20% Expert |

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
