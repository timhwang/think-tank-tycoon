# 🏛 THINK TANK TYCOON

*A Strategy Game of Wealth, Power, and Terrible Ideas.*

Run a DC think tank. Hire scholars, mint influence, court donors, win the news cycle.
A tabletop-flavored simulator in the spirit of Frontier Lab Tycoon, wearing a SimCity 2000 costume.

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

- **Staff.** Scholars produce ✦ influence monthly; each has an issue tag, a lean, a salary, and a quirk. Ops staff support 2 scholars each — unsupported scholars produce at half rate. A rotating hiring market offers generated candidates (signing bonus = 1 month salary, halved for scholars who share your politics, 1.5× for aisle-crossers). Scholars also amplify influence you commit to fights matching their tag (+10% each, capped at +50%).
- **Influence.** Spend it on **policy fights** (bills, executive orders, nominations — a rotating board of 4 from a 30-card deck). Each fight is a tug-of-war between two sides; rival think tanks pile on every month, and the ⚑ attribution line under each side shows exactly who's backing it and with how much. When the clock hits zero the bigger pile wins; cash and clout (✦) rewards scale by your share of the winning side, and some fights pay in kind — a grateful scholar joining free, a warm donor intro at half court cost, or amnesty on donor strikes.
- **Donors.** Court them with influence (cheaper when they share your politics, pricier across the aisle); they pay monthly grants. Every donor in the 26-card deck has a **demand** — a scholar tag on the roster, a vanity program running, monthly influence pushed into their pet issue's fights, or ideological purity (back the wrong side of a fight and take an instant strike). Unmet demands = 1 strike/month; two strikes and they walk. Vanity **programs** (gala, podcast, marble lobby) cost money and produce ~nothing, but some of the richest donors won't fund you without them. The perverse incentives are the point.
- **Losing.** Two consecutive months in the red and the institution folds. The Bugle writes the obituary.

## Institutions

Six playable parody tanks across the spectrum and size ladder — from The Hutchings Institution (LARGE, Comfy) down to The Subsidiarity Project (TINY, Hard Mode) — plus The BLAND Corporation as a permanent NPC rival. Unchosen tanks become AI rivals who spend their influence budgets on fights matching their politics and pet issues.

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
| `og.png` | social sharing card |
| `tools/gen_icons.py` | icon/social-card generator (OpenAI Images API → 64×64 quantized pixel art) |

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
