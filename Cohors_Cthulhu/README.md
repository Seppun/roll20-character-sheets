# Cohors Cthulhu sheet

This folder contains the source code for the Roll20 VTT sheet for
Cohors Cthulhu, a Roman-legion / Cthulhu Mythos horror game built on
Modiphius's 2d20 System.

Maintained by Han Vanholder.

For debugging notes, Roll20/k-scaffold platform quirks, and the reasoning
behind non-obvious code decisions, see [`lessons_learned.md`](./lessons_learned.md)
instead - this file is about using and installing the sheet.

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
  actually hit - a miss just shows the attack roll.
- **Stress, Fatigue, and Fortune trackers**: click a box to fill the
  track up to and including it, or click an already-filled box to clear
  the track back down to that box. Click box 1 while it's the only box
  filled to clear the whole track to empty - there's no separate Clear
  button. Fatigue can't be marked past the character's Max Stress; those
  boxes are greyed out and disabled once Fatigue reaches that limit.
  "Max" shows the character's raw Stress capacity; "Current Max" shows
  that same number reduced by current Fatigue.
- **Weapons, Armor, and Talents**: picking a name from the dropdown (or,
  for Talents, from the datalist suggestions) fills in that row's stock
  stats automatically - every field stays freely editable afterward for
  house-ruled or modified equipment.
- **Dark Mode**: supported via Roll20's own per-player Dark Mode toggle.
- **Printing / Download as PDF**: if your Roll20 account has print
  support available, a Print button appears on the character sheet
  dialog itself (enabled by this sheet's `sheet.json`). It prints all
  three tabs stacked one after another (not just whichever tab you had
  open), with interactive-only chrome (tab buttons, "Modify"/"+Add Item"
  controls, the build-timestamp footer) hidden, Dark Mode forced off, and
  light-on-dark banners/headers swapped to dark-on-white so they stay
  legible on paper.

## Global Momentum and Threat pools (API scripts)

Momentum and Threat in the 2d20 System are shared, game-wide resources,
not per-character stats - neither can live as an attribute on this (or
any) character sheet, since each character's sheet is its own isolated
set of attributes with no visibility into any other character's, let
alone a GM-only pool. `api-scripts/` holds two small, independent Roll20
API scripts, `ccmomentum.js` and `ccthreat.js`, that each maintain one
such pool, kept in sync automatically by every roll made from this sheet
(Attribute/Skill/Focus/Weapon/Spell):

- **Momentum** increases by the Momentum a passed roll generates, and
  decreases by Extra Momentum declared spent on a spell. Capped at 6 in
  either direction (2d20 RAW: the Momentum pool can never exceed 6), and
  announcements always report the amount the pool actually changed by,
  not the amount requested, in case the cap silently absorbed part or all
  of it.
- **Buying additional d20s** (any roll type, up to 2 extra dice) costs 1
  Momentum for the first one and 3 for the second. If the pool can't
  cover the full cost, buying the dice is still allowed - whatever the
  pool comes up short generates an equal amount of Threat instead, since
  only the API script (not the character sheet) knows the pool's current
  value at the time the dice are bought.
- **Threat** increases by the Complications a roll generates (2d20 RAW:
  each Complication generates 1 point of Threat for the GM), plus any
  shortfall from buying additional d20s above. There's no automatic
  decrease otherwise - RAW never has a player spend Threat from their own
  sheet, only the GM spends it (buying NPCs extra d20s, directorial
  effects), which happens in narration rather than on this sheet, so
  `!threat-adjust` (GM only) is the only way the pool goes down.

### Installing the API scripts

These are **separate pieces from the character sheet itself** - neither
is part of the compiled `Cohors_Cthulhu.html`/`.css`, and neither is
pasted into the Custom Sheet Layout/Style boxes above. Instead, in a
Pro-tier game with the API sandbox enabled:

1. **Game Settings** > **API Scripts** > **New Script**.
2. Paste in the whole contents of `api-scripts/ccmomentum.js`, Save
   Script.
3. Repeat for `api-scripts/ccthreat.js`.

They run side by side as two ordinary API scripts. Without either script
installed, that pool's hidden signal just renders (and immediately hides)
a roll template card nobody looks at - rolling still works fine, there's
just no shared pool.

### Using the pools

Both pools post to chat on every change, plus two passive displays that
don't require re-opening chat: a pinned custom entry at the top of the
Turn Order tracker (needs no setup, one row per pool), and, if the GM
places a token/graphic named "Momentum Pool" or "Threat Pool" on the
current page, that token's bar1 is kept in sync too.

Chat commands once installed:

| Command | Who | Effect |
| --- | --- | --- |
| `!momentum` / `!threat` | anyone | Announce the current pool value |
| `!momentum-set N` / `!threat-set N` | GM only | Set the pool to an exact value |
| `!momentum-adjust N` / `!threat-adjust N` | GM only | Add N (negative to subtract) - also how a GM spends Threat, since nothing on the sheet does that automatically |

Both scripts also log every chat message they see to the API console, to
make debugging from there easier if a pool ever seems out of sync.

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
