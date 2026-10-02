---
name: import-npc
description: Extract NPC stat blocks and descriptions from a Cohors Cthulhu sourcebook PDF into this game's NPC interchange JSON format, ready for import into Roll20. Use when the user gives a PDF (or page range within one) and asks to pull out an NPC, a monster, a cast of antagonists, or a stat block, for use with this character sheet.
---

Turn stat blocks and surrounding descriptive text from a PDF into NPC JSON
files matching `npc-import/schema/npc.schema.json`. The extraction rules,
controlled vocabularies, and schema reference are shared with the
standalone `pdf_to_npc.py` script and live in one place:
**`npc-import/prompt.md`** - read that file in full before extracting
anything. Do not duplicate its rules here; if they need to change, edit
`prompt.md` (it serves both this skill and the script).

## Inputs

The user will give you a PDF path and usually a page range or a specific
NPC/monster name to find. If they only gave a name with no page range,
skim the PDF's table of contents or index first (Read a handful of early/
late pages) rather than guessing blindly through the whole document.

## Steps

1. Read `npc-import/prompt.md`, `npc-import/schema/npc.schema.json`, and
   1-2 files in `npc-import/examples/` for the rules, schema, and expected
   level of detail.
2. Read the target PDF pages with the Read tool's native PDF support
   (`pages` parameter, max 20 pages per call - split a longer range across
   multiple calls). Read any page a stat block visually continues onto,
   even if the user's requested range cuts it off early.
3. Extract every stat block found in range into the JSON shape, following
   `prompt.md`'s rules exactly (controlled skill/focus/weapon/armor
   vocabularies, talent resolution, sparse-is-fine, no `tier` field).
4. **Validate before writing anything.** Run this schema check against
   each extracted object before saving it:

   ```bash
   python3 -c "
   import json, jsonschema, sys
   with open('npc-import/schema/npc.schema.json') as f:
       schema = json.load(f)
   with open(sys.argv[1]) as f:
       jsonschema.validate(json.load(f), schema)
   print('OK', sys.argv[1])
   " <path-to-extracted-json>
   ```

   If `jsonschema` isn't installed, `pip install jsonschema` once first. Fix
   any validation failure yourself (usually a skill/focus name typo or a
   stray field) and re-check - don't hand the user an object you haven't
   confirmed validates.
5. Write one `<slug>.json` per NPC (slug = lowercase name, spaces to
   underscores) to the output location the user asked for, or
   `npc-import/output/` by default. Finish with a short summary per NPC:
   what was extracted cleanly, and anything you had to judge-call (a fuzzy
   Focus match, an ability written as custom because it didn't match a
   known Talent, a stat the source left ambiguous).

## Don't

- Don't try to import the result into Roll20 yourself - this skill's job
  ends at a validated JSON file. Importing is `api-scripts/ccimport.js`,
  covered in the main `README.md`.
