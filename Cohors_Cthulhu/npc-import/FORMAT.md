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

### NPC type and allegiance (optional)

```json
"npc_type": "toughened",
"allegiance": "adversary"
```

`npc_type` is the profile's type from the GM's Guide, the line under its
name: `"trooper"`, `"toughened"` or `"nemesis"` (default `"toughened"`).
Trooper and Toughened NPCs get the sheet's compact combat layout; Nemesis
NPCs get the full sheet. The type also sets the fallback Max Stress
(Troopers halve it) and injury limit (1/2/3) when `profile` doesn't print
them. Older files with `character_type` `"cannon_fodder"`/`"npc"` still
import, as Trooper/Nemesis.

`allegiance` is `"adversary"` (default: buys d20s with Threat, extra
successes become Threat) or `"ally"` (uses the party's Momentum like a PC).
It can be switched on the sheet at any time.

### Truths (optional)

```json
"truths": ["Deep One Priest of the Elder Gods", "Amphibious"]
```

The profile's TRUTHS, one per entry (up to five).

### Profile totals (optional)

```json
"profile": {"stress": 16, "injuries": 3, "armor": 3, "courage": 6, "power": 5}
```

The stat block's printed STRESS, INJURIES, ARMOR, COURAGE and Power (plus
`morale` if given). These already include every special rule's bonus
(Tough, Natural Armor, Extraordinary Brawn...), so they are written to the
sheet as-is and win over its own formulas. Omit any the profile doesn't
print and the tier formula applies instead. Not to be confused with the
top-level `stress` (stress already marked) and `injuries` (injuries
already sustained).

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
Trooper that will only ever use one or two of them - this sheet's own derived
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

### Attacks and mental attacks

Every entry in `weapons` can carry `"type"`: `"melee"`, `"ranged"` or
`"mental"`. Use `"mental"` for the profile's (Mental Attack) entries:

```json
{"name": "Horrific Presence", "type": "mental", "reach_range": "Medium", "damage_effects": "7, Piercing 2, Stun"}
```

For NPCs, copy the printed damage exactly. It already includes the
attribute's bonus damage, Brutal and Fearsome, so the sheet adds nothing on
top (a PC's weapon row adds bonus damage; an NPC's doesn't). Mental attacks
roll Will + Persuasion or Survival at difficulty 1.

### Special rules (optional)

```json
"special_rules": [
  {"name": "Fearsome 2"},
  {"name": "Dark Preacher", "description": "When making a mental attack, may spend 3 Threat to add the Area and Drain effects."}
]
```

Name each rule as printed. The GM's Guide's common rules (Brutal, Fearsome,
Tough, Extraordinary [Attribute], Natural Armor, Immune to, Night
Vision...) fill in a summary on first sheet open if `description` is
omitted; give the profile's wording for anything specific to this NPC. `x`
is optional when the name ends with the number. On the sheet,
Extraordinary [Attribute] X adds X automatic successes to rolls with that
attribute, and Brutal makes melee attacks roll Brawn; every other rule is
reference text, because its effect is already in the printed totals.

### Spells, rituals and escalation options (optional)

```json
"spellcasting": {"attribute": "will", "tradition": "cthulhu"},
"spells": ["Call of the Deep", "Curse of Cthulhu"],
"rituals": ["Commune with Deity"],
"escalation_options": ["Totemic Staff: (Melee), Reach 2, 5, Drain, Stun"]
```

`spellcasting.attribute` is the profile's "uses Will to cast spells"
(insight, reason or will): base Power 2 plus that attribute's bonus, unless
`profile.power` prints a total. `tradition` is the spellbook the `spells`
come from: `runic`, `oracular`, `celtic`, or the NPC-only Mythos tomes
`cthulhu`, `mormo`, `nyarlathotep` and `yog_sothoth`. Spell names must
match `source/data/spells.json`; their details fill in on first sheet open.
Rituals aren't battlefield spells, so they're recorded in the NPC's notes.
Escalation options go into the NPC Profile panel, one per line. An
escalation weapon should also be listed in `weapons`, named with
" (Escalation)" (e.g. `"Totemic Staff (Escalation)"`), so it's a rollable
attack row once the GM pays the Threat for it.

### Fatigue / Stress (optional, default 0)

`fatigue` and `stress` let an NPC start partway hurt (e.g. a survivor found
mid-encounter). Max Stress is always computed, never set directly.

### Free text (optional)

`injuries`, `traits`, `notes` - plain text, mapped straight onto the
matching fields on the sheet.
