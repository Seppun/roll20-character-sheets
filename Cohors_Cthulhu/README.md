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

## Global Momentum pool (API script)

Momentum in the 2d20 System is a shared party resource, not a
per-character stat - it can't live as an attribute on this (or any)
character sheet, since each character's sheet is its own isolated set of
attributes with no visibility into any other character's. `api-scripts/`
holds a small Roll20 API script, `ccmomentum.js`, that maintains a single
game-wide Momentum pool instead, kept in sync automatically: every roll
made from this sheet (Attribute/Skill/Focus/Weapon/Spell) sends a hidden
`!ccmomentum-adjust N` chat command via the sheet worker's own `sendChat`
(see `ccSendMomentumSignal` in `source/views/_character.pug`) whenever a
roll generates Momentum, or spends it by buying additional d20s or (for
spells) declaring Extra Momentum spent.

This is a **separate piece from the character sheet itself** - it's not
part of the compiled `Cohors_Cthulhu.html`/`.css`, and isn't pasted into
the Custom Sheet Layout/Style boxes. Instead, in a Pro-tier game with the
API sandbox enabled: Game Settings > API Scripts > New Script, paste in
the whole contents of `api-scripts/ccmomentum.js`, Save Script. Without
that script installed, the sheet's hidden signal is just an unrecognized
"!" chat command that Roll20 quietly ignores - rolling still works fine,
there's just no shared pool.

Chat commands once installed: `!momentum` (announce the current value),
and GM-only `!momentum-set N` / `!momentum-adjust N` for manual
corrections. The pool displays in chat on every change, plus two passive
displays that don't require re-opening chat: a pinned custom entry at the
top of the Turn Order tracker (needs no setup), and, if the GM places any
token/graphic named "Momentum Pool" on the current page, that token's
bar1 is kept in sync too - closer to how a deck's remaining count sits
visibly on the tabletop.

**This piece specifically has not been tested in a live Roll20 game** -
unlike the sheet itself (verified by rebuilding and rendering with
Playwright), a Roll20 API script's `sendChat`/`state`/`findObjs`/etc.
sandbox only exists inside an actual Roll20 session, which this
development environment has no access to. The script's own internal logic
was verified with mocked versions of those globals, but the real
end-to-end path (sheet worker `sendChat` -> API script `chat:message` ->
displays updating) needs a real playtest to confirm.
