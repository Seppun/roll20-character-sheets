# NPC interchange format

This is the data format for getting an NPC into the Cohors Cthulhu Roll20
game: hand-write it, have `pdf_to_npc.py` or the `import-npc` Claude Code
skill produce it from a sourcebook PDF, then hand it to
`api-scripts/ccimport.js` (see the main `README.md`'s "Importing NPCs"
section for that last step). The machine-checkable version of everything
below lives in [`schema/npc.schema.json`](./schema/npc.schema.json); this
file is the walkthrough.

A file holds either **one NPC object**, or a **JSON array of several** for a
batch (e.g. every NPC in one sourcebook encounter).

## Minimal example

```json
{
  "name": "Cultist Thug",
  "attributes": {"agility": 8, "brawn": 10, "coordination": 8, "gravitas": 8, "insight": 7, "reason": 7, "will": 9},
  "skills": {
    "fighting": {"ranks": 2, "focuses": ["Melee Weapons"]}
  },
  "weapons": [
    {"name": "Dagger"}
  ]
}
```

`name` and `attributes` (all seven) are the only required fields - everything
else defaults to empty/zero. See `examples/` for fuller NPCs.

## Fields

### Character type (optional, default `"npc"`)

```json
"character_type": "cannon_fodder"
```

Which of the sheet's two NPC modes this is. `"cannon_fodder"` is for
disposable combat extras (ghouls, legionaries, a robber, a cult priest) -
the sheet shows only Name, Vitals, Attributes, Skills, Weapons, Armor and
Talents, hiding Culture/Caste/Wealth, Archetype/Specialization/Background/
Characteristic, Truths & Scars, Languages and Experience (Spellcasting and
Notes stay available either way, for a caster like the cult priest).
`"npc"` (the default when this field is omitted) is a recurring/important
character and gets the full sheet, identical to a PC. Importing never
leaves fields blank just because they're hidden in a mode - fill in
whatever the NPC actually has; the mode only controls what the sheet
*shows*.

### Identity

`archetype`, `culture`, `caste`, `wealth`, `specialization`, `background`,
`characteristic` - all plain free text, matching the PC sheet's own identity
fields (`source/views/_character.pug`). An NPC's archetype rarely matches
the PC sheet's fixed Archetype dropdown exactly (Mystic/Sage/Schemer/
Scoundrel/Scout/Soldier), so this is just text here, not one of those six
values.

### Attributes (required)

```json
"attributes": {"agility": 8, "brawn": 10, "coordination": 8, "gravitas": 8, "insight": 7, "reason": 7, "will": 9}
```

All seven ratings, rulebook scale (typically 6-16). Required even for a
Minion that will only ever use one or two of them - this sheet's own derived
fields (Base Armour, Total Armor, Courage, Max Stress) are computed from
attributes/skills/armor during import, the same way the PC sheet's own
`calcBaseArmour`/`calcCourage`/`calcTotalArmor`/`calcStressMaxBase`/
`calcStressMax` do (`source/views/panels/_vitals_panel.pug`) - you never set
those directly.

### Skills (optional)

```json
"skills": {
  "fighting": {"ranks": 2, "focuses": ["Melee Weapons"]},
  "observation": {"ranks": 1}
}
```

Only list skills this NPC actually has ranks in. Keys must be one of this
game's twelve skills (`academia`, `athletics`, `crafting`, `engineering`,
`fighting`, `medicine`, `observation`, `persuasion`, `resilience`,
`stealth`, `survival`, `tactics`). `focuses` names must match that skill's
own Focus list exactly - see the table in `source/views/panels/
_skills_panel.pug`, reproduced here:

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

### Talents (optional)

```json
"talents": [
  {"name": "Unyielding"},
  {"name": "Carapace of Chitin", "description": "Once per scene, halve damage from a single hit."}
]
```

A `{name}` with no `description` is resolved against this game's talent list
(`source/data/talents.json`, ~159 entries) exactly like picking it from the
dropdown on a PC sheet - Keywords/Requirements/Description all fill in
automatically. Include `description` yourself for an NPC-only ability
that isn't in that list (common for Nemesis-tier antagonists with a unique
signature power).

### Weapons / Armor (optional)

```json
"weapons": [{"name": "Dagger"}, {"name": "Rusted Cleaver", "damage_effects": "3, Vicious"}],
"armor": [{"name": "Leather Armor"}]
```

A `name` matching this sheet's own Weapons/Armor Name fields
(`source/views/panels/_weapons_panel.pug`, `_armor_panel.pug` - a free-text
field with a known-names suggestion list, not a fixed dropdown) auto-fills
the rest of that row, same as picking it from the suggestion list on a PC
sheet - override any field alongside `name` for a house-ruled variant. Any
other `name` (Claws, Horns, Improvised Club) is just a label on a fully
custom weapon or armor - fill in every other field by hand. This is the
normal way to give an NPC an innate attack or natural armor that isn't
really a named "weapon" from the rulebook list (see `deep_one_hybrid.json`'s
claws and natural hide for an example of both). Known names:

- **Weapons (melee)**: Axe (Melee), Club, Cudgel, Dagger, Dolabra,
  Javelin (Melee), Spear, Staff, Sword, Sword (Falx), Sword (Gladius),
  Sword (Long), Sword (Long, Spatha), Unarmed Strike, War Axe,
  Small Shield, Large Shield
- **Weapons (ranged)**: Arcuballista, Axe (Thrown), Bow, Bow (Recurve),
  Javelin (Thrown), Pilum, Plumbata, Sling
- **Armor**: Chainmail / Lorica Hamata, Leather Armor, Lorica Segmentata,
  Lorica Squamata

### Fatigue / Stress (optional, default 0)

`fatigue` and `stress` let an NPC start partway hurt (e.g. a survivor found
mid-encounter). Max Stress is always computed, never set directly.

### Free text (optional)

`injuries`, `traits`, `notes` - plain text, mapped straight onto the
matching fields on the sheet.

## What's deliberately not here yet

No `tier` (Minion/Toughened/Nemesis) field - that's a GM-facing difficulty
label from the rulebook, not something the sheet renders differently
(unlike `character_type`, which does change what the sheet shows). Put it
in `notes` if it's worth recording, as the examples here do.
