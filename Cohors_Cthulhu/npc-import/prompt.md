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

**Mythos spellbooks** (NPC-only; `spellcasting.tradition` value in
brackets): Tome of Cthulhu [`cthulhu`], Compendium of Mormo [`mormo`],
Grimoire of Nyarlathotep [`nyarlathotep`], Spellbook of Yog-Sothoth
[`yog_sothoth`]. Spell names must match `source/data/spells.json` exactly.

**Common NPC special rules**: Brutal, Extraordinary [Attribute], Fast
Recovery, Fearsome, Feeds Upon Fear, Flight, Grasping, Immune to,
Incorporeal, Invulnerable, Keen Senses, Menacing, Mindless, Natural Armor,
Natural Courage, Night Vision, Scale, Spellcaster, Threatening, Tough.

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
4. **Don't pad a sparse stat block.** A Trooper NPC with three
   mechanical lines should produce a sparse JSON object, not one with
   invented Talents or Focuses to look more complete. Omit optional fields
   rather than guessing.
5. **Carry flavor text forward.** The descriptive paragraph around a stat
   block (not just the numbers) is often more useful at the table than the
   raw mechanics - put it in `traits`/`notes`.
6. **Set `npc_type` from the profile.** The line under the NPC's name
   reads TROOPER NPC, TOUGHENED NPC or NEMESIS NPC: use `"trooper"`,
   `"toughened"` or `"nemesis"`. Leave `allegiance` out (adversary) unless
   the text says the NPC is an ally.
7. **Copy the printed totals and damage, don't recompute them.** STRESS,
   INJURIES, ARMOR, COURAGE and Power go in `profile` exactly as printed;
   they already include special-rule bonuses. Attack damage goes in
   `damage_effects` exactly as printed, too. Mark (Mental Attack) entries
   `"type": "mental"`. An attribute printed as "—" is `null`; an
   Extraordinary bonus printed as "Brawn 13(2)" means `"brawn": 13` plus an
   `Extraordinary Brawn 2` special rule. ESCALATION OPTIONS go in
   `escalation_options`, not `weapons`.
8. **Special rules, spells, rituals.** List every SPECIAL RULES entry by its
   printed name. Omit `description` for a common rule (above) unless the
   profile adds something specific; write the profile's wording for any
   other rule. For casters, set `spellcasting.attribute` from "uses X to
   cast spells", `spellcasting.tradition` from the spellbook named, list
   the spells in `spells` and any rituals in `rituals`.
9. **Beware jumbled columns.** PDF text from two-column pages often
   interleaves: an attack's damage effects can appear several lines after
   its name, and attribute blocks from two neighbouring profiles can land
   next to each other. Match values by the profile's own structure (every
   NPC has exactly seven attributes and one STRESS/INJURIES/ARMOR/COURAGE
   line). If you can't attribute a value confidently, leave it out and say
   so in your summary.
10. **Every object must validate against the schema below** before you
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
