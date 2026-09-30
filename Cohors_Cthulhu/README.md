# Cohors Cthulhu sheet

This folder contains the source code for the Roll20 VTT sheet for
Cohors Cthulhu, a Roman-legion / Cthulhu Mythos horror game built on
Modiphius's 2d20 System.

Maintained by Han Vanholder.

## Tools

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
be edited directly.

## Status

Work in progress. Stage 1-3 complete: static layout, sheet-worker
calculations, and custom 2d20 roll buttons (Attributes/Skills/Focuses) are
built and confirmed working in real Roll20, including roll template
styling.

## Roll template styling: hard-won lessons

Getting a custom roll template (the `&{template:X}` chat card a roll
button produces) to actually show computed values *and* be styled took a
long debugging session against real Roll20, because almost every failure
mode here is **silent** - no error, no warning, the template just renders
plain/unstyled/blank and gives no hint why. If you're building a Roll20
sheet (with or without k-scaffold) and hit the same wall, check these in
order:

### 1. `finishRoll` overrides need `computed::` in the template

If you declare a field as an inline roll expression in your roll string
(e.g. `{{successes=[[0]]}}`, so you can fill it in later via
`finishRoll(rollId, {successes: 3})`), the template **must** reference it
as `{{computed::successes}}`, not `{{successes}}`. Plain `{{successes}}`
renders the *original* value of the `[[0]]` expression - here, literally
the string `"0"` - forever, no matter what you pass to `finishRoll`. This
is easy to miss because the field still *shows up*, just frozen at its
placeholder value, which looks like a data problem rather than a template
syntax problem.

Fields you only ever write via `finishRoll` (never read back out of
`roll.results`) still need the `[[0]]` wrapper in the roll string - a
field with no bracket wrapper and no `computed::` reference can't be
overridden at all.

### 2. `{{#field}}` conditionals don't respect overrides either

The same problem applies to Mustache-style conditional sections. Once a
field started life as `[[...]]`, `{{#field}}...{{/field}}` checks the
*pre-override* value, not what you passed to `finishRoll` - so a section
gated on an overridden field is either always shown or always hidden,
regardless of the actual result. Use the roll template helper functions
instead for an exact-value comparison against the computed override:

```pug
+rollTotal({values: 'computed::outcome 1'})
  .cc-roll-outcome.cc-roll-pass
    span Passed
+rollTotal({values: 'computed::outcome 0'})
  .cc-roll-outcome.cc-roll-fail
    span Failed
```

(`rollGreater`/`rollLess`/`rollBetween` work the same way for numeric
thresholds, e.g. only showing a "Complications" line when the count > 0.)

### 3. Roll20 prefixes every internal class with `sheet-`

Any class used *inside* your `<rolltemplate>` markup gets `sheet-`
prepended automatically when Roll20 renders it in chat - confirmed by
inspecting the live DOM via browser dev tools. Your own
`class="cc-roll-header"` comes out as `class="sheet-cc-roll-header"` in
the actual chat message. Your CSS selectors need to match the *rendered*
name, not the one in your source:

```scss
// Wrong - never matches anything, no error, just silently does nothing:
.cc-roll-header { font-weight: bold; }

// Right:
.sheet-cc-roll-header { font-weight: bold; }
```

The one exception is the rolltemplate's own root class
(`sheet-rolltemplate-<name>`), which you author with that prefix yourself
and Roll20 doesn't touch further, and Roll20's own built-in
`.inlinerollresult` class, which is never prefixed.

### 4. Visual CSS must live on a child wrapper, not the rolltemplate root

Background, border, font, and padding rules placed directly on
`.sheet-rolltemplate-<name>` do not apply reliably. Wrap your actual
content in a child `<div>` and put all visual styling on *that* instead:

```pug
+rolltemplate('myroll')
  .my-card
    //- all your actual content here
```

```scss
// Root: no visual styling here, or just CSS variable declarations.
.sheet-rolltemplate-myroll {
  .sheet-my-card {
    background: #eee;
    border: 1px solid #333;
    // etc - this is where it actually needs to be.
  }
}
```

Every real, published sheet checked during this investigation (both
`Achtung!_Cthulhu_2d20` and `Ars_Magica_5th` elsewhere in this repo)
follows this pattern - neither one styles a bare `.sheet-rolltemplate-X`
selector directly.

### 5. The CSS security sanitizer silently discards ALL roll template styling

This is the big one, and the hardest to find, because the failure is
**global and silent by default**: Roll20 runs your entire pasted
stylesheet through a security scanner, and if it finds certain patterns
*anywhere in the file* - not just inside your roll template's own
rules - it throws out **all** roll template styling for the whole
stylesheet, while your regular sheet CSS keeps working completely
normally. This makes it look like nothing you do to your roll template's
own CSS could possibly matter, because it doesn't - the problem is
somewhere else in the file.

If you open the browser console (F12) while the game is loading and see:

```
Potential CSS security violation; character sheet template styling thrown out.
```

...this is what's happening. Known triggers, all confirmed directly
against this sheet:

- **A CSS comment** (`/* ... */`) anywhere in the pasted stylesheet.
  `//` Sass comments are fine (they don't survive compilation), but any
  literal `/* */` block - including ones bundled in by a framework's own
  default styles, not just your own - trips it.
- **`position: fixed`** anywhere in the stylesheet, even in a component
  you never actually use or render (a k-scaffold default modal component
  in our case). Presumably flagged as a clickjacking/UI-redress vector.
- **Any inline `data:` URI background image**, SVG or raster, anywhere in
  the stylesheet. This isn't SVG-specific, despite some Roll20 forum
  threads describing it that way - a `data:image/png;base64,...`
  background tripped the exact same error. Host images externally
  instead (e.g. `url('https://raw.githubusercontent.com/...')`)
  - neither `Achtung!_Cthulhu_2d20` nor `Ars_Magica_5th` in this repo use
  a single inline `data:` URI image anywhere in their CSS; both host
  every image externally.

Practical mitigations used in this sheet's `generate.js`:

- Compile Sass with `scssOptions: { style: 'compressed' }` to strip all
  comments (among other things) as a normal part of the build, so a
  dependency's bundled comments can't reintroduce the problem later.
- Post-process the compiled CSS to swap any stray `position: fixed` for
  `position: absolute` (safe only because the affected component isn't
  actually rendered on the page - don't do this blindly if you actually
  rely on fixed positioning somewhere).
- Never inline images as `data:` URIs; commit them to the repo and
  reference them by URL instead.

There is no comprehensive published list of what the sanitizer flags -
these are just the three actually observed. If your roll template CSS
still doesn't apply after checking 1-4 above, keep searching your *whole*
stylesheet (not just the roll template section) for anything unusual,
and compare against a sheet you know works.

### Useful diagnostic techniques

- **Inline `style="..."` attribute**: add one directly to an element in
  your roll template markup as a test. If it renders (e.g. a bright
  `background: red`), styling *can* reach the template and the problem is
  specifically your external stylesheet not being read - if it doesn't
  render either, something more fundamental is going on.
- **Browser dev tools `$0`**: select an element in the Elements panel,
  then in the Console, `$0.ownerDocument` tells you which actual document
  it lives in (useful for ruling out iframe-isolation theories - in our
  case the roll card and the top-level page turned out to be the same
  document all along).
- **A build-timestamp footer**: stamping a build time into both the
  compiled HTML and, separately, into the compiled CSS (as a
  `content: "..."` value on a `::after` pseudo-element) and displaying
  both on the sheet lets you immediately spot a stale paste - if the two
  timestamps ever differ, you pasted an old copy of one file after
  updating the other.

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
  decreases by additional d20s bought (all roll types) or, for spells,
  Extra Momentum declared spent. Capped at 6 in either direction (2d20
  RAW: the Momentum pool can never exceed 6) - enforced centrally in
  `ccmomentum.js`'s own `setPool`, so every path that changes the pool
  (the automatic signal, the manual chat commands, and a GM's direct
  `!momentum-set`) respects it, and announcements always report the
  amount the pool actually changed by, not the amount requested, in case
  the cap silently absorbed part or all of it.
- **Threat** increases by the Complications a roll generates (2d20 RAW:
  each Complication generates 1 point of Threat for the GM). There's no
  automatic decrease - RAW never has a player spend Threat from their own
  sheet, only the GM spends it (buying NPCs extra d20s, directorial
  effects), which happens in narration rather than on this sheet, so
  `!threat-adjust` (GM only) is the only way the pool goes down.

Sheet workers turned out to have no `sendChat()` of their own (confirmed
live: calling it throws "sendChat is not defined"), so each pool's signal
instead rides a dedicated, hidden (`display:none`) roll template -
`ccmomentumsignal`/`ccthreatsignal` in `rolltemplate/_index.pug` - sent
via `startRoll`/`finishRoll`, the only way sheet-worker code can put
anything into chat at all (see `ccSendMomentumSignal`/`ccSendThreatSignal`
in `source/views/_character.pug`). The two signals are kept fully
independent (separate templates, separate fields, separate API scripts)
so adding Threat could never risk the already-working Momentum pool.

These are **separate pieces from the character sheet itself** - neither
is part of the compiled `Cohors_Cthulhu.html`/`.css`, and neither is
pasted into the Custom Sheet Layout/Style boxes. Instead, in a Pro-tier
game with the API sandbox enabled: Game Settings > API Scripts > New
Script, paste in the whole contents of `api-scripts/ccmomentum.js`, Save
Script, then repeat for `api-scripts/ccthreat.js` - they run side by side
as two ordinary API scripts. Without either script installed, that pool's
hidden signal just renders (and immediately hides) a roll template card
nobody looks at - rolling still works fine, there's just no shared pool.

Chat commands once installed: `!momentum` / `!threat` (announce the
current value), and GM-only `!momentum-set N` / `!threat-set N` and
`!momentum-adjust N` / `!threat-adjust N` for manual corrections (the
latter pair is also how a GM actually spends Threat, since nothing on the
sheet does that automatically). Both scripts also unconditionally log
every chat message they see, to make debugging from the API console
easier. Each pool posts to chat on every change, plus two passive
displays that don't require re-opening chat: a pinned custom entry at the
top of the Turn Order tracker (needs no setup, one row per pool), and, if
the GM places a token/graphic named "Momentum Pool" or "Threat Pool" on
the current page, that token's bar1 is kept in sync too - closer to how a
deck's remaining count sits visibly on the tabletop.

The Momentum pool has been **confirmed working end-to-end in a live
Roll20 game**. The Threat pool reuses the exact same, already-proven
signal mechanism (hidden roll template + `startRoll`/`finishRoll` +
`msg.inlinerolls`), so it's expected to work the same way, but hasn't
itself had a separate live playtest yet - a Roll20 API script's
`sendChat`/`state`/`findObjs`/etc. sandbox only exists inside an actual
Roll20 session, which this development environment has no access to, so
its internal logic was verified with mocked versions of those globals
instead.

## Printing / "Download as PDF"

A character sheet's own code can't drive a real "Download as PDF" button
directly - sheet workers only get a sandboxed API (`getAttrs`/`setAttrs`/
`startRoll`/etc.), with no access to `window`, `document`, or any print/
file-download API, so there's no way to trigger `window.print()` or load
a PDF library from sheet code. What a sheet *can* do is opt into Roll20's
own native print feature: setting `"printable": true` in `sheet.json`
(added here) turns on a real Print button on the character sheet dialog
itself (Roll20's own UI, not something this sheet renders) - this was a
2024 addition specifically opening up a feature previously exclusive to
Roll20's own officially-curated sheets (like D&D 5e) to community sheet
authors. That button runs with real page-level access no sheet's own JS
ever gets, so it can correctly print just the sheet instead of the whole
browser tab/window - a generic Ctrl/Cmd+P or right-click > Print instead
prints everything visible on the Roll20 page (map, chat, sidebar) since
those aren't something a sheet's own CSS has any power to hide.

Getting that native button to appear is the important part - a sheet
whose `sheet.json` doesn't set `printable: true` has no print button in
the dialog at all, full stop, regardless of any print CSS. Once it exists
though, it still hands off to the browser's own print pipeline
(Ctrl/Cmd+P, destination "Save as PDF") for the actual rendering - which
is where this sheet's own `@media print` stylesheet
(`source/Cohors_Cthulhu.scss` and `source/scss/_index.scss`) takes over,
making that printout clean and complete instead of a raw dump of
whatever the live sheet UI happens to look like:

- All three tabs (Character, Spells, Notes) print stacked one after
  another, instead of just whichever one happened to be open - Roll20's
  own tab-hiding CSS (`.tabs__container:not(.k-active-tab)`) is
  overridden for print specifically.
- Purely interactive chrome - the tab nav, Roll20's native "Modify"/"+Add
  Item" repeating-section controls, and the build-timestamp footer - is
  hidden, since none of it does anything on paper.
- Dark Mode is forced off for print regardless of the toggle, to avoid
  wasting ink/toner on a dark background most printers render poorly
  anyway.
- Banner ribbons, table header rows, and the attribute/skill roll buttons
  normally use light text over a dark background/image. Browsers/printers
  commonly don't print background colors or images by default (a "print
  background graphics" setting most people leave off), which would make
  that text invisible on white paper - print styles drop those
  backgrounds and swap in a bordered, dark-ink-on-white look instead, so
  it stays legible no matter how that setting is configured.

The print CSS itself was verified locally via Playwright's print-media
emulation and a headless `page.pdf()` render (confirmed all three tabs'
content appears across the resulting pages, and that the light-on-dark
elements above render as dark-on-white instead) - not something a real
Roll20 session was needed for, since it only depends on standard browser
print behavior, not anything Roll20-specific. Whether Roll20's own Print
button actually appears and correctly isolates the sheet, on the other
hand, can only be confirmed in a real Roll20 game - this development
environment has no access to Roll20's own client UI at all.
