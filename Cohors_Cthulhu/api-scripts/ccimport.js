// api-scripts/ccimport.js
// Cohors Cthulhu - NPC Import
//
// Builds a full Roll20 Character for an NPC from JSON in this game's
// interchange format (see npc-import/FORMAT.md and npc-import/schema/
// npc.schema.json in this repo), so a GM doesn't have to hand-type every
// stat block. The JSON itself is produced by hand, by npc-import/
// pdf_to_npc.py, or by the .claude/skills/import-npc Claude Code skill -
// this script only cares that it matches the schema, not where it came
// from.
//
// WORKFLOW: paste one NPC object (or a JSON array of several) into a
// Handout's GM Notes, then in chat run:
//   !ccimport handout|<Handout Name>
// Matches the chat-command shape of the community precedent this design is
// based on (a JSON-to-character-sheet importer for a different game) for
// familiarity. A result card (whispered to whoever ran the command) lists
// every NPC created and any field that needed a judgment call.
//
// INSTALL: a separate piece from the character sheet's own Layout/Style/
// Script boxes, and independent of ccmomentum.js/ccthreat.js (it can run
// with neither, either, or both installed). Game Settings > API Scripts >
// New Script, paste this whole file in, Save Script. Requires a Pro-tier
// game with the API sandbox enabled.
//
// WHY THIS SCRIPT COMPUTES DERIVED FIELDS ITSELF (base_armour, total_armor,
// courage, stress_max_base, stress_max): this sheet's own sheet-worker
// calculations (calcBaseArmour/calcCourage/calcTotalArmor/
// calcStressMaxBase/calcStressMax - see source/views/panels/
// _vitals_panel.pug) run as `on('change:<attr>', ...)` listeners, which
// Roll20 only fires for a REAL change to an EXISTING attribute - never for
// `createObj('attribute', ...)`, which has no "previous value" to change
// from. This script's own copy is still the right thing to compute at
// import time (nothing else will, before the sheet is ever opened), but
// the sheet itself now reconciles it: views/_global_sheetworker.pug
// registers ccRecomputeOnOpen as a k-scaffold "opener" (runs
// unconditionally on every sheet open, including the first time a GM opens
// a freshly-imported NPC), which recalculates these same fields for real
// and also backfills a by-name Talent's Keywords/Requirements/Description
// (see that function's own comment for the full mechanism). The copy here
// is a same-sandbox best-effort stand-in until that happens, not the only
// place these get computed - if those formulas ever change, update both
// places.
//
// Talents referenced by name only (no `description` in the JSON) get just
// their Name field filled in here - Keywords/Requirements/Description
// populate automatically the next time the sheet is opened (via
// ccRecomputeOnOpen above), no manual step needed. Give `description`
// directly in the JSON instead for an NPC-only ability not in that list.
//
// Archetype is free text here (see FORMAT.md) but the PC sheet's own
// Archetype field is a fixed <select> - a value that isn't one of its six
// options still stores and roll-macros correctly, it just won't visually
// highlight any option when the sheet is opened.
//
// GM Notes come back from Roll20 as rich-text HTML (the handout editor
// wraps pasted text in <p> tags, and may entity-escape quotes/ampersands) -
// stripHtmlNotes below undoes that before JSON.parse, the same kind of
// defensive parsing ccmomentum.js/ccthreat.js already do for chat content.
on('ready', () => {
  'use strict';

  const ccAttributeNames = ['agility', 'brawn', 'coordination', 'gravitas', 'insight', 'reason', 'will'];
  const ccBonusDamageAttributes = ['brawn', 'insight', 'will'];
  const ccSkillNames = [
    'academia', 'athletics', 'crafting', 'engineering', 'fighting', 'medicine',
    'observation', 'persuasion', 'resilience', 'stealth', 'survival', 'tactics',
  ];

  // Duplicated from ccWeaponProfiles/ccArmorProfiles (source/views/panels/
  // _weapons_panel.pug, _armor_panel.pug) so a known weapon/armor name
  // auto-fills the rest of its row here too, same as picking it from the
  // dropdown on a PC sheet - small enough (a few dozen short entries) to
  // keep in sync by hand, unlike the ~159-entry Talents list (see this
  // file's top comment for why that one stays a documented limitation
  // instead). Keep these in sync if the sheet's own tables change.
  const ccWeaponProfiles = {
    'Axe (Melee)': {focus: 'Melee Weapons', reach_range: '2', damage_effects: '3, Vicious', size: 'Minor', qualities: 'Special'},
    'Club': {focus: 'Melee Weapons', reach_range: '2', damage_effects: '2', size: 'Minor', qualities: ''},
    'Cudgel': {focus: 'Melee Weapons', reach_range: '2', damage_effects: '3, Stun', size: 'Major', qualities: ''},
    'Dagger': {focus: 'Melee Weapons', reach_range: '1', damage_effects: '2, Piercing 1', size: 'Minor', qualities: 'Hidden, Subtle'},
    'Dolabra': {focus: 'Melee Weapons', reach_range: '1', damage_effects: '3, Piercing 1', size: 'Minor', qualities: ''},
    'Javelin (Melee)': {focus: 'Melee Weapons', reach_range: '2', damage_effects: '3, Piercing 1', size: 'Minor', qualities: 'Special'},
    'Spear': {focus: 'Melee Weapons', reach_range: '3', damage_effects: '4, Piercing 1', size: 'Major', qualities: ''},
    'Staff': {focus: 'Melee Weapons', reach_range: '3', damage_effects: '2', size: 'Major', qualities: 'Special'},
    'Sword': {focus: 'Melee Weapons', reach_range: '2', damage_effects: '4', size: 'Major', qualities: 'Parrying'},
    'Sword, Falx': {focus: 'Melee Weapons', reach_range: '2', damage_effects: '4, Vicious', size: 'Major', qualities: ''},
    'Sword, Gladius': {focus: 'Melee Weapons', reach_range: '2', damage_effects: '4, Piercing 1', size: 'Major', qualities: 'Parrying'},
    'Sword, Long': {focus: 'Melee Weapons', reach_range: '2', damage_effects: '5', size: 'Major', qualities: 'Two-Handed'},
    'Sword, Long, Spatha': {focus: 'Melee Weapons', reach_range: '2', damage_effects: '5, Piercing 1', size: 'Major', qualities: 'Two-Handed'},
    'Unarmed Strike': {focus: 'Unarmed', reach_range: '0', damage_effects: '2', size: '', qualities: 'Subtle'},
    'War Axe': {focus: 'Melee Weapons', reach_range: '2', damage_effects: '4, Vicious', size: 'Major', qualities: 'Two-Handed'},
    'Small Shield': {focus: 'Melee Weapons', reach_range: '1', damage_effects: '2, Stun', size: 'Minor', qualities: 'Shield 2'},
    'Large Shield': {focus: 'Melee Weapons', reach_range: '1', damage_effects: '3, Stun', size: 'Major', qualities: 'Shield 3'},
    'Arcuballista': {focus: 'Archery', reach_range: 'Medium', damage_effects: '4, Piercing 1', size: 'Major', qualities: 'Accurate, Reload'},
    'Axe (Thrown)': {focus: 'Thrown Weapons', reach_range: 'Close', damage_effects: '3, Vicious', size: 'Minor', qualities: 'Special'},
    'Bow': {focus: 'Archery', reach_range: 'Medium', damage_effects: '3, Piercing 1', size: 'Major', qualities: 'Subtle'},
    'Bow, Recurve': {focus: 'Archery', reach_range: 'Long', damage_effects: '4, Piercing 1', size: 'Major', qualities: 'Subtle'},
    'Javelin (Thrown)': {focus: 'Thrown Weapons', reach_range: 'Medium', damage_effects: '3, Piercing 1', size: 'Minor', qualities: 'Special'},
    'Pilum': {focus: 'Thrown Weapons', reach_range: 'Close', damage_effects: '4, Piercing 1', size: 'Minor', qualities: 'Special'},
    'Plumbata': {focus: 'Thrown Weapons', reach_range: 'Close', damage_effects: '2, Piercing 1', size: 'Minor', qualities: ''},
    'Sling': {focus: 'Thrown Weapons', reach_range: 'Long', damage_effects: '3, Stun', size: 'Minor', qualities: 'Inaccurate, Subtle, Special'},
  };
  const ccArmorProfiles = {
    'Chainmail / Lorica Hamata': {resistance: '2', qualities: 'Uncomfortable'},
    'Leather Armor': {resistance: '1', qualities: ''},
    'Lorica Segmentata': {resistance: '3', qualities: 'Uncomfortable'},
    'Lorica Squamata': {resistance: '3', qualities: 'Heavy, Uncomfortable'},
  };

  // Mirrors ccAttributeBonus in views/_global_sheetworker.pug exactly
  // (rulebook table: <=8 -> 0, 9 -> +1, 10-11 -> +2, 12-13 -> +3, 14-15 ->
  // +4, 16+ -> +5) - duplicated here for the reason in this file's own top
  // comment.
  const ccAttributeBonus = (rating) => {
    const r = Number(rating) || 0;
    return r <= 8 ? 0 : Math.min(5, Math.ceil((r - 7) / 2));
  };

  // Mirrors the slug ccApplyTalentPreset's sibling _focus.pug component
  // produces for a Focus checkbox's own attribute name (lowercase, runs of
  // non-alphanumerics collapsed to one separator) - must match exactly or
  // ccTrackBoxClick-style lookups on the sheet won't find the right
  // attribute.
  const focusSlug = (focusName) => String(focusName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/ /g, '_');

  const setAttr = (characterId, name, value) => {
    if (value === undefined || value === null || value === '') { return; }
    createObj('attribute', {characterid: characterId, name, current: String(value)});
  };

  const createRepeatingRow = (characterId, section, fields) => {
    const rowId = generateRowID();
    Object.keys(fields).forEach((field) => {
      setAttr(characterId, `repeating_${section}_${rowId}_${field}`, fields[field]);
    });
  };

  // Builds one Roll20 Character from one NPC object. Returns {name,
  // warnings} - warnings are judgment calls or skipped data the GM should
  // review, never thrown as errors (a partially-imported NPC is more useful
  // than none at all).
  const importNpc = (npc) => {
    const warnings = [];
    if (!npc || typeof npc !== 'object' || Array.isArray(npc)) {
      return {name: '(invalid entry)', warnings: ['not a JSON object - skipped entirely']};
    }
    if (!npc.name) {
      return {name: '(unnamed)', warnings: ['missing "name" - skipped entirely']};
    }
    if (!npc.attributes || typeof npc.attributes !== 'object') {
      return {name: npc.name, warnings: ['missing "attributes" - skipped entirely']};
    }

    const character = createObj('character', {name: npc.name});
    const id = character.id;

    // Matches the value the compiled sheet's own +hidden('sheet version')
    // field sets for a character created through the Roll20 UI.
    setAttr(id, 'sheet_version', '0.1.0');

    ['archetype', 'culture', 'caste', 'wealth', 'specialization', 'background', 'characteristic', 'injuries', 'traits'].forEach((field) => {
      setAttr(id, field, npc[field]);
    });
    setAttr(id, 'journal_notes', npc.notes);

    ccAttributeNames.forEach((attr) => {
      if (npc.attributes[attr] === undefined) {
        warnings.push(`attributes.${attr} missing - defaulted to 0`);
      }
      setAttr(id, `${attr}_rating`, Number(npc.attributes[attr]) || 0);
    });
    ccBonusDamageAttributes.forEach((attr) => {
      setAttr(id, `${attr}_bonus_damage`, ccAttributeBonus(npc.attributes[attr]));
    });

    const skills = (npc.skills && typeof npc.skills === 'object') ? npc.skills : {};
    Object.keys(skills).forEach((skill) => {
      if (!ccSkillNames.includes(skill)) {
        warnings.push(`unknown skill "${skill}" - skipped`);
        return;
      }
      const data = skills[skill] || {};
      setAttr(id, `${skill}_ranks`, Number(data.ranks) || 0);
      (data.focuses || []).forEach((focus) => {
        setAttr(id, `${skill}_focus_${focusSlug(focus)}_known`, 1);
      });
    });

    const talents = Array.isArray(npc.talents) ? npc.talents : [];
    talents.forEach((talent) => {
      if (!talent || !talent.name) {
        warnings.push('a talent entry is missing "name" - skipped');
        return;
      }
      const fields = {name: talent.name};
      if (talent.description) {
        fields.description = talent.description;
      }
      // If description is omitted, Keywords/Requirements/Description
      // auto-fill the next time this character's sheet is opened (see
      // ccRecomputeOnOpen in views/_global_sheetworker.pug) - no warning
      // needed, this is the normal path for a known talent name.
      createRepeatingRow(id, 'talent', fields);
    });

    // A known name's profile fields are defaults, not overrides - any field
    // the JSON itself specifies (even for a known name) wins, same
    // "override any field alongside name" rule as FORMAT.md documents.
    (Array.isArray(npc.weapons) ? npc.weapons : []).forEach((weapon) => {
      const resolved = Object.assign({}, ccWeaponProfiles[weapon.name] || {}, weapon);
      createRepeatingRow(id, 'weapon', {
        name: resolved.name,
        focus: resolved.focus,
        reach_range: resolved.reach_range,
        damage_effects: resolved.damage_effects,
        size: resolved.size,
        qualities: resolved.qualities,
      });
    });

    let totalResistance = 0;
    (Array.isArray(npc.armor) ? npc.armor : []).forEach((armor) => {
      const resolved = Object.assign({}, ccArmorProfiles[armor.name] || {}, armor);
      createRepeatingRow(id, 'armor', {
        name: resolved.name,
        resistance: resolved.resistance,
        qualities: resolved.qualities,
      });
      totalResistance += Number(resolved.resistance) || 0;
    });

    // Derived fields - see this file's top comment for why these are
    // computed here rather than left for the sheet to recalculate.
    const brawn = Number(npc.attributes.brawn) || 0;
    const will = Number(npc.attributes.will) || 0;
    const baseArmour = ccAttributeBonus(brawn);
    setAttr(id, 'base_armour', baseArmour);
    setAttr(id, 'total_armor', baseArmour + totalResistance);
    setAttr(id, 'courage', ccAttributeBonus(will));

    const resilienceRanks = Number((skills.resilience || {}).ranks) || 0;
    const hasUnyielding = talents.some((t) => t && String(t.name || '').trim().toLowerCase() === 'unyielding');
    const stressMaxBase = Math.max(brawn, will) + resilienceRanks + (hasUnyielding ? 3 : 0);
    setAttr(id, 'stress_max_base', stressMaxBase);

    const fatigue = Number(npc.fatigue) || 0;
    setAttr(id, 'fatigue', fatigue);
    setAttr(id, 'stress_max', Math.max(0, stressMaxBase - fatigue));
    setAttr(id, 'stress', Number(npc.stress) || 0);

    return {name: npc.name, warnings};
  };

  // Handout GM Notes/Notes fields come back as rich-text HTML, not plain
  // text - a pasted JSON blob typically survives as literal characters, but
  // the editor still wraps lines in <p>/<br> and may entity-escape quotes.
  const stripHtmlNotes = (raw) => String(raw || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

  const announceResults = (who, results) => {
    const lines = results.map((r) => {
      const warn = r.warnings.length ? ` (${r.warnings.join('; ')})` : '';
      return `${r.name}${warn}`;
    });
    sendChat('CCImport', `/w "${who}" &{template:default} {{name=NPC Import}} {{Imported ${results.length}=${lines.join(' | ')}}}`);
  };

  const runImport = (who, rawNotes) => {
    const cleaned = stripHtmlNotes(rawNotes);
    if (!cleaned) {
      sendChat('CCImport', `/w "${who}" That handout's GM Notes are empty.`);
      return;
    }
    let data;
    try {
      data = JSON.parse(cleaned);
    } catch (err) {
      sendChat('CCImport', `/w "${who}" Could not parse JSON from GM Notes: ${err.message}`);
      return;
    }
    const npcs = Array.isArray(data) ? data : [data];
    if (!npcs.length) {
      sendChat('CCImport', `/w "${who}" No NPCs found in that JSON.`);
      return;
    }
    announceResults(who, npcs.map(importNpc));
  };

  const usage = (who) => {
    sendChat('CCImport', `/w "${who}" Usage: !ccimport handout|<Handout Name> - paste one NPC object or a JSON array of several into that handout's GM Notes first. See npc-import/FORMAT.md for the data format.`);
  };

  // Same diagnostic logging convention as ccmomentum.js/ccthreat.js - kept
  // in deliberately, not a temporary scaffold.
  const handleMessage = (msg) => {
    const content = String(msg.content || '').trim();
    if (!content.startsWith('!ccimport')) { return; }
    log(`[CCImport] chat:message content=${JSON.stringify(msg.content)}`);

    const rest = content.slice('!ccimport'.length).trim();
    if (!rest) { usage(msg.who); return; }

    const [sourceType, ...identifierParts] = rest.split('|');
    const identifier = identifierParts.join('|').trim();
    if (sourceType.trim() !== 'handout' || !identifier) {
      usage(msg.who);
      return;
    }

    const handout = findObjs({_type: 'handout', name: identifier})[0];
    if (!handout) {
      sendChat('CCImport', `/w "${msg.who}" No handout named "${identifier}" found.`);
      return;
    }
    // handout.get('gmnotes', callback) is asynchronous (unlike most other
    // Roll20 API object properties, which return synchronously from a
    // plain .get('propname')) - it has to be called with a callback.
    handout.get('gmnotes', (gmnotes) => runImport(msg.who, gmnotes));
  };

  on('chat:message', handleMessage);

  log('Cohors Cthulhu NPC Import ready.');
});
