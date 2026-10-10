# Cohors Cthulhu sheet

This folder contains the source code for the Roll20 VTT sheet for
Cohors Cthulhu, a Roman-legion / Cthulhu Mythos horror game built on
Modiphius's 2d20 System.

Maintained by Han Vanholder.

## Getting the sheet

Choose **Cohors Cthulhu** as the character sheet when you create a game,
or later on the game's page under **Settings** > **Game Settings** >
**Character Sheet Template**. There's nothing to download or paste. (Only
a sheet you changed yourself needs pasting in; see "Modifying the sheet"
below.)

The sheet works on its own in any game. An optional companion API script
adds shared Momentum and Threat pools, token actions and NPC import; see
"Companion API script (optional)" below.

## Using the sheet

The sheet has three tabs: **Character** (identity, Personal Truths &
Scars, Stress/Fatigue/Courage/Fortune, Attributes, Skills, Weapons, Armor,
Talents, Languages, Experience), **Spells**, and **Notes** (Traits,
History, Personal Agenda, Belongings, Journal). The **Player / NPC** switch
next to the tabs turns the sheet into an NPC sheet (see "NPC sheets"
below).

- **Rolling**: click an Attribute's name, a Skill's name, a specific
  Focus, a Weapon's roll button, or a Spell's cast button to roll it. Each
  roll prompts for Difficulty, Complication range, and how many
  additional d20s to buy, then posts a single chat card with the dice,
  target number, successes, and (for Weapons/Spells) damage or cost
  rolled in the same message. A Weapon's damage is always rolled
  alongside its attack, but only shown on the card if the attack
  actually hit - a miss just shows the attack roll. Attacks also ask how
  many extra damage dice to buy (0-3): each adds one Challenge Die to the
  damage for 1 Momentum, counted and paid only if the attack hits. The
  Momentum the attack itself generates can pay for them.
- **Spells**: choosing a spell fills in its mechanics and clears whatever
  the row held for the previous spell, typed text included. The "i" icon
  button beside a spell's fields folds its Effect and Momentum text in
  and out: maroon and open by default, light when folded in (printing
  always shows the text).
- **Attack spells**: a spell with a Damage & Effects entry rolls damage
  with its casting roll, as a weapon does: the caster's Power plus the
  listed rating in Challenge Dice, with the listed effects (a Dabbler's
  Power uses the 1 or 3 they choose for the cast). The prompt "Extra
  Momentum spent on Spell Effects" (Threat for an adversary) adds 1
  Challenge Die per Momentum, up to 3, counted and paid only if the spell
  succeeds. No attribute bonus damage is added; it is already in Power. The
  Cost is rolled and paid as for any spell.
- **Dabblers** choose the spell's Power when casting: 1, or 3 (both plus
  their Will bonus). At 3, every Effect rolled on the spell's Cost dice, and
  on its Damage dice if it succeeds, generates 1 Threat; the card shows the
  total.
- **Casting with a magic focus**: a spell's casting roll counts as a focus
  roll when the caster has the magic focus of the spell's skill - Academia
  (Religion), Fighting (War Magic), Medicine (Faith Healing), Observation
  (Instincts), Persuasion (Invocation), Resilience (Discipline), Survival
  (Mysticism) or Tactics (Omen Reading). Each die at or under the skill's
  ranks is then a critical success; without it, only a natural 1 is. The
  card names the focus, e.g. "Survival: Mysticism".
- **Momentum and Threat**: each roll card shows the Momentum the roll
  generated and spent, and its Complications, so the group can keep the
  pools by hand. The companion API script can keep them automatically.
- **Skills**: two columns, each skill with its Ranks and the Focuses the
  character has learned, as roll buttons. Press **Edit Focuses** (beside
  the Skills banner) to show every Focus with a checkbox, one skill per
  row; tick the ones the character knows, then press **Done**.
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
- **Resist Fatigue**: the Resist button rolls the higher of Brawn or Will
  plus Resilience. A success removes 1 Fatigue, plus 1 per Momentum spent
  (the roll asks), and updates the Fatigue track and Current Max itself.
  Ignore Fatigue, next to it, keeps Fatigue from lowering Current Max
  without clearing the track.
- **Identity**: Culture, Caste and Archetype are dropdowns, and the
  Specialization dropdown offers the two specializations of the chosen
  archetype.
- **Weapons, Armor, and Talents**: picking a name from the dropdown fills
  in that row's stock stats automatically - every field stays freely
  editable afterward for house-ruled or modified equipment. (NPC sheets
  use a type-in field with suggestions for Weapons, Armor and Talents, so
  they can carry claws, chitin and the like.) A player
  character's Talent dropdown lists only the talents whose requirements
  the character meets (archetype, specialization, culture, caste, skill
  ranks and prerequisite talents). The sheet holds the mechanics only:
  talent descriptions and spell text are typed in by the players.
- **Dark Mode**: supported via Roll20's own per-player Dark Mode toggle.
- **Printing / Download as PDF**: if your Roll20 account has print
  support available, a Print button appears on the character sheet
  dialog itself (enabled by this sheet's `sheet.json`). It prints all
  three tabs stacked one after another (not just whichever tab you had
  open), with interactive-only chrome (tab buttons, the Player/NPC switch,
  "Modify"/"+Add Item" controls, the build-timestamp footer) hidden, Dark
  Mode forced off, and light-on-dark banners/headers swapped to
  dark-on-white so they stay legible on paper.

## NPC sheets

The **Player / NPC** switch at the top right of the sheet, level with the
tabs, turns any character into an NPC and back. On an NPC sheet, the tier
buttons under the banner pick **Trooper**, **Toughened** or **Nemesis**:

- Switching to NPC starts as Toughened the first time, and brings back the
  last tier after that. Switching back to Player hides the NPC fields but
  keeps what's in them.
- Anyone who can edit a sheet can flip its switch, including players on
  their own characters (a sheet can't tell the GM from a player).

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
  Momentum (same 1/2/3 escalation, up to three dice), and the card reports
  the Threat the roll generates and spends. Effects on an adversary's spell
  Cost don't generate Threat, as they do for player characters. Allies roll
  with Momentum like a player character.
- **Weapons & Attacks** has a Type column; a Mental attack rolls Will +
  Persuasion or Survival at difficulty 1. An NPC's damage is used as
  given in its stat block (it already includes bonus damage), unlike a
  player character's.
- **Mythos spells**: the Spells tab offers the Tome of Cthulhu, Compendium
  of Mormo, Grimoire of Nyarlathotep and Spellbook of Yog-Sothoth, plus NPC
  Spellcaster types, only on NPC sheets.

## Companion API script (optional)

The Cohors Cthulhu Companion
(`api-scripts/CohorsCthulhuCompanion/CohorsCthulhuCompanion.js`) is an
optional companion Mod (API script). The sheet doesn't need it. It adds:

- **Global Momentum and Threat pools**, kept up to date by every roll from
  the sheet and shown in chat and the Turn Order.
- **Token actions** for each character's weapons and spells.
- **NPC import**: NPCs written as JSON (format in
  [`npc-import/FORMAT.md`](./npc-import/FORMAT.md)) become ready-to-play
  characters, with their tokens.

Mods need a Roll20 Pro subscription for the game's creator. The script
needs no other scripts. Installation, commands and details are in
[its README](./api-scripts/CohorsCthulhuCompanion/README.md).

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

## Modifying the sheet

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
be edited directly - change the source and rebuild instead.

### Trying your changes in Roll20

A changed sheet runs in a game as a Custom sheet (Custom sheets need a
Roll20 Pro subscription):

1. On the game's page, open **Settings** > **Game Settings**, and scroll to
   **Character Sheet Template**.
2. Choose **Custom** from the dropdown.
3. Paste the full contents of `Cohors_Cthulhu.html` into the **HTML
   Layout** tab.
4. Paste the full contents of `Cohors_Cthulhu.css` into the **CSS
   Styling** tab.
5. Save Changes.

Every character in the game now uses this sheet. Always paste both files
from the same build - mixing an old HTML paste with a newer CSS paste (or
vice versa) can leave the sheet out of sync with itself. The sheet's
footer prints a build timestamp (`HTML build: ...` / `CSS build: ...`)
from each file; if the two differ, one of the pastes is stale.

### Adding spells, weapons, armor and talents

Every list on the sheet comes from data in `source/`. After any change below,
run `npm run build` and re-paste `Cohors_Cthulhu.html` (and
`Cohors_Cthulhu.css`) into Roll20.

#### A new spell

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

   An **attack spell** (category "Attack spell") also gets a
   `"damage_effects"`, in a weapon's format: the base rating in Challenge
   Dice, then the effects ("2, Piercing 1"). Its row shows the field, and
   the casting roll rolls the caster's Power plus that rating, like a weapon
   attack (see "Using the sheet"). `source/data/spells.schema.json` describes every field, and
   `npm run build` checks `spells.json` against it, stopping with the
   spell and field named, and listing attack spells with no damage yet.
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

#### A new weapon

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
3. **The companion API script** (`CohorsCthulhuCompanion.js`): copy the
   same profile into the `ccWeaponProfiles` table in its NPC IMPORT
   section, so imported NPCs can name the weapon (then update the script
   in Roll20).
4. *Optional*: add the name to the known-weapons list in
   `npc-import/FORMAT.md`.

#### New armor

1. **`source/views/panels/_armor_panel.pug`**, at the top: add a profile to
   `ccArmorProfiles`:

   ```js
   'Lorica Plumata': {resistance: '3', qualities: 'Heavy'},
   ```
2. Same file: add the name to the **players' dropdown** (the `+select` with
   class `.cc-armor-name-select`, written out one option at a time) and to
   the **NPC suggestion list** (`datalist#cc-armor-options`):

   ```pug
   +option({value: 'Lorica Plumata'})
     | Lorica Plumata
   ```

   ```pug
   option(value='Lorica Plumata')
   ```
3. **The companion API script** (`CohorsCthulhuCompanion.js`): copy the
   profile into the `ccArmorProfiles` table in its NPC IMPORT section (then
   update the script in Roll20).
4. *Optional*: add it to the known-armor list in `npc-import/FORMAT.md`.

#### A new talent

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
requirements from `talents.json` the first time the sheet is opened, so the
companion script needs no change. A talent that changes a calculated value
(like Unyielding's +3 Max Stress) also needs code: see `ccStressMaxBase` in
`source/views/panels/_vitals_panel.pug`.
