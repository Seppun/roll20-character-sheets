# Lessons learned

Debugging notes, Roll20/k-scaffold platform quirks, confirmed gotchas, and
diagnostic techniques collected while building this sheet. None of this is
needed to *use* the sheet (see `README.md` for that) - it's here so the
next person debugging a similar problem, on this sheet or another Roll20
sheet entirely, doesn't have to rediscover it the hard way.

## Roll template styling

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
  default styles, not just your own - tripped it in an earlier debugging
  session. A later re-test in an isolated scratch sandbox, with the exact
  previously-broken comment text, rendered correctly - Roll20 no longer
  reproduces this specific trigger as of that re-test. Kept here anyway
  as the first thing to re-suspect if roll-template styling ever silently
  breaks again, since there's no guarantee the platform won't change back.
- **`position: fixed`** anywhere in the stylesheet, even in a component
  you never actually use or render (a k-scaffold default modal component
  in our case). Presumably flagged as a clickjacking/UI-redress vector.
  Still an active, confirmed trigger - `generate.js` post-processes the
  compiled CSS to swap any stray `position: fixed` for `position: absolute`
  as a standing mitigation.
- **Any inline `data:` URI background image**, SVG or raster, anywhere in
  the stylesheet. This isn't SVG-specific, despite some Roll20 forum
  threads describing it that way - a `data:image/png;base64,...`
  background tripped the exact same error, and so did an inline
  `data:image/svg+xml,...` crack-texture background added later in this
  project (see "Stone button crack texture" below) - re-confirmed as a
  live, current trigger, not just a historical one. Host images
  externally instead (e.g. `url('https://raw.githubusercontent.com/...')`)
  - neither `Achtung!_Cthulhu_2d20` nor `Ars_Magica_5th` in this repo use
  a single inline `data:` URI image anywhere in their CSS; both host
  every image externally.

- **A CSS `@import` at-rule** anywhere in the pasted stylesheet. Loading
  a web font via `@import url(https://fonts.googleapis.com/...)` (the same
  pattern `Ars_Magica_5th` elsewhere in this repo uses successfully in its
  own, unrelated main-sheet CSS) loaded the font fine for the sheet
  itself, but silently broke roll-template rendering in the chat pane -
  the roll card's own hardcoded `font-family: Georgia, serif` stopped
  taking effect. Switching to direct `@font-face` rules (no `@import`)
  fixed it.

There is no comprehensive published list of what the sanitizer flags -
these are just the three actually observed. If your roll template CSS
still doesn't apply after checking 1-4 above, keep searching your *whole*
stylesheet (not just the roll template section) for anything unusual,
and compare against a sheet you know works.

#### Stone button crack texture (data: URI regression, found and fixed live)

After the sanitizer re-test above suggested CSS comments were safe again,
this sheet's own roll templates broke a second time, live in Roll20, after
a stone-button styling pass added an inline
`background-image: url("data:image/svg+xml,...")` crack-line texture to
three button rules in the regular sheet CSS (nowhere near the roll
template). That one change alone reproduced the exact same "Potential CSS
security violation" console message and silently killed all roll-template
styling again - concrete, current-day confirmation that the `data:` URI
trigger is still live, and that the broken CSS doesn't have to be
anywhere near the roll template itself to trigger it. Fixed by committing
the crack SVGs as real files and hosting them externally (same pattern as
every other image on this sheet) instead of inlining them. The crack
texture was later replaced entirely with plain `radial-gradient()` dots
(see the Focus/Weapon roll button comments in their own panel files) -
pure CSS, so this category of regression can't recur there again by
construction.

#### Practical mitigations used in this sheet

- `generate.js` post-processes the compiled CSS to swap any stray
  `position: fixed` for `position: absolute` (safe only because the
  affected component isn't actually rendered on the page - don't do this
  blindly if you actually rely on fixed positioning somewhere).
- Never inline images (or other backgrounds) as `data:` URIs; commit them
  to the repo and reference them by URL instead, or use pure CSS
  (gradients, box-shadow, etc.) that needs no image asset at all.
- An earlier, more defensive mitigation compiled Sass with
  `scssOptions: { style: 'compressed' }` specifically to strip all CSS
  comments as a normal part of every build, so a dependency's bundled
  comments couldn't reintroduce the (at the time, suspected-live)
  comment trigger. Dropped once the comment trigger re-tested as safe (see
  above) - `generate.js` now compiles with `style: 'expanded'` so the
  shipped CSS stays human-readable with real comments, matching the
  source. Revert to `compressed` as a first response if roll-template
  styling ever silently breaks again and the cause isn't immediately
  obvious.

### 6. Roll template CSS can't use custom properties

Roll templates render inside Roll20's chat pane, which sanitizes their CSS
through a stricter, older filter than the main sheet stylesheet - CSS
custom properties (`var(...)`) aren't on its allowlist, and any
declaration using one gets silently dropped (not the whole stylesheet
this time, just that one declaration). Use plain hardcoded color values
inside roll-template CSS (`+scss('roll')` in k-scaffold), even though the
main sheet's own CSS variables work fine everywhere else.

### An API script reads a roll's value from `msg.inlinerolls`, not `msg.content`

The Roll20 API sandbox never renders roll templates to HTML at all - that
only happens client-side, in a player's browser. For a chat message
containing an inline roll expression (`[[...]]`), `msg.content` holds the
raw, unrendered field list with a `$[[0]]`-style placeholder standing in
for the resolved value, not the computed number. The actual computed
value lives in the separate `msg.inlinerolls` array Roll20 attaches to
the message - `msg.inlinerolls[0].results.total` for a template with
exactly one `[[...]]` expression (see `extractMomentumSignalDelta` in
`api-scripts/ccmomentum.js`).

### Roll20 strips the template reference from `msg.content`

Confirmed live: Roll20 strips the `&{template:X}` reference itself out of
`msg.content` before an API script's `chat:message` handler ever sees it -
true for *every* roll, not just a hidden signal one (a normal, finished
`ccskill` weapon roll's `msg.content` has no `"template:ccskill"` in it
either). Only the `{{field=value}}` pairs survive. An API script that
needs to recognize "is this my signal" can't do it by template name at
all - it has to look for one of the signal's own distinctively-named
fields instead (this sheet uses `ccmomentumdelta`/`ccthreatdelta`, chosen
to be unlikely to collide with an unrelated field from anything else in
the game).

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
  updating the other. (This sheet's footer does exactly this - see
  `.cc-build-html`/`.cc-build-css` in `views/_character.pug`.)

## Sheet workers are sandboxed - no `window`/`document`, no `sendChat()`

A sheet worker only gets Roll20's own sandboxed API
(`getAttrs`/`setAttrs`/`startRoll`/`finishRoll`/etc.) - no access to
`window`, `document`, or any browser file-download/print API, so there's
no way to trigger `window.print()`, load a PDF library, or otherwise
reach outside that sandbox from sheet code. This sheet's print support
works around it by using Roll20's own native Print button
(`"printable": true` in `sheet.json`) plus a `@media print` stylesheet,
rather than anything sheet code drives directly - see the "Printing"
section of `README.md` for what that produces.

Confirmed live in a real game: calling `sendChat()` from a sheet worker
throws `"sendChat is not defined"`, unlike the API sandbox's own
`sendChat`. The only way sheet-worker code can put anything into chat at
all is a real dice roll via `startRoll`/`finishRoll`. This sheet uses that
to drive two hidden, whispered-to-GM roll templates
(`ccmomentumsignal`/`ccthreatsignal` in `rolltemplate/_index.pug`) purely
so their rendered HTML reaches a companion Roll20 API script's
`chat:message` handler for parsing - see `ccSendMomentumSignal`/
`ccSendThreatSignal` in `views/_global_sheetworker.pug` and the "Global
Momentum and Threat pools" section of `README.md`.

A related discovery: a `startRoll()` a sheet worker never calls
`finishRoll()` on doesn't post its real template content at all - Roll20
replaces it with a generic "A roll was initiated by a character sheet,
but it was not finished: `{{delta=$[[0]]}}`" placeholder message instead
(missing the `&{template:...}` reference entirely, though the actual
computed inline-roll value is still present and correct). Always call
`finishRoll` even when none of your fields need an override.

## `finishRoll` can't inject brand-new fields

Every field you plan to set via `finishRoll`'s override object must
already exist in the original roll string as a `[[0]]` placeholder -
`finishRoll` can only update fields that were part of the initial
message, it cannot add new field names. Confirmed the hard way: fields
declared upfront (`character_name`/`skill`/`difficulty` in this sheet's
own roll string) rendered fine; fields only ever set via `finishRoll`'s
second argument, with no `[[0]]` placeholder in the original string,
never appeared in the chat card at all.

## Dice result shape varies

Roll20's documented result shape nests individual dice under
`rolls[0].results[].v`; some sheets also see a flattened `.dice` array
directly on the roll-field result. This sheet's own roll handlers check
`Array.isArray(roll1.dice)` first and fall back to the nested shape, to
be safe against both.

## Action-button trigger names are dash-separated

An action button's `trigger.name` arrives dash-separated with no `act_`
prefix at runtime (e.g. `'academia-focus-finance-roll'`, or
`'stress-box-5'` for this sheet's own track-click buttons) - not the
underscore-separated, space-derived name you'd expect from the button's
declared `name`. Confirmed by inspecting the compiled sheet's own cascade
data. Any code that parses `trigger.name` for an action button needs to
normalize dashes to underscores first (see `ccNormalizeName` in
`views/_global_sheetworker.pug`) before matching against underscore-form
regexes, or match the dash form directly.

## Astral (4-byte UTF-8) characters break Roll20's save endpoint

A glyph outside the Basic Multilingual Plane (an emoji like the octopus
originally used for a weapon-damage "Effect" face, or any other 4-byte
UTF-8 character) anywhere in the sheet's HTML or CSS source gets rejected
by Roll20's `savesheetsettings` endpoint with a 500 error the first time
that code is pasted into a fresh game - a known failure mode on Roll20's
backend for any 4-byte-UTF-8 character in custom sheet code, confirmed
directly against this sheet. A plain BMP character that reads the same way
(e.g. skull and crossbones, ☠, in place of the octopus emoji) saves
without issue. Every build runs an automated check (astral code-point scan
on the compiled HTML/CSS) specifically to catch a regression here before
it reaches Roll20.

## Fill-left radio/checkbox tracker: the "can't get back to zero" trap

A "fill to the left" clickable tracker (k-scaffold's own `+fillLeft`
mixin, or this sheet's hand-expanded version of the same idea) has two
natural widget choices, and both have a dead end a plain HTML input can't
get out of on its own:

- **Checkboxes** (`+fillLeft`'s own default, non-`noClear` mode) let a
  double-click net out to "nothing in the whole group is checked"
  (checking then immediately unchecking the same box). With nothing
  checked, the CSS fill-coloring trick (`:checked ~ .fill-left__radio`)
  has no `:checked` anchor to peel any box's coloring off the shared
  default - which is "selected"/filled, not "unselected"/empty - so
  every box in the track renders filled. Confirmed directly: reproduced
  live and locally.
- **Radios** (`+fillLeft`'s `noClear: true` mode, and this sheet's own
  choice) avoid that specific bug - clicking a different, unchecked radio
  always atomically (un)checks exactly one radio in the group, so some
  box always stays checked from the first click onward - but then
  clicking the box that's *already* checked is a native no-op: no event
  fires at all, so there's no way for the player to click the current box
  to clear it back to empty.

This sheet's Stress/Fortune/Fatigue trackers solve this by making the
*visible* boxes `+action` buttons instead of either widget - a button has
no checked state of its own to get stuck in, so every click is a real,
inspectable sheet-worker event (`ccTrackBoxClick` in
`views/panels/_vitals_panel.pug`), which can tell "click box 1 while it's
the only box filled" apart from every other click and clear the track to
0 instead of re-selecting 1. The actual fill-coloring job moves to a
second, hidden radio group mirroring the tracked attribute's own value,
purely so its `:checked` state can still drive the same CSS trick.

A related trap: the group's `value=0` "all empty" anchor must be a real,
visually-hidden `<input type="radio">` (`display:none` or the
opacity/width/height-zero treatment), not a literal `+hidden()`
(`type="hidden"`) input - a genuine `type="hidden"` input can never match
`:checked` at all. Confirmed the hard way: that was the original value=0
marker on this sheet's Stress tracker, and it never once greyed out
anything, live or locally.

Also worth knowing: a hidden hidden-hidden-radio marker group (like the
max-value or current-value markers this sheet uses) needs **every**
reachable value represented, including 0 - if the calculated value a
marker mirrors can be 0 (e.g. a brand-new character with every rating
still at its default), and the group has no radio with `value="0"`,
nothing in the group ever matches, nothing is ever `:checked`, and the
CSS rule keyed to that group's `:checked` state never fires at all. Found
this gap in this sheet's own `.cc-stress-max-marker`/`.cc-fatigue-max-marker`
groups and fixed both by adding an explicit `value: 0` member to each.

## k-scaffold `+select`/`+option` loop bug

Generating a `<select>`'s `+option()` children from an array via an
`each` loop breaks: k-scaffold's `+select`/`+option` mixins defer
rendering each option's `block()` until after the whole containing block
has finished running, and Pug's `block` reference isn't captured
per-iteration - so every option inside the loop ends up showing the
*last* iteration's text, regardless of which value it has. Confirmed with
an isolated repro. Work around it by writing out each `+option()` call
individually (see the Weapons/Armor panels' Name dropdowns) rather than
generating them from a data object, even though the data for exactly that
purpose already exists as a plain JS object elsewhere in the same file.

## k-scaffold's default checkbox border never applies

k-scaffold's default checkbox styling relies on a mistyped custom
property upstream (`--checkboxBorderColor` falls back to an undefined
`--checkboxBorderColor` variable - the fallback name matches the property
name itself, which can never resolve), which silently drops the whole
border declaration. A checkbox styled only through k-scaffold's defaults
renders borderless/invisible - set `border` explicitly wherever a visible
checkbox outline matters (see `.cc-focus-checkbox` in
`views/panels/_skills_panel.pug`).

## `.cc-field`'s generic `> input` rule catches checkboxes too

A `.cc-field`'s own generic "direct-child input" styling rule (meant for
text/number fields - a transparent background, bottom-border-only look)
applies indiscriminately to *every* direct-child input, checkboxes
included, stripping a checkbox down to a flat line with no visible box
shape at all. A checkbox inside a `.cc-field` that should look like a
normal checkbox needs its own explicit override rule (see
`.cc-fatigue-ignore > input[type='checkbox']` in
`views/panels/_vitals_panel.pug`) rather than relying on
`appearance: none` to fight the inherited rule.

## Dead/misnamed CSS selectors fail silently

CSS selectors that don't match anything produce no error, no warning -
the rule is simply never applied, and the page looks "almost right"
rather than visibly broken, which makes the bug easy to miss entirely.
Two concrete examples found on this sheet:

- A rule written as `.cc-injuries .cc-injuries { ... }` (nested inside
  itself) never matched anything, because the actual wrapper element's
  class was `.cc-vitals-injuries`, not `.cc-injuries` - the *outer* rule
  was landing on the textarea itself instead of its wrapper, and the
  *inner*, nested-selector rule required `.cc-injuries` to contain
  another `.cc-injuries`, which never exists anywhere in the markup.
- Any class used inside a roll template's markup gets `sheet-` prepended
  by Roll20 at render time (see "Roll template styling" above) - a
  selector written against the un-prefixed name compiles fine, produces
  no console error, and just never matches the live chat card.

When a style "isn't applying" with zero errors anywhere, suspect a
selector/markup class mismatch before anything more exotic - inspect the
actual rendered DOM's class names directly rather than trusting the
source.

## Roll20 `<select>`/`<datalist>` event quirks

Picking a suggestion from a `<datalist>` (used for the Talents panel's
159-entry Name field, too long for a plain dropdown) only fires the
input's `input` event, not `change` - and Roll20's sheet-worker framework
only reacts to `change`, which a plain text input doesn't fire until it
loses focus. A trigger wired to that field's `change` event still works,
but only once the player clicks or tabs elsewhere after picking a
suggestion - add an explicit "apply" button (a real click, which always
fires immediately) as the instant-feedback alternative, rather than
relying on the field's own trigger alone.

## `<select>` vs. `<input list>` need different chevron-suppression CSS

Both render a dropdown-style field with the sheet's own CSS chevron
(`_index.scss`'s `select, input[list] { background-image: ... }` gradient
trick), but Chromium strips their *native* chrome differently, and
treating them the same produces a double-chevron (the sheet's drawn one
plus a native one underneath):

- `<select>` needs `appearance: none` to remove its native arrow - without
  it, two chevrons overlap.
- `<input list>` (the text+datalist combobox pattern, see the event-quirks
  entry above) has no native arrow of its own to strip via `appearance` -
  its "show suggestions" affordance is a separate pseudo-element,
  `::-webkit-calendar-picker-indicator` (the same one `<input type=date>`
  uses). `appearance: none` on an `input[list]` does nothing to it; it has
  to be hidden explicitly with its own rule, **and that rule needs
  `!important`**
  (`input[list]::-webkit-calendar-picker-indicator { display: none !important; }`) -
  without it, the indicator stayed visible (confirmed via
  `getComputedStyle(el, '::-webkit-calendar-picker-indicator')` reporting
  `display: block` even with the plain, non-`!important` rule compiled
  and present in the stylesheet). Chromium applies this pseudo-element's
  `display` from a shadow-tree user-agent style that wins over an
  equal-specificity author rule regardless of source order - normal CSS
  cascade/specificity reasoning about "my rule comes later, so it should
  win" does not apply to it.

Both rules are needed together - `appearance: none` still belongs on
`input[list]` too (it suppresses other native text-input chrome), it's
just not sufficient by itself. This was confirmed by injecting CSS at
runtime against the actual compiled sheet (`page.addStyleTag()` in a
Playwright script) rather than an isolated test page - a simplified
standalone `<input list>` test page gave misleading results, likely
because it didn't reproduce the real field's box-model/width/border
context closely enough.

## Never duplicate an attribute's radios on another tab

All radios named `attr_<x>` form ONE browser radio group across the whole
sheet, whichever tab they sit on. Copying the Character tab's
`character_type` radios onto the Spells tab (so that page's CSS could see
the type) meant the browser allowed only one of the eight to be checked:
on load the Spells tab's `pc` copy won and the Character tab showed no
type selected at all, with every type-driven panel rule dead. Fix: give the
other tab its own calculated marker attribute (`spells_type_marker`,
`calcSpellsTypeMarker`) and add it to the source attribute's `affects`,
the same pattern as `tradition_marker`. Duplicated *text/number/select*
fields with one attribute name are fine; radios aren't.

## Native HTML radios vs. Roll20's own attribute-group binding

A named radio group bound to one attribute (the standard way Roll20
renders a set of mutually-exclusive options) needs a member radio for
*every value the attribute can actually hold*, not just the values a
player is expected to pick directly - Roll20's own runtime keeps exactly
one radio in the group checked, matching the attribute's current value,
but if no radio in the group has a matching `value`, none of them end up
checked at all. This bit twice on this sheet: once for the fill-left
"current value" mirroring radios (needs one member per reachable track
value, see the `+fillLeft` section above), and once more subtly - a
hidden calculation-driven marker group needs a member for *every* value
its source calculation can return, including edge values like 0 that
only come up for a freshly-created character.

## Printing: verified without a live Roll20 session

Whether Roll20's own Print button actually appears and correctly isolates
the sheet can only be confirmed in a real Roll20 game - this development
environment has no access to Roll20's own client UI at all. What *could*
be verified without one: the `@media print` stylesheet itself only
depends on standard browser print behavior, not anything Roll20-specific,
so it was checked locally via Playwright's print-media emulation and a
headless `page.pdf()` render - confirming all three tabs' content appears
across the resulting pages, and that light-text-on-dark-background
elements (banners, table headers, roll buttons) correctly swap to a
dark-ink-on-white look instead of rendering invisibly, which is what
happens by default since most browsers/printers don't print background
colors or images unless a "print background graphics" setting is turned
on.

## Threat pool: verified with mocked Roll20 API globals

The Momentum pool (`api-scripts/ccmomentum.js`) has been confirmed working
end-to-end in a live Roll20 game. The Threat pool (`api-scripts/ccthreat.js`)
reuses the exact same, already-proven signal mechanism (hidden roll
template + `startRoll`/`finishRoll` + `msg.inlinerolls`), so it's expected
to work the same way, but hasn't itself had a separate live playtest - a
Roll20 API script's `sendChat`/`state`/`findObjs`/etc. sandbox only exists
inside an actual Roll20 session, which this development environment has
no access to, so its internal logic was instead verified with mocked
versions of those globals.

## Verification pipeline used for every change

Since this development environment has no access to a live Roll20 session
at all, every change goes through a local pipeline before being pushed,
to catch what can be caught without one:

- `npm run build`, then grep the compiled CSS for `position:fixed`/
  `position: fixed` and for `url("data:`/`url('data:` (the two
  roll-template sanitizer triggers covered above) - both must be absent.
- An astral-codepoint scan (`ord(c) > 0xFFFF`) over the compiled HTML and
  CSS, to catch a regression of the save-endpoint issue above before it
  reaches Roll20.
- Extract the `<script type="text/worker">` block from the compiled HTML
  and run `node --check` on it, to catch a syntax error before pasting.
- Re-run `verify_calcs.js` (a standalone Node harness that extracts named
  functions verbatim from the compiled worker script and exercises them
  against known inputs/outputs) - this is how sheet-worker *logic* gets
  regression-tested at all, given sheet workers can't run outside Roll20's
  own sandbox. The harness reads from a fixed snapshot file that must be
  refreshed from the freshly compiled worker script after every rebuild,
  or it silently tests stale code.
- A Playwright screenshot of a reconstructed static preview page (the
  compiled HTML's `<main>` content plus compiled CSS, pasted into a
  minimal host page) for anything visual - this cannot exercise sheet
  workers or Roll20-injected DOM (like the native repeating-row "+Add"
  control), only confirm markup/CSS renders as expected.

## Roll20 injects some of its own DOM at runtime

Some repeating-section controls (the native "+Add Item"/"Modify" buttons)
are injected by Roll20's own client at runtime and never appear in a
static HTML preview at all - a CSS rule targeting them can be *written*
and *shipped* with confidence it compiles correctly, but its actual
effect can only be confirmed live in Roll20, not in this development
environment. One concrete case: Roll20's native "+Add Item" control
renders its button text differently depending on whether the repeating
section already has rows (wrapped in a `span`/`a` with no rows yet, a
bare text node once rows exist) - a CSS trick that zeroes out the text via
one of those wrapper elements only works for one of the two states; the
container element itself needs the same treatment too, to cover both.
