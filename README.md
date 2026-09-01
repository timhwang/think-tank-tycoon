# 🏛 THINK TANK TYCOON

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

- **Staff.** Scholars produce ✦ influence monthly; each has an issue tag, a salary, and a quirk. Ops staff support 2 scholars each — unsupported scholars produce at half rate. A rotating hiring market offers generated candidates (signing bonus = 1 month salary).
- **Influence.** Spend it on **policy fights** (bills, executive orders, nominations — a rotating board of 4). Each fight is a tug-of-war between two sides; rival think tanks pile on every month. When the clock hits zero the bigger pile wins, and winners are paid the reward scaled by their share of the winning side.
- **Donors.** Court them with influence; they pay monthly grants. Every donor has a **demand** — a scholar tag on the roster, a vanity program running, or ideological purity (back the wrong side of a fight and take an instant strike). Unmet demands = 1 strike/month; two strikes and they walk. Vanity **programs** (gala, podcast, marble lobby) cost money and produce ~nothing, but some of the richest donors won't fund you without them. The perverse incentives are the point.
- **Losing.** Two consecutive months in the red and the institution folds. The Bugle writes the obituary.

## Institutions

Six playable parody tanks across the spectrum and size ladder — from The Hutchings Institution (LARGE, Comfy) down to The Subsidiarity Project (TINY, Hard Mode) — plus The BLAND Corporation as a permanent NPC rival. Unchosen tanks become AI rivals who spend their influence budgets on fights matching their politics and pet issues.

## Files

| file | what |
|---|---|
| `index.html` | shell, windows layout, help text |
| `style.css` | SimCity 2000 costume (bevels, dithered teal desktop, newsprint modal) |
| `data.js` | all content: `TUNE` knobs, tanks, donor deck, fight deck, programs, name/quirk pools |
| `game.js` | engine: state, turn resolution, rival AI, rendering, localStorage autosave |

All balance lives in `TUNE` (top of `data.js`) and the deck entries — tweak numbers there, no engine changes needed.

## Iteration ideas (not yet built)

- Elections every 24 months that flip which side-leans are ascendant (rewards shift).
- Scandal/event deck (scholar quirks become mechanical).
- A Reputation stat separate from influence; donor tiers gated on it.
- Rivals courting donors out of the shared market; scholar poaching.
- Draggable windows, SC2K query-tool sounds, save slots.
- Deep-pocket "restricted gift" donors that pay huge but lock influence usage.
