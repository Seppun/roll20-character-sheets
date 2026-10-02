# NPC extraction instructions

Shared between `.claude/skills/import-npc/SKILL.md` (Claude Code) and
`pdf_to_npc.py` (standalone script) - edit this file, not either caller, when
the extraction approach needs to change.

You are extracting NPC stat blocks and surrounding descriptive text from a
Cohors Cthulhu sourcebook PDF into this game's NPC interchange JSON format
(`npc-import/schema/npc.schema.json`, reproduced in full below). Each output
object is a draft for a human to review before it goes anywhere near Roll20 -
not a black box, so favor leaving a field out over guessing a value the
source doesn't support.

## Reference: this game's controlled vocabularies

**Skills and their Focuses** (skill keys are exactly these twelve names;
Focus spellings must match exactly):

| Skill | Focuses |
| --- | --- |
| academia | Finance, History, Linguistics, Philosophy, Religion |
| athletics | Climbing, Lifting, Physical Training, Running, Swimming |
| crafting | Armorsmithing, Cooking, Tailoring, Weaponsmithing |
| engineering | Architecture, Defenses, Demolition, Infrastructure, Siege Engines |
| fighting | Archery, Melee Weapons, Thrown Weapons, Unarmed, War Magic |
| medicine | Contagion, Faith Healing, Field Treatment, Pharmacia, Surgery |
| observation | Hearing, Instincts, Sight, Smell and Taste |
| persuasion | Charm, Deception, Innuendo, Intimidation, Invocation, Negotiation, Rhetoric |
| resilience | Discipline, Fortitude, Immunity |
| stealth | Concealment, Disguise, Escape Artistry, Lock Picking, Sleight of Hand, Sneak |
| survival | Animal Handling, Boating, Foraging, Hunting, Mysticism, Navigation, Tracking, Woodcraft |
| tactics | Cavalry, Infantry, Leadership, Navy, Omen Reading, Scouting |

**Known Weapons**: Axe (Melee), Club, Cudgel, Dagger, Dolabra,
Javelin (Melee), Spear, Staff, Sword, Sword (Falx), Sword (Gladius),
Sword (Long), Sword (Long, Spatha), Unarmed Strike, War Axe, Small Shield,
Large Shield, Arcuballista, Axe (Thrown), Bow, Bow (Recurve),
Javelin (Thrown), Pilum, Plumbata, Sling.

**Known Armor**: Chainmail / Lorica Hamata, Leather Armor, Lorica
Segmentata, Lorica Squamata.

**Talents**: ~159 entries in `source/data/talents.json` in this repo - check
a named ability against that file before treating it as custom.

## Extraction rules

1. **Attributes and Skills**: map ratings/ranks directly. If a source Focus
   name is a close-but-not-exact match to the table above (spelling,
   synonym), use this game's exact spelling and note the substitution in
   your final summary.
2. **Talents**: a named ability found in `source/data/talents.json` becomes
   `{"name": "..."}` alone (resolved like a PC sheet dropdown pick, with
   Keywords/Requirements/Description filled in automatically on import).
   An ability not in that list becomes `{"name", "description"}` written
   verbatim from the source - don't invent mechanics the text doesn't state.
3. **Weapons/Armor**: use a known name from the lists above when the
   source's item is clearly the same thing (a "gladius" is `Sword,
   Gladius`); otherwise just write the item's own name (Claws, Horns,
   Chitin Plating) plus every other field filled by hand - the sheet's Name
   field takes any free text, it isn't limited to the lists above. This is
   the normal way to represent a natural attack or innate armor.
4. **Don't pad a sparse stat block.** A Minion-tier NPC with three
   mechanical lines should produce a sparse JSON object, not one with
   invented Talents or Focuses to look more complete. Omit optional fields
   rather than guessing.
5. **Carry flavor text forward.** The descriptive paragraph around a stat
   block (not just the numbers) is often more useful at the table than the
   raw mechanics - put it in `traits`/`notes`.
6. **Set `character_type`.** `"cannon_fodder"` for a disposable combat extra
   (a Minion-tier mook meant to die in groups - a cultist thug, a ghoul, a
   robber); `"npc"` for a recurring or important character (a named
   antagonist, a Nemesis-tier threat, anyone the GM plays across multiple
   scenes). When genuinely unsure, prefer `"npc"` (the schema's own
   default) - it only means "show the full sheet," never a
   mechanical difference. Mentioning Minion/Toughened/Nemesis from the
   source stays in `notes` either way (see the next rule) - `character_type`
   is about sheet layout, not that tier scale.
7. **No `tier` field.** This format deliberately has no Minion/Toughened/
   Nemesis field - that's a GM-facing difficulty label, not something the
   sheet renders differently. If the source names a tier, mention it as
   plain text in `notes` instead of inventing a structured field for it.
8. **Every object must validate against the schema below** before you
   consider it done - required fields are `name` and all seven
   `attributes`; everything else is optional. Re-read a field's
   description in the schema if its shape is unclear (e.g. `skills` nests
   `ranks`/`focuses` per skill name; `weapons`/`armor` are arrays of
   objects, not objects themselves).

## Full schema

The complete, authoritative schema lives at
`npc-import/schema/npc.schema.json` in this repo - read it directly rather
than relying on a copy pasted here going stale. `npc-import/FORMAT.md` is
the human-readable walkthrough of the same thing, with worked examples in
`npc-import/examples/`.
