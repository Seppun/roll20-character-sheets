# Cohors Cthulhu sheet

This folder contains the source code for the Roll20 VTT sheet for
Cohors Cthulhu, a Roman-legion / Cthulhu Mythos horror game built on
Modiphius's 2d20 System.

Maintained by Han Vanholder.

## Installing the sheet

The compiled `Cohors_Cthulhu.html` and `Cohors_Cthulhu.css` at the root of
this folder are what actually get pasted into Roll20, as a Custom
character sheet:

1. In your Roll20 game, open **Game Settings** > **Game Details**, and
   scroll to **Character Sheet Template**.
2. Choose **Custom** from the dropdown.
3. Paste the full contents of `Cohors_Cthulhu.html` into the **Sheet
   Layout** box.
4. Paste the full contents of `Cohors_Cthulhu.css` into the **Sheet
   Style** box.
5. Save Changes.

Every character in the game now uses this sheet. If you've built from
source (see "Building from source" below), always paste both files
together from the same build - mixing an old HTML paste with a newer CSS
paste (or vice versa) can leave the sheet out of sync with itself. The
sheet's footer prints a build timestamp (`HTML build: ...` / `CSS build:
...`) on both the page and in a hidden CSS rule - if those two timestamps
ever differ, you pasted a stale copy of one of the two files.

## Using the sheet

The sheet has three tabs: **Character** (identity, Stress/Fatigue/Courage/
Fortune, Attributes, Skills, Weapons, Armor, Talents, Experience),
**Spells**, and **Notes** (Traits, History, Personal Agenda, Journal,
Belongings).

- **Rolling**: click an Attribute's name, a Skill's name, a specific
  Focus, a Weapon's die icon, or a Spell's cast icon to roll it. Each
  roll prompts for Difficulty, Complication range, and how many
  additional d20s to buy, then posts a single chat card with the dice,
  target number, successes, and (for Weapons/Spells) damage or cost
  rolled in the same message. A Weapon's damage is always rolled
  alongside its attack, but only shown on the card if the attack
  actually hit - a miss just shows the attack roll. Attacks also ask how
  many extra damage dice to buy (0-3): each adds one Challenge Die to the
  damage for 1 Momentum, counted and paid only if the attack hits. The
  Momentum the attack itself generates can pay for them.
- **Macro bar**: drag any roll button (Attribute, Skill, Focus, Fatigue
  resist, Weapon or Spell) onto the macro bar to roll it from there. A
  weapon or spell added since the sheet was last opened is draggable once
  it has a name.
- **Stress, Fatigue, and Fortune trackers**: click a box to fill the
  track up to and including it, or click an already-filled box to clear
  the track back down to that box. Click box 1 while it's the only box
  filled to clear the whole track to empty - there's no separate Clear
  button. Fatigue can't be marked past the character's Max Stress; those
  boxes are greyed out and disabled once Fatigue reaches that limit.
  "Max" shows the character's raw Stress capacity; "Current Max" shows
  that same number reduced by current Fatigue.
- **Weapons, Armor, and Talents**: picking a name from the dropdown fills
  in that row's stock stats automatically - every field stays freely
  editable afterward for house-ruled or modified equipment. A player
  character's Talent dropdown lists only the talents whose requirements
  the character meets (archetype, specialization, culture, caste, skill
  ranks and prerequisite talents).
- **Dark Mode**: supported via Roll20's own per-player Dark Mode toggle.
- **Printing / Download as PDF**: if your Roll20 account has print
  support available, a Print button appears on the character sheet
  dialog itself (enabled by this sheet's `sheet.json`). It prints all
  three tabs stacked one after another (not just whichever tab you had
  open), with interactive-only chrome (tab buttons, "Modify"/"+Add Item"
  controls, the build-timestamp footer) hidden, Dark Mode forced off, and
  light-on-dark banners/headers swapped to dark-on-white so they stay
  legible on paper.

## Global Momentum and Threat pools (API script)

Momentum and Threat in the 2d20 System are shared, game-wide resources,
not per-character stats - neither can live as an attribute on this (or
any) character sheet, since each character's sheet is its own isolated
set of attributes with no visibility into any other character's, let
alone a GM-only pool. The Roll20 API script in
`api-scripts/cohors_cthulhu.js` maintains both pools, kept in sync
automatically by every roll made from this sheet
(Attribute/Skill/Focus/Weapon/Spell). The same script also runs the token
actions, NPC import and NPC lock described below.

- **Momentum** increases by the Momentum a passed roll generates, and
  decreases by Extra Momentum declared spent on a spell or a Fatigue
  resist, and by extra damage dice bought on a successful attack (1 each,
  up to 3; adversary NPCs pay in Threat). Capped at 6 in
  either direction (the Momentum pool can never exceed 6).
  Announcements report the amount the pool actually changed by, and
  Momentum that doesn't fit is reported as lost (e.g. "6/6 (+1, 2 lost -
  pool full)").
- **Buying additional d20s** (any roll type, up to 3 extra dice) costs 1
  Momentum for the first, 2 for the second and 3 for the third (so 2 dice
  cost 3 and 3 dice cost 6). Adversary NPCs pay the same in Threat. The
  dice are paid before anything else, since they're bought before the
  roll.
- **Spending more than the pool holds** is still allowed, for bought d20s
  and for whatever a roll spends beyond the Momentum it generated (extra
  damage dice, a spell's Extra Momentum, removing Fatigue): whatever the
  pool comes up short generates an equal amount of Threat instead. Only the
  API script (not the character sheet) knows the pool's current value, so
  it decides. For example, with 1 Momentum in the pool, an attack that
  generates 2 can buy 3 extra damage dice and leaves the pool at 0; with
  an empty pool and 1 generated, the same 3 dice add 2 Threat.
- **Threat** increases by the Complications a roll generates (
  each Complication generates 1 point of Threat for the GM), plus any
  shortfall from spending more Momentum than the pool holds (above). There's no automatic
  decrease otherwise - the rules never have a player spend Threat from their own
  sheet, only the GM spends it (buying NPCs extra d20s, directorial
  effects), which happens in narration rather than on this sheet, so
  `!threat-adjust` (GM only) is the only way the pool goes down.

### Installing the API script

The script is a **separate piece from the character sheet itself** - it
isn't part of the compiled `Cohors_Cthulhu.html`/`.css`, and it isn't
pasted into the Custom Sheet Layout/Style boxes above. Instead, in a
Pro-tier game with the API sandbox enabled:

1. **Game Settings** > **API Scripts** > **New Script**.
2. Paste in the whole contents of `api-scripts/cohors_cthulhu.js`, Save
   Script.

Earlier versions came as five separate scripts (`ccmomentum.js`,
`ccthreat.js`, `ccimport.js`, `ccnpclock.js`, `cctokenactions.js`). If
your game has those, delete them when you add this one, or every command
and roll is handled twice. The pools and settings carry over.

Without the script installed, the hidden signals just render (and
immediately hide) a roll template card nobody looks at - rolling still
works fine, there's just no shared pool.

### Using the pools

Both pools post to chat on every change, plus two passive displays that
don't require re-opening chat: a custom entry in the Turn Order tracker
(needs no setup, one row per pool, added at the end and updated in place so
it never changes whose turn it is), and, if the GM
places a token/graphic named "Momentum Pool" or "Threat Pool" on the
current page, that token's bar1 is kept in sync too.

Chat commands once installed:

| Command | Who | Effect |
| --- | --- | --- |
| `!momentum` / `!threat` | anyone | Announce the current pool value |
| `!momentum-set N` / `!threat-set N` | GM only | Set the pool to an exact value |
| `!momentum-adjust N` / `!threat-adjust N` | GM only | Add N (negative to subtract) - how a GM spends Threat outside of NPC rolls (adversary NPC rolls on the sheet settle their own Threat) |
| `!ccdebugon` / `!ccdebugoff` | GM only | Turn the API script's debug logging on or off (any capitalization works). `!ccdebug` shows the current setting. |

Debug logging is off by default and stays as set across sandbox restarts.
When on, the script writes what it did to the API console (Game Settings >
API Scripts), tagged by part (`[CCMomentum]`, `[CCImport]`, ...): every
chat message it sees, the pool before and after each signal or command, how a spend was split between Momentum and
Threat, each NPC import, and each NPC Lock check. Errors are always logged.

## Token actions (API script)

The API script (`api-scripts/cohors_cthulhu.js`) puts each character's
weapons and spells in the token action bar: select a token and click an
attack or "Cast <spell>" to roll it, exactly as from the sheet. It keeps
those token actions in step with the sheet as weapons and spells are
added, renamed or deleted, and adds them for imported NPCs. It only manages the abilities it creates; your own
abilities and macros are left alone.

| Command (GM only) | Effect |
| --- | --- |
| `!cctokenactions` | Rebuild for the selected tokens' characters, or every character if none is selected |
| `!cctokenactions clear` | Remove them (selected, or every character) |
| `!cctokenactions off` / `on` | Pause or resume the automatic updates |

## Importing NPCs

Hand-typing a full stat block for every NPC gets old fast, so `npc-import/`
holds a small pipeline for turning an NPC's stat block into a ready-to-play
Roll20 character:

1. **Get the NPC into this game's interchange format** - a JSON object (or
   array of several) described in full in
   [`npc-import/FORMAT.md`](./npc-import/FORMAT.md), with a worked example
   in `npc-import/examples/subura_street_thug.json`. The JSON Schema in
   `npc-import/schema/npc.schema.json` lets any JSON Schema validator check
   a file before you import it.
2. **Install the API script**, `api-scripts/cohors_cthulhu.js` (see
   "Installing the API script" above).
3. **Import it**: paste the NPC JSON (one object, or a JSON array for
   several at once) into a Handout's **GM Notes**, then in chat run:
   ```
   !ccimport handout|<Handout Name>
   ```
   You'll get a whispered summary naming every NPC created and anything
   worth a second look. The first time you actually **open** an imported
   character's sheet in Roll20, it also self-corrects: Base Armour/Total
   Armor/Courage/Max Stress recompute for real (rather than the script's own
   best-effort copy made at import time), and any Talent given by name only
   gets its Keywords and Requirements filled in automatically - see
   `ccRecomputeOnOpen` in `source/views/_global_sheetworker.pug` for the
   mechanism. Give `description` in the JSON for any text you want on the
   sheet.

**Tokens.** If the game has a token image with the NPC's name (or the name
in the JSON's `token` field), the import also sets the NPC's default token
and avatar. It looks in ModifyTokenImage's Journal folders (`Token Images`
> a folder per token > handouts with the image as avatar), then for named
tokens on a page called "Token Library", then for custom token markers
(uploading a folder of PNGs as a marker set names each image after its
file). `!ccimport tokens` lists the
names found, and `!ccimport token|<Character Name>` gives an NPC imported
earlier its token. See the Token section of `npc-import/FORMAT.md`.

Imported NPCs open as the profile's own tier (Trooper, Toughened or
Nemesis - see NPC sheets below), with the stat block's Stress,
Injuries, Armor, Courage and Power, its attacks (including mental attacks),
special rules, spells and escalation options filled in.

## NPC sheets

The Character Type selector at the top of the Character tab switches a
character between Player Character and the three NPC tiers (Trooper, Toughened, Nemesis).
It's **GM-only**, controlled by the character's GM Notes (which players
can't see or edit) through the API script (`api-scripts/cohors_cthulhu.js`):

- Put **NPC** anywhere in a character's GM Notes to show the selector on
  that sheet. **NPC: Trooper**, **NPC: Toughened** or **NPC: Nemesis**
  also sets (and keeps) that tier.
- Without it, the selector is hidden, and an NPC type is reset to Player
  Character - including one a player sets through the Attributes &
  Abilities tab. The GM gets a whisper when that happens.
- The NPC import writes `NPC: <Tier>` into every imported NPC's GM Notes.
- On its first run, the script adds "NPC" to the GM Notes of existing NPCs
  that no player controls, so they keep working. Without the script,
  nobody can switch a sheet to an NPC type except by importing it.

Each tier changes the sheet like this:

- **Trooper** and **Toughened** NPCs get a compact combat layout (no
  background, languages or experience); **Nemesis** NPCs keep the full
  sheet. Every NPC tier shows Truths without Scars, hides the Fortune track
  (NPC Fortune spends cost Threat) and adds two panels:
  - **NPC Profile**: Adversary/Ally switch, the tier's rules reminder, the
    stat block's Max Stress, Injuries, Armor, Courage, Morale and
    Power (leave blank to use the tier formula: Troopers halve Max Stress;
    injury limits are 1/2/3), and Escalation Options.
  - **Special Rules**: the common NPC special rules as suggestions, with
    each rule postable to chat. Extraordinary [Attribute] X adds automatic
    successes, and Brutal makes melee attacks roll Brawn.
- **Adversary rolls use Threat**: extra d20s cost Threat instead of
  Momentum (same 1/2/3 escalation, up to three dice) and extra successes go
  to the Threat pool, through the same
  API script. Allies roll with Momentum like a PC.
- **Weapons & Attacks** has a Type column; a Mental attack rolls Will +
  Persuasion or Survival at difficulty 1. An NPC's damage is used as
  given in its stat block (it already includes bonus damage), unlike a PC's.
- **Mythos spells**: the Spells tab offers the Tome of Cthulhu, Compendium
  of Mormo, Grimoire of Nyarlathotep and Spellbook of Yog-Sothoth, plus NPC
  Spellcaster types, only on NPC sheets.

## Credits

- Banner brush stroke: painted by the sheet's author.
- Imperial aquila (page watermark): a Roman relief,
  public domain, from Wikimedia Commons
  ([File:Better_Imperial_Aquila.png](https://commons.wikimedia.org/wiki/File:Better_Imperial_Aquila.png)),
  tinted for this sheet.
- Cracked-plaster panel texture: photo by
  [Elantro](https://unsplash.com/@elantro) on
  [Unsplash+](https://unsplash.com/photos/a-light-beige-wall-with-multiple-cracks-and-textured-surface-WT41myfzf14),
  used under the [Unsplash+ License](https://unsplash.com/plus/license),
  made seamless and softened for this sheet (`images/plaster-texture.jpg`).

## Building from source

This sheet is built with [k-scaffold](https://kurohyou-studios.github.io/k-scaffold/),
a PUG/SCSS framework for Roll20 character sheets.

- [PUG](https://pugjs.org/api/getting-started.html) compiles the sheet's HTML from
  the `.pug` source files.
- [SCSS](https://sass-lang.com/documentation/syntax) compiles the sheet's CSS from
  the `.scss` source files.
- [node.js](https://nodejs.org/en/) and `npm` build the sheet from source.

### Development environment

- Install `npm` (via [`nvm`](https://github.com/nvm-sh/nvm) is recommended).
- Run `npm install` in this directory to install dependencies.

### Building the sheet

```bash
npm run build
```

compiles the sheet once. To watch source files and rebuild on change:

```bash
npm run start
```

All source files live in `source/`. The compiled `Cohors_Cthulhu.html` and
`Cohors_Cthulhu.css` are generated at the root of this folder and should not
be edited directly - re-run the build and re-paste them into Roll20
instead (see "Installing the sheet" above).

## Adding spells, weapons, armor and talents

Every list on the sheet comes from data in `source/`. After any change below,
run `npm run build` and re-paste `Cohors_Cthulhu.html` (and
`Cohors_Cthulhu.css`) into Roll20. The sheet holds the mechanics only:
talent descriptions and spell or special-rule text aren't part of it, and
players type their own.

### A new spell

1. **`source/data/spells.json`**: add an entry under its tradition's key
   (`runic`, `oracular`, `celtic`, or the NPC-only Mythos tomes `cthulhu`,
   `mormo`, `nyarlathotep`, `yog_sothoth`):

   ```json
   "Mist of Avernus": {
     "skill": "Survival",
     "difficulty": "2",
     "cost": "4 Drain, Piercing 1",
     "duration": "Power rating in rounds",
     "category": "Manifestation spell"
   }
   ```

   `cost` must start with the number of Challenge Dice, followed by the cost's
   damage effects - the casting roll rolls it. `difficulty` should start with
   the number; anything after it (e.g. an opposed test) is shown as text.
2. **`source/views/_spells.pug`**: add the name to that tradition's Spell
   Name dropdown - the `+select` with class `.cc-spell-name-<tradition>`.
   Options are written out one by one (a known k-scaffold bug breaks
   generating them in a loop):

   ```pug
   +option({value: "Mist of Avernus"})
     | Mist of Avernus
   ```

   The option value must match the JSON key exactly, or picking it won't
   fill in the details.
3. *Only if needed*, also in `_spells.pug`: list the spell in
   `ccSpellCostThreatPerEffect` if each Effect on its cost adds Threat, or in
   `ccSpellMomentumCostDice` if Momentum spent on it adds dice to its cost.

Imported NPCs need nothing else: spells given by name in an NPC import file
get their skill, difficulty, cost, duration and category from `spells.json`
the first time the sheet is opened.

### A new weapon

1. **`source/views/panels/_weapons_panel.pug`**, at the top: add a profile
   to `ccMeleeWeapons` or `ccRangedWeapons`:

   ```js
   'Trident': {focus: 'Melee Weapons', reach_range: '2', damage_effects: '4, Piercing 1', size: 'Major', qualities: ''},
   ```

   `damage_effects` is the damage in Challenge Dice, then the damage effects,
   comma-separated. The focus decides how the attack rolls: `Archery` or
   `Thrown Weapons` roll as ranged (Coordination), anything else as melee
   (Agility).
2. Same file: add the name to the **players' dropdown** (the `+select` with
   class `.cc-weapon-name-select`, written out one option at a time) and to
   the **NPC suggestion list** (`datalist#cc-weapon-options`):

   ```pug
   +option({value: "Trident"})
     | Trident
   ```

   ```pug
   option(value='Trident')
   ```
3. **`api-scripts/cohors_cthulhu.js`**: copy the same profile into the
   `ccWeaponProfiles` table in its NPC IMPORT section, so imported NPCs can
   name the weapon (then replace the script in Roll20).
4. *Optional*: add the name to the known-weapons list in
   `npc-import/FORMAT.md`.

### New armor

1. **`source/views/panels/_armor_panel.pug`**, at the top: add a profile to
   `ccArmorProfiles`:

   ```js
   'Lorica Plumata': {resistance: '3', qualities: 'Heavy'},
   ```
2. Same file: add the name to `datalist#cc-armor-options`:

   ```pug
   option(value='Lorica Plumata')
   ```
3. **`api-scripts/cohors_cthulhu.js`**: copy the profile into the
   `ccArmorProfiles` table in its NPC IMPORT section (then replace the
   script in Roll20).
4. *Optional*: add it to the known-armor list in `npc-import/FORMAT.md`.

### A new talent

1. **`source/data/talents.json`**: add an entry; that's all. The Talents
   name list is generated from this file and sorted automatically:

   ```json
   "Iron Discipline": {
     "keywords": "Soldier, Resilience",
     "requirements": "Resilience 2+"
   }
   ```

   If two talents share a name, give them distinct keys such as
   `"Scotopia (Robber)"`.

2. **Requirements decide who sees it.** A player character's Talent dropdown
   only lists talents whose requirements the character meets. The build reads
   `requirements` as clauses separated by `;` or `,` (all must be met), each
   one of:

   | Clause | Example |
   | --- | --- |
   | Archetype | `Soldier archetype` (or just `Mystic`) |
   | Culture / caste | `Greek culture`, `Noble caste` |
   | Skill ranks | `Medicine 3+`, `Academia or Engineering 3+`, `1+ ranks in Medicine` |
   | Other talents | `Tracker talent`, `Backstabber talent or Subtle Step talent` |
   | Spellcaster limit | `can't already have a Spellcaster-keyword talent` |

   A leading `plus` is ignored, and `Advanced` adds no condition. A
   specialization in `keywords` (`Legionary`, `Medicus`...) also requires
   that specialization. Any other wording stops the build with an error
   naming the talent, so fix the text or add the pattern to
   `ccParseRequirements` in `source/views/panels/_talents_panel.pug`. NPCs
   type their talents freely, with every talent suggested.

Talents given by name in an NPC import file get their keywords and
requirements from `talents.json` the first time the sheet is opened, so the import needs no change. A talent
that changes a calculated value (like Unyielding's +3 Max Stress) also needs
code: see `ccStressMaxBase` in `source/views/panels/_vitals_panel.pug`.
