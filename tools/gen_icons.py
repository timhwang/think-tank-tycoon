#!/usr/bin/env python3
"""Generate pixel-art icons and the social card for Think Tank Tycoon.

Icons: generated at 1024px via the OpenAI Images API, downscaled to 64x64
with palette quantization so they read as period pixel art, saved to icons/
as <key>.png where <key> matches what game.js asks for (fight_<id>,
donor_<id>, program_<id>, tank_<id>, scholar_1..12, ops_1..8).

Usage:
  python3 tools/gen_icons.py                 # all missing icons
  python3 tools/gen_icons.py --force         # regenerate everything
  python3 tools/gen_icons.py --only donor_crypto,tank_bland --force
  python3 tools/gen_icons.py --og            # social card (og.png) only
  python3 tools/gen_icons.py --list          # show keys and prompts

Key resolution: $OPENAI_API_KEY, else a .openai-key file at the repo root
(gitignored). Cost at defaults (low quality, 1024px): about a cent per icon.
"""
import argparse
import base64
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO

from PIL import Image

try:  # macOS framework pythons often lack system CA bundles
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, 'icons')
API = 'https://api.openai.com/v1/images/generations'

STYLE = (
    'Single video game inventory icon in the style of a mid-1990s DOS/Windows strategy game: '
    'chunky pixel art, limited 16-color palette, light dithering, one centered subject filling '
    'most of the frame, flat warm gray background, hard pixel edges, no text, no letters, '
    'no numbers, no border, no watermark. Subject: ')

PORTRAIT = (
    'Portrait bust video game icon in the style of a mid-1990s DOS/Windows strategy game: '
    'chunky pixel art, limited 16-color palette, light dithering, head and shoulders filling '
    'the frame, flat warm gray background, no text, no letters, no border. '
    'A fictional 1990s Washington DC policy-world character: ')

OG_PROMPT = (
    'Wide social banner box art for a retro city-builder strategy game, in authentic SimCity 2000 '
    'pixel-art style: an isometric Washington DC scene with the Capitol dome, marble think-tank '
    'office buildings, tiny suited lobbyists on the sidewalks, money and papers blowing in the '
    'wind, dithered teal sky. Across the top, big blocky beveled chrome game-logo text reading '
    'exactly "THINK TANK TYCOON". Below it a smaller clean ribbon banner with text reading '
    'exactly "A Strategy Game of Wealth, Power, and Terrible Ideas". Crisp readable lettering, '
    'correct spelling, 1990s box-art energy.')

ICONS = {
    # ---- policy fights (20) ----
    'fight_serverfarms': 'a giant humming server rack draped with a small american flag',
    'fight_snacc':       'a cafeteria tray with mystery meat, tater tots, and a gavel resting on it',
    'fight_regreview':   'a rubber stamp stamping a smaller rubber stamp',
    'fight_helium':      'a military green balloon lifting a wooden crate',
    'fight_fednom':      'a marble bank facade with an oversized brass dial on the front',
    'fight_prek':        'a graduation mortarboard cap resting on a baby bottle',
    'fight_chips2':      'a computer microchip wearing a red white and blue prize ribbon',
    'fight_ainice':      'a friendly boxy robot face with a glowing halo above it',
    'fight_tariff':      'a cargo container ship stacked high with price tags instead of containers',
    'fight_sealandia':   'a rusty offshore sea platform flying a proud tiny flag',
    'fight_cleancoal':   'a polished sparkling lump of coal sitting on top of a solar panel',
    'fight_balloons':    'a white weather balloon being examined by a large magnifying glass',
    'fight_medadv':      'an orange pill bottle with a huge glossy plus sign badge',
    'fight_rto':         'a gray cubicle desk with an office chair wrapped in chains',
    'fight_highways':    'a concrete highway overpass with a blank billboard mounted on top',
    'fight_circuit':     'a wooden judge gavel resting on a stack of thick law books with many bookmarks',
    'fight_pandemic':    'a red first-aid kit nested inside a slightly larger first-aid kit',
    'fight_rareearth':   'a pickaxe striking glowing crystals embedded in gray rock',
    'fight_deptdept':    'a filing cabinet with an open drawer full of tiny filing cabinets',
    'fight_kosa':        'a smartphone wrapped in a padlocked chain with a teddy bear sticker on the screen',

    # ---- donors (17) ----
    'donor_pemberton':    'a stern oil portrait of a whiskered ancestor in an ornate gilded frame',
    'donor_retail':       'a shopping cart wearing a beige trench coat and fedora',
    'donor_tomorrow':     'a rising sun beaming over an open ledger book',
    'donor_delaware':     'a plain manila envelope stuffed with cash, tied with string',
    'donor_vantage':      'an oil derrick with a single small green leaf sticker on its side',
    'donor_blevins':      'a golden trophy cup with a paper price tag tied to the handle',
    'donor_crypto':       'a large golden coin embossed with a steep downward chart arrow',
    'donor_sisters':      'wooden rosary beads draped gently over a closed account ledger',
    'donor_marchetti':    'golden comedy and tragedy theater masks sharing one silver microphone',
    'donor_hexagon':      'a hexagonal steel military badge with a small missile emblem',
    'donor_werther':      'an old rotary telephone sitting on a wooden school desk',
    'donor_billionaires': 'a gold monocle resting on top of a desk globe',
    'donor_ashgrove':     'a leather chesterfield armchair beside a glowing fireplace',
    'donor_waterworks':   'a municipal water tower with a piggy bank painted on the tank',
    'donor_tiktank':      'a smartphone on a tiny tripod with a big play button on screen',
    'donor_coalition':    'a protest sign depicting a crossed-out smaller protest sign',
    'donor_assembly':     'a raised fist gripping a wooden clipboard',

    # ---- programs (3) ----
    'program_gala':    'a melting ice sculpture of a capitol dome on a buffet table with shrimp',
    'program_podcast': 'a chrome studio microphone with plush headphones hanging on it',
    'program_lobby':   'a polished marble wall of blank engraved donor plaques with one spotlight',

    'program_journal': 'a bound academic journal with a quill pen resting on the cover',
    'program_warroom': 'a wall map covered in red string and pushpins',
    'program_fellows': 'a row of identical eager young interns in matching gray suits',
    'program_chair':   'an ornate leather professor armchair on a marble pedestal with a brass plaque',
    'program_wing':    'a marble building annex under construction with wooden scaffolding',

    # ---- specialist ops (6) ----
    'spec_comms':      'a bank of press-conference microphones on a wooden podium',
    'spec_devdir':     'a rotary telephone wrapped in a gift ribbon with a donation envelope',
    'spec_editor':     'a green-visored editor\'s desk with a manuscript covered in red ink',
    'spec_creative':   'a drafting table with color swatches and a t-square',
    'spec_govrel':     'a revolving brass door between two marble columns',
    'spec_consultant': 'a gleaming empty whiteboard on wheels, spotless',

    # ---- think tanks (7) ----
    'tank_hutchings':    'a marble neoclassical institute building with columns and ivy trim on a blue shield',
    'tank_legacy':       'a bald eagle perched on a stack of leather books on a red shield',
    'tank_forum':        'two hands in a firm golden handshake in front of a rising bar chart',
    'tank_momentum':     'a raised torch with a bold upward arrow on a teal shield',
    'tank_hand':         'an empty white glove hovering over a stock market chart, adjusting it',
    'tank_subsidiarity': 'a tiny stone chapel standing next to an old beige fax machine',
    'tank_bland':        'a featureless gray office building, perfectly symmetrical, slightly ominous',

    # ---- scholar portrait pool (12) ----
    'scholar_1':  'an older man with round glasses and a bow tie, tweed jacket',
    'scholar_2':  'a middle-aged woman with a pearl necklace and a sharp power blazer',
    'scholar_3':  'a retired general with a silver crew cut, now in a civilian suit',
    'scholar_4':  'a young man with slicked-back hair and an eager campaign-staffer grin',
    'scholar_5':  'a professor with wild gray hair and elbow patches on a corduroy jacket',
    'scholar_6':  'a woman with a sharp black bob haircut and rimless glasses',
    'scholar_7':  'a man with a magnificent walrus mustache and suspenders',
    'scholar_8':  'a woman with braided hair and a colorful scarf over a navy blazer',
    'scholar_9':  'a sleep-deprived man clutching a coffee mug, tie loosened',
    'scholar_10': 'an elegant older woman with cat-eye glasses and silver hair in a bun',
    'scholar_11': 'a thoughtful man in a tweed jacket holding an unlit pipe',
    'scholar_12': 'a cheerful bald man wearing a conference lanyard and a flag lapel pin',

    # ---- fights 21-30 ----
    'fight_canal2':     'an excavator digging a canal trench through jungle with a tiny flag planted',
    'fight_cea':        'a wooden podium bearing a round seal with a rising line chart emblem',
    'fight_compost':    'a neoclassical government building with a steaming compost bin out front',
    'fight_sfrotc':     'a cadet helmet with a small rocket orbiting it like a moon',
    'fight_repair':     'a hospital heart monitor opened up with a wrench sticking out',
    'fight_postcard':   'a postage stamp on a tiny folded tax form with a stubby pencil',
    'fight_balloondef': 'a radar dish tracking a distant white balloon on a glowing green screen',
    'fight_algo':       'a desktop computer monitor seated at a wooden witness stand with a microphone',
    'fight_pumpkin':    'an underground concrete vault stacked with orange spiced lattes',
    'fight_fonts':      'a giant serif letter being lowered into place by a construction crane',

    # ---- donors 18-26 ----
    'donor_booster':    'a ceramic piggy bank wearing a varsity letterman jacket',
    'donor_carriers':   'a bathtub with nine tiny gray aircraft carriers floating in it',
    'donor_disruption': 'a shattered lightbulb reassembling itself into a small rocket',
    'donor_patients':   'a waiting-room chair beside a potted plant and a ticket dispenser',
    'donor_grandmas':   'a knitted solar panel still on wooden knitting needles',
    'donor_containers': 'a tidy cheerful stack of colorful shipping containers with a tiny pennant',
    'donor_port':       'a polished brass anchor mounted on a wooden award plaque',
    'donor_humane':     'a beige desktop computer wrapped snugly in a knitted blanket',
    'donor_gilt':       'an ornate gilded picture frame containing a smaller gilded picture frame',

    # ---- ops staff by role, order matches OPS_ROLES in data.js (8) ----
    'ops_1': 'a young development associate buried behind a huge stack of donor envelopes',   # Logistics Coordinator (icon reused)
    'ops_2': 'an events coordinator wearing a headset and hugging a clipboard',              # Events Coordinator
    'ops_3': 'a communications director shouting into two telephones at once',               # Comms Coordinator
    'ops_4': 'a grants manager with a green accountant visor and a desk calculator',         # Finance Manager (icon reused)
    'ops_5': 'an office manager holding a giant ring of labeled keys and a toolbox',         # Office Manager
    'ops_6': 'an executive assistant balancing a coffee carrier and a tower of binders',     # Executive Assistant
    'ops_7': 'a cheerful technician tangled in AV cables holding a projector remote',        # AV Guy (Indispensable)
    'ops_8': 'a wrangler with a whistle herding a line of tiny identical suited interns',    # Intern Wrangler

    # ---- report-card badges (10), keys match BADGES in data.js ----
    'badge_sandbagger': 'a round bronze award medal on a striped ribbon, embossed with a tortoise crossing a finish line first',
    'badge_amateur':    'a round tin award medal on a striped ribbon, embossed with a dunce cap sitting on a podium',
    'badge_diva':       'a round gold award medal on a striped ribbon, embossed with a flaming microphone',
    'badge_landlord':   'a round gold award medal on a striped ribbon, embossed with a brass key over a marble building',
    'badge_revolving':  'a round silver award medal on a striped ribbon, embossed with a revolving door',
    'badge_iron':       'a round iron award medal on a striped ribbon, embossed with a padlocked piggy bank',
    'badge_wire':       'a round black award medal on a striped ribbon, embossed with a snapped rabbit-foot charm and a lightning bolt',
    'badge_crisis':     'a round red award medal on a striped ribbon, embossed with a fire extinguisher',
    'badge_oppo':       'a round dark-green award medal on a striped ribbon, embossed with a manila folder stamped with a red seal',
    'badge_raider':     'a round steel award medal on a striped ribbon, embossed with a fishing hook lifting a briefcase',
}


def api_key():
    k = os.environ.get('OPENAI_API_KEY', '').strip()
    if k:
        return k
    path = os.path.join(ROOT, '.openai-key')
    if os.path.exists(path):
        return open(path).read().strip()
    sys.exit('No key: set OPENAI_API_KEY or put the key in .openai-key at the repo root.')


def call_api(key, prompt, size, quality, model, retries=3):
    payload = json.dumps({
        'model': model, 'prompt': prompt, 'size': size, 'quality': quality, 'n': 1,
    }).encode()
    req = urllib.request.Request(API, data=payload, headers={
        'Authorization': f'Bearer {key}', 'Content-Type': 'application/json',
    })
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=300, context=SSL_CTX) as r:
                data = json.loads(r.read())
            return base64.b64decode(data['data'][0]['b64_json'])
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors='replace')[:400]
            if e.code in (429, 500, 502, 503) and attempt < retries - 1:
                wait = 12 * (attempt + 1)
                print(f'  retry in {wait}s ({e.code}): {body[:120]}', flush=True)
                time.sleep(wait)
                continue
            raise RuntimeError(f'API error {e.code}: {body}') from e
    raise RuntimeError('unreachable')


def make_icon(key, name, prompt, args):
    raw = call_api(key, prompt, '1024x1024', args.quality, args.model)
    img = Image.open(BytesIO(raw)).convert('RGB')
    img = img.resize((args.px, args.px), Image.LANCZOS)
    img = img.quantize(colors=32, method=Image.MEDIANCUT)
    img.save(os.path.join(ICON_DIR, name + '.png'), optimize=True)
    return name


def make_og(key, args):
    src = os.path.join(ROOT, 'tools', 'og_source.png')
    if args.recrop and os.path.exists(src):
        img = Image.open(src).convert('RGB')
    else:
        raw = call_api(key, OG_PROMPT, '1536x1024', 'high', args.model)
        img = Image.open(BytesIO(raw)).convert('RGB')
        img.save(src)  # keep the uncropped original so crops are re-tunable
    # crop 1536x1024 -> 1.905:1 anchored near the top (the logo lives there),
    # then resize to the standard og card size
    target_h = round(1536 / (1200 / 630))
    top = min(args.og_top, 1024 - target_h)
    out = img.crop((0, top, 1536, top + target_h)).resize((1200, 630), Image.LANCZOS)
    # JPEG, not PNG: unfurl scrapers (iMessage especially) choke on megabyte images
    out.convert('RGB').save(os.path.join(ROOT, 'og.jpg'), quality=85, optimize=True, progressive=True)
    print(f'wrote og.jpg (1200x630, crop top={top})')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--only', help='comma-separated icon keys')
    ap.add_argument('--force', action='store_true', help='regenerate even if the file exists')
    ap.add_argument('--og', action='store_true', help='generate the social card instead of icons')
    ap.add_argument('--recrop', action='store_true', help='with --og: re-crop the saved source, no API call')
    ap.add_argument('--og-top', type=int, default=0, help='with --og: crop offset from the top, px')
    ap.add_argument('--list', action='store_true', help='print keys and prompts, no API calls')
    ap.add_argument('--model', default='gpt-image-1')
    ap.add_argument('--quality', default='low', choices=['low', 'medium', 'high'])
    ap.add_argument('--px', type=int, default=64, help='final icon size in pixels')
    ap.add_argument('--workers', type=int, default=4)
    args = ap.parse_args()

    if args.list:
        for k, v in ICONS.items():
            print(f'{k}: {v}')
        return

    key = api_key()
    if args.og:
        make_og(key, args)
        return

    os.makedirs(ICON_DIR, exist_ok=True)
    todo = {}
    wanted = set(args.only.split(',')) if args.only else set(ICONS)
    unknown = wanted - set(ICONS)
    if unknown:
        sys.exit(f'unknown keys: {", ".join(sorted(unknown))}')
    for name in sorted(wanted):
        if not args.force and os.path.exists(os.path.join(ICON_DIR, name + '.png')):
            continue
        subj = ICONS[name]
        style = PORTRAIT if name.startswith(('scholar_', 'ops_')) else STYLE
        todo[name] = style + subj

    if not todo:
        print('nothing to do (all icons exist; use --force to regenerate)')
        return
    print(f'generating {len(todo)} icons ({args.quality} quality, {args.workers} workers)...', flush=True)

    fails = []
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(make_icon, key, n, p, args): n for n, p in todo.items()}
        for i, fut in enumerate(as_completed(futs), 1):
            n = futs[fut]
            try:
                fut.result()
                print(f'  [{i}/{len(todo)}] {n}', flush=True)
            except Exception as e:
                fails.append(n)
                print(f'  [{i}/{len(todo)}] FAILED {n}: {e}', flush=True)

    if fails:
        print(f'\n{len(fails)} failed: {",".join(fails)}\nre-run: python3 tools/gen_icons.py --only {",".join(fails)}')
        sys.exit(1)
    print('done.')


if __name__ == '__main__':
    main()
