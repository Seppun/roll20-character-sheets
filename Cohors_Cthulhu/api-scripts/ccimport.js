// api-scripts/ccimport.js
// Cohors Cthulhu - NPC Import
//
// Creates Roll20 characters from NPC JSON in the format described in npc-
// import/FORMAT.md (schema: npc-import/schema/npc.schema.json).
//
// USAGE: paste one NPC object, or an array of them, into a handout's GM
// Notes, then run:
//   !ccimport handout|<Handout Name>
// A card whispered to the caller lists every NPC created and any warnings.
//
// TOKENS: each NPC gets a default token and avatar when an image with its
// name (or its JSON "token" name) is found: in ModifyTokenImage's Journal
// folders ("Token Images" > <token name> > handouts with the image as
// avatar), as a named token on a page called "Token Library", or as a custom
// token marker. !ccimport tokens lists the names
// found; !ccimport token|<Character Name>[|<Token Name>] sets one for an
// existing character.
//
// INSTALL: Game Settings > API Scripts > New Script, paste this file, Save
// Script. Needs a Pro game. Independent of ccmomentum.js and ccthreat.js.
//
// DEBUG: !ccdebugon / !ccdebugoff (GM only) log each import step to the API
// console, for all Cohors Cthulhu scripts.
//
// Derived fields (base_armour, total_armor, courage, stress_max_base,
// stress_max) are computed here because createObj doesn't fire the sheet's
// change workers. The sheet recomputes them on first open (ccRecomputeOnOpen
// in source/views/_global_sheetworker.pug), which also fills in the
// keywords and requirements of talents and the details of spells given by
// name only. If the formulas change, update both places.
//
// Other scripts can act on each imported character: add a function to
// CCImportHooks and it's called with the new character's id.
//
// Archetype is free text; a value outside the sheet's six options is stored
// but no option shows as selected.
// Functions called with each imported character's id (see the top comment).
var CCImportHooks = CCImportHooks || [];

on('ready', () => {
  'use strict';

  // msg.who for a GM ends in " (GM)", which /w can't resolve; whisper to the
  // bare name.
  const whisperTo = (who) => String(who || '').replace(/\s*\(GM\)\s*$/, '');

  // Debug logging, shared by every Cohors Cthulhu script through
  // state.CCDebug: !ccdebugon / !ccdebugoff (GM only, any case) switch it for
  // all of them, !ccdebug shows the setting. Off by default; errors are always
  // logged.
  const DEBUG_NAME = 'ccimport.js';
  state.CCDebug = state.CCDebug || {on: false};
  const debug = (text) => {
    if (state.CCDebug.on) { log(`[${DEBUG_NAME}] ${text}`); }
  };
  // Every installed script handles the command; the first one schedules a
  // single reply naming them all.
  const handleDebugCommand = (msg) => {
    const match = /^!ccdebug(on|off)?$/i.exec(String(msg.content || '').trim());
    if (!match) { return false; }
    const isGM = playerIsGM(msg.playerid);
    if (isGM && match[1]) { state.CCDebug.on = match[1].toLowerCase() === 'on'; }
    const reply = state.CCDebug.reply;
    if (reply && Date.now() - reply.at < 2000) {
      reply.scripts.push(DEBUG_NAME);
      return true;
    }
    state.CCDebug.reply = {at: Date.now(), scripts: [DEBUG_NAME]};
    setTimeout(() => {
      const scripts = (state.CCDebug.reply || {}).scripts || [DEBUG_NAME];
      state.CCDebug.reply = null;
      const status = state.CCDebug.on ? 'ON' : 'OFF';
      if (isGM) { log(`[Cohors Cthulhu] debug logging ${status} (${scripts.join(', ')})`); }
      const text = isGM ?
        `Cohors Cthulhu debug logging is ${status} for ${scripts.join(', ')}. Output goes to the API console.` :
        'Only the GM can change Cohors Cthulhu debug logging.';
      sendChat('CC Debug', `/w "${String(msg.who || '').replace(/\s*\(GM\)\s*$/, '')}" ${text}`, null, {noarchive: true});
    }, 250);
    return true;
  };

  const ccAttributeNames = ['agility', 'brawn', 'coordination', 'gravitas', 'insight', 'reason', 'will'];
  const ccNpcTiers = ['trooper', 'toughened', 'nemesis'];
  const ccCapitalize = (text) => String(text || '').charAt(0).toUpperCase() + String(text || '').slice(1);
  const ccBonusDamageAttributes = ['brawn', 'insight', 'will'];
  const ccSkillNames = [
    'academia', 'athletics', 'crafting', 'engineering', 'fighting', 'medicine',
    'observation', 'persuasion', 'resilience', 'stealth', 'survival', 'tactics',
  ];

  // Copies of ccWeaponProfiles and ccArmorProfiles
  // (source/views/panels/_weapons_panel.pug, _armor_panel.pug), so known
  // names fill their rows. Keep them in sync.
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
    'Falx': {focus: 'Melee Weapons', reach_range: '2', damage_effects: '4, Vicious', size: 'Major', qualities: ''},
    'Gladius': {focus: 'Melee Weapons', reach_range: '2', damage_effects: '4, Piercing 1', size: 'Major', qualities: 'Parrying'},
    'Longsword': {focus: 'Melee Weapons', reach_range: '2', damage_effects: '5', size: 'Major', qualities: 'Two-Handed'},
    'Spatha': {focus: 'Melee Weapons', reach_range: '2', damage_effects: '5, Piercing 1', size: 'Major', qualities: 'Two-Handed'},
    'Unarmed': {focus: 'Unarmed', reach_range: '0', damage_effects: '2', size: '', qualities: 'Subtle'},
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

  // Copy of ccAttributeBonus (views/_global_sheetworker.pug).
  const ccAttributeBonus = (rating) => {
    const r = Number(rating) || 0;
    return r <= 8 ? 0 : Math.min(5, Math.ceil((r - 7) / 2));
  };

  // Same slug as the sheet's Focus checkbox attribute names (lowercase, non-
  // alphanumeric runs collapsed to '_').
  const focusSlug = (focusName) => String(focusName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/ /g, '_');

  const setAttr = (characterId, name, value) => {
    if (value === undefined || value === null || value === '') { return; }
    createObj('attribute', {characterid: characterId, name, current: String(value)});
  };

  // generateRowID() isn't available in the API sandbox. This is the common
  // community version: a timestamp-ordered 20-character ID in Roll20's row-ID
  // alphabet.
  const generateUUID = (() => {
    const chars = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
    let lastTime = 0;
    const lastRandom = [];
    return () => {
      let now = Date.now();
      const sameTime = now === lastTime;
      lastTime = now;
      const timeChars = new Array(8);
      for (let i = 7; i >= 0; i--) {
        timeChars[i] = chars.charAt(now % 64);
        now = Math.floor(now / 64);
      }
      let id = timeChars.join('');
      if (sameTime) {
        let i = 11;
        for (; i >= 0 && lastRandom[i] === 63; i--) { lastRandom[i] = 0; }
        lastRandom[i] += 1;
      } else {
        for (let i = 0; i < 12; i++) { lastRandom[i] = Math.floor(64 * Math.random()); }
      }
      for (let i = 0; i < 12; i++) { id += chars.charAt(lastRandom[i]); }
      return id;
    };
  })();
  // Underscores become 'Z', which can make two consecutive IDs identical;
  // repeats are redrawn.
  const issuedRowIds = new Set();
  const generateRowID = () => {
    let id = generateUUID().replace(/_/g, 'Z');
    while (issuedRowIds.has(id)) { id = generateUUID().replace(/_/g, 'Z'); }
    issuedRowIds.add(id);
    return id;
  };

  const createRepeatingRow = (characterId, section, fields) => {
    const rowId = generateRowID();
    Object.keys(fields).forEach((field) => {
      setAttr(characterId, `repeating_${section}_${rowId}_${field}`, fields[field]);
    });
  };

  // Builds one character from one NPC object. Returns {name, warnings};
  // problems become warnings, not errors, since a partial import beats none.
  // Token images, found by name. The API can't browse the Art Library, so
  // they come from, in order:
  //   1. ModifyTokenImage's Journal folders: "Token Images" > a folder named
  //      after the token > handouts whose avatar is the image (size: N in a
  //      handout's GM Notes sets its size, as in ModifyTokenImage);
  //   2. named tokens on a page called "Token Library";
  //   3. custom token markers, named after their uploaded files.
  // Names match ignoring case, accents, punctuation, a file extension and a
  // trailing "standard"/"light" variant: "Deep_One_Shaman_light.png" matches
  // "Deep One Shaman" with variant "light".
  const parseTokenName = (name) => {
    const words = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/Æ/g, 'AE').replace(/æ/g, 'ae')
      .replace(/\.(png|jpe?g|webp|gif)$/i, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ');
    const variant = ['standard', 'light'].includes(words[words.length - 1]) && words.length > 1 ? words.pop() : '';
    return {key: words.join(' '), variant};
  };

  // "size: 2" or "width: 2; height: 3" in GM Notes, as ModifyTokenImage
  // reads them (in grid squares).
  const parseSizeNotes = (raw) => {
    const pairs = {};
    String(raw || '').replace(/<[^>]+>/g, ';').split(';').forEach((part) => {
      const [key, value] = part.split(':').map((t) => (t || '').trim().toLowerCase());
      if (key && value && Number(value) > 0) { pairs[key] = Number(value); }
    });
    return pairs.size ? {width: pairs.size, height: pairs.size} :
      (pairs.width || pairs.height ? {width: pairs.width || 1, height: pairs.height || 1} : {});
  };

  const readGmNotes = (handout) => new Promise((resolve) => {
    handout.get('gmnotes', (notes) => {
      let text = notes || '';
      try { text = decodeURIComponent(text); } catch (err) { /* plain text */ }
      resolve(text);
    });
  });

  const journalTokenEntries = async () => {
    let tree = [];
    try {
      tree = JSON.parse(Campaign().get('_journalfolder') || '[]');
    } catch (err) {
      tree = [];
    }
    const root = (Array.isArray(tree) ? tree : []).find((f) => f && typeof f === 'object' && f.n === 'Token Images');
    const folders = root && Array.isArray(root.i) ? root.i.filter((f) => f && typeof f === 'object' && f.n) : [];
    const entries = [];
    for (const folder of folders) {
      const handouts = (Array.isArray(folder.i) ? folder.i : [])
        .filter((id) => typeof id === 'string')
        .map((id) => getObj('handout', id))
        .filter((h) => h && h.get('avatar'));
      for (const handout of handouts) {
        const size = parseSizeNotes(await readGmNotes(handout));
        entries.push(Object.assign({}, parseTokenName(folder.n), {
          variant: parseTokenName(`x ${handout.get('name')}`).variant,
          name: folder.n,
          url: handout.get('avatar'),
          source: `Token Images/${folder.n}/${handout.get('name')}`,
        }, size));
      }
    }
    return entries;
  };

  const loadTokenLibrary = async () => {
    const entries = await journalTokenEntries();
    findObjs({_type: 'page'})
      .filter((page) => /token\s*library/i.test(String(page.get('name') || '')))
      .forEach((page) => {
        findObjs({_type: 'graphic', _pageid: page.id}).forEach((graphic) => {
          if (!graphic.get('name') || !graphic.get('imgsrc')) { return; }
          entries.push(Object.assign(parseTokenName(graphic.get('name')),
            {name: graphic.get('name'), url: graphic.get('imgsrc'), source: `page "${page.get('name')}"`}));
        });
      });
    let markers = [];
    try {
      markers = JSON.parse(Campaign().get('_token_markers') || '[]');
    } catch (err) {
      markers = [];
    }
    (Array.isArray(markers) ? markers : []).forEach((marker) => {
      if (!marker || !marker.name || !marker.url) { return; }
      entries.push(Object.assign(parseTokenName(marker.name), {name: marker.name, url: marker.url, source: 'token marker'}));
    });
    debug(`token library: ${entries.length} images`);
    return entries;
  };

  // The requested variant, else an unsuffixed or "standard" one, else any.
  const findTokenImage = (library, wanted, variant) => {
    const {key} = parseTokenName(wanted);
    const matches = library.filter((entry) => entry.key === key);
    return matches.find((e) => e.variant === variant) || matches.find((e) => !e.variant) ||
      matches.find((e) => e.variant === 'standard') || matches[0] || null;
  };

  // Roll20 only accepts its own uploaded images for tokens, in the 'thumb'
  // size.
  const thumbUrl = (url) => {
    const text = String(url || '');
    const m = text.match(/^(.*\/images\/.*\/)(thumb|med|original|max|icon)(\.[a-z]+)(\?.*)?$/i);
    if (m) { return `${m[1]}thumb${m[3]}${m[4] || `?${Date.now()}`}`; }
    return /files\.d20\.io\/images\//.test(text) ? text : null;
  };

  // Gives a character its default token and avatar. spec is the JSON
  // "token": a name, or {name, variant, image, size}; false skips it.
  // Returns a short description for the import card, or null; problems go
  // into warnings.
  const setupToken = (character, spec, details, warnings, library) => {
    if (spec === false) { return null; }
    const opts = typeof spec === 'string' ? {name: spec} : (spec && typeof spec === 'object' ? spec : {});
    const wanted = opts.name || details.name;
    const found = opts.image ?
      {url: opts.image, name: wanted, source: 'JSON image'} :
      findTokenImage(library, wanted, opts.variant || 'standard');
    if (!found) {
      debug(`token: nothing named "${wanted}"`);
      if (spec) { warnings.push(`no token image named "${wanted}" (see !ccimport tokens)`); }
      return null;
    }
    const imgsrc = thumbUrl(found.url);
    if (!imgsrc) {
      warnings.push(`token "${found.name}" (${found.source}) isn't an image uploaded to Roll20 - token not set`);
      return null;
    }
    const page = Campaign().get('playerpageid') || ((findObjs({_type: 'page'})[0] || {}).id);
    const width = 70 * (Number(opts.size) || found.width || 1);
    const height = 70 * (Number(opts.size) || found.height || 1);
    const hideBars = details.adversary;
    const props = {
      _pageid: page,
      layer: 'gmlayer',
      imgsrc,
      left: width / 2,
      top: height / 2,
      width,
      height,
      name: details.name,
      represents: character.id,
      showname: true,
      bar1_value: details.stress,
      bar1_max: details.stressMax,
      bar2_value: 0,
      bar2_max: details.injuryLimit,
      showplayers_bar1: !hideBars,
      showplayers_bar2: !hideBars,
    };
    // A Nemesis is unique, so its Stress bar is linked to the sheet; Trooper
    // and Toughened tokens keep their own, one per copy on the map.
    if (details.npcType === 'nemesis') {
      const stressAttr = findObjs({_type: 'attribute', _characterid: character.id, name: 'stress'})[0];
      if (stressAttr) {
        stressAttr.set('max', String(details.stressMax));
        props.bar1_link = stressAttr.id;
      }
    }
    const graphic = createObj('graphic', props);
    if (!graphic) {
      warnings.push(`Roll20 refused the image for token "${found.name}" (${found.source}) - token not set`);
      return null;
    }
    setDefaultTokenForCharacter(character, graphic);
    character.set('avatar', imgsrc);
    graphic.remove();
    debug(`token: "${details.name}" uses "${found.name}" (${found.source}), ${width}x${height}px`);
    return `token: ${found.name}`;
  };

  const importNpc = (npc, library) => {
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

    // The value the sheet's hidden 'sheet version' field sets for a new
    // character.
    setAttr(id, 'sheet_version', '0.1.0');

    // NPC tier. Older files used character_type cannon_fodder/npc; mapped as
    // the sheet migrates them.
    const legacyTypes = {cannon_fodder: 'trooper', npc: 'nemesis'};
    let npcType = npc.npc_type || legacyTypes[npc.character_type] || 'toughened';
    if (!ccNpcTiers.includes(npcType)) {
      warnings.push(`unknown npc_type "${npcType}" - defaulted to "toughened"`);
      npcType = 'toughened';
    }
    setAttr(id, 'character_type', npcType);
    // Marks it as an NPC for api-scripts/ccnpclock.js (GM Notes are GM-only)
    // and unlocks Character Type.
    character.set('gmnotes', `NPC: ${ccCapitalize(npcType)}`);
    setAttr(id, 'npc_unlocked', 1);
    setAttr(id, 'spells_type_marker', 'npc');
    setAttr(id, 'npc_allegiance', npc.allegiance === 'ally' ? 'ally' : 'adversary');

    ['archetype', 'culture', 'caste', 'wealth', 'specialization', 'background', 'characteristic', 'injuries', 'traits'].forEach((field) => {
      setAttr(id, field, npc[field]);
    });
    (Array.isArray(npc.truths) ? npc.truths : []).slice(0, 5).forEach((truth, i) => {
      setAttr(id, `truth_${i + 1}`, truth);
    });

    const rituals = Array.isArray(npc.rituals) ? npc.rituals : [];
    const notes = [npc.notes, rituals.length ? `Rituals: ${rituals.join(', ')}` : ''].filter(Boolean).join('\n\n');
    setAttr(id, 'journal_notes', notes);
    setAttr(id, 'npc_escalation', (Array.isArray(npc.escalation_options) ? npc.escalation_options : []).join('\n'));

    // Stat block totals (source/views/panels/_npc_profile_panel.pug).
    const profile = (npc.profile && typeof npc.profile === 'object') ? npc.profile : {};
    const hasBook = (key) => profile[key] !== undefined && profile[key] !== null && profile[key] !== '';
    [['stress', 'npc_stress'], ['injuries', 'npc_injuries'], ['armor', 'npc_armor'], ['courage', 'npc_courage'], ['morale', 'npc_morale'], ['power', 'npc_power']].forEach(([key, attr]) => {
      if (hasBook(key)) { setAttr(id, attr, Number(profile[key])); }
    });

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
      // Keywords and Requirements fill in on first sheet open.
      createRepeatingRow(id, 'talent', fields);
    });

    // A known name's fields are defaults; fields given in the JSON win. Older
    // files may use pre-rename weapon names.
    const renamedWeapons = {'Sword, Falx': 'Falx', 'Sword, Gladius': 'Gladius', 'Sword, Long': 'Longsword', 'Sword, Long, Spatha': 'Spatha', 'Unarmed Strike': 'Unarmed'};
    (Array.isArray(npc.weapons) ? npc.weapons : []).forEach((rawWeapon) => {
      const weapon = Object.assign({}, rawWeapon, {name: renamedWeapons[rawWeapon.name] || rawWeapon.name});
      const resolved = Object.assign({}, ccWeaponProfiles[weapon.name] || {}, weapon);
      if (resolved.type && !['melee', 'ranged', 'mental'].includes(resolved.type)) {
        warnings.push(`weapon "${resolved.name}" has unknown type "${resolved.type}" - left as Auto`);
      }
      createRepeatingRow(id, 'weapon', {
        name: resolved.name,
        attack_type: ['melee', 'ranged', 'mental'].includes(resolved.type) ? resolved.type : '',
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

    (Array.isArray(npc.special_rules) ? npc.special_rules : []).forEach((rule) => {
      if (!rule || !rule.name) {
        warnings.push('a special rule is missing "name" - skipped');
        return;
      }
      // X fills in from a trailing number on first sheet open.
      createRepeatingRow(id, 'specialrule', {name: rule.name, x: rule.x, description: rule.description});
    });

    // Spells: name only; Skill, Difficulty, Cost, Duration and Category fill
    // in from the sheet's spellbooks on first open.
    const spellcasting = (npc.spellcasting && typeof npc.spellcasting === 'object') ? npc.spellcasting : {};
    if (spellcasting.attribute) {
      setAttr(id, 'spellcasting_type', `npc_${spellcasting.attribute}`);
      setAttr(id, 'spellcasting_attribute', ccCapitalize(spellcasting.attribute));
      setAttr(id, 'base_power', 2);
    }
    if (spellcasting.tradition) {
      setAttr(id, 'magical_tradition', spellcasting.tradition);
      setAttr(id, 'tradition_marker', spellcasting.tradition);
    }
    const spells = Array.isArray(npc.spells) ? npc.spells : [];
    if (spells.length && !spellcasting.tradition) {
      warnings.push('spells listed without spellcasting.tradition - they will not resolve to spell details');
    }
    spells.forEach((spell) => createRepeatingRow(id, 'spell', {name: spell}));

    // Derived fields (see the top comment). A stat block total wins;
    // otherwise the tier formulas apply.
    const brawn = Number(npc.attributes.brawn) || 0;
    const will = Number(npc.attributes.will) || 0;
    const baseArmour = ccAttributeBonus(brawn);
    setAttr(id, 'base_armour', baseArmour);
    setAttr(id, 'total_armor', hasBook('armor') ? Number(profile.armor) : baseArmour + totalResistance);
    setAttr(id, 'courage', hasBook('courage') ? Number(profile.courage) : ccAttributeBonus(will));
    setAttr(id, 'injury_limit', hasBook('injuries') ? Number(profile.injuries) : {trooper: 1, toughened: 2, nemesis: 3}[npcType]);
    if (hasBook('power')) { setAttr(id, 'power_rating', Number(profile.power)); }

    const resilienceRanks = Number((skills.resilience || {}).ranks) || 0;
    const formulaStress = Math.max(brawn, will) + resilienceRanks;
    let stressMaxBase = npcType === 'trooper' ? Math.ceil(formulaStress / 2) : formulaStress;
    if (hasBook('stress')) { stressMaxBase = Number(profile.stress); }
    setAttr(id, 'stress_max_base', stressMaxBase);

    const fatigue = Number(npc.fatigue) || 0;
    setAttr(id, 'fatigue', fatigue);
    setAttr(id, 'stress_max', Math.max(0, stressMaxBase - fatigue));
    setAttr(id, 'stress', Number(npc.stress) || 0);
    // Hidden radios that grey out Stress/Fatigue boxes past the max.
    setAttr(id, 'stress_max_marker', Math.max(0, stressMaxBase - fatigue));
    setAttr(id, 'fatigue_max_marker', stressMaxBase);

    const injuryLimit = hasBook('injuries') ? Number(profile.injuries) : {trooper: 1, toughened: 2, nemesis: 3}[npcType];
    const tokenNote = setupToken(character, npc.token, {
      name: npc.name,
      npcType,
      adversary: npc.allegiance !== 'ally',
      stress: Number(npc.stress) || 0,
      stressMax: Math.max(0, stressMaxBase - fatigue),
      injuryLimit,
    }, warnings, library);

    // Token actions for its weapons and spells, if cctokenactions.js is
    // installed (API-made rows don't trigger its own update).
    if (typeof CCTokenActions !== 'undefined' && CCTokenActions.update) { CCTokenActions.update(id); }
    CCImportHooks.forEach((hook) => {
      try {
        hook(id);
      } catch (err) {
        log(`[CCImport] import hook failed for "${npc.name}": ${err.message}`);
      }
    });

    const count = (list) => (Array.isArray(list) ? list.length : 0);
    debug(`"${npc.name}" (${id}): ${npcType}, ${npc.allegiance || 'adversary'}; ` +
      `${Object.keys(skills).length} skills, ${count(npc.talents)} talents, ${count(npc.weapons)} weapons, ` +
      `${count(npc.armor)} armor, ${count(npc.special_rules)} special rules, ${spells.length} spells; ` +
      `stress_max_base ${stressMaxBase}${hasBook('stress') ? ' (stat block)' : ''}, ` +
      `total_armor ${hasBook('armor') ? Number(profile.armor) : baseArmour + totalResistance}, ` +
      `courage ${hasBook('courage') ? Number(profile.courage) : ccAttributeBonus(will)}; ${warnings.length} warnings`);
    return {name: npc.name, warnings, notes: tokenNote ? [tokenNote] : []};
  };

  // GM Notes are rich-text HTML: <p>, <br> and <div> wrappers, entity-escaped
  // and curly quotes, &nbsp; or U+00A0 indentation. Normalize back to plain
  // JSON.
  const decodeEntities = (text) => text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, '\'')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&amp;/gi, '&');

  const stripHtmlNotes = (raw) => decodeEntities(String(raw || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/[   ]/g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[“”„″]/g, '"')
    .replace(/[‘’′]/g, '\'')
    .trim();

  const announceResults = (who, results) => {
    results.forEach((r) => log(`[CCImport] imported "${r.name}"${r.warnings.length ? ` - warnings: ${r.warnings.join('; ')}` : ''}`));
    const lines = results.map((r) => {
      const notes = (r.notes || []).concat(r.warnings);
      return `${r.name}${notes.length ? ` (${notes.join('; ')})` : ''}`;
    });
    sendChat('CCImport', `/w "${whisperTo(who)}" &{template:default} {{name=NPC Import}} {{Imported ${results.length}=${lines.join(' | ')}}}`);
  };

  const runImport = async (who, rawNotes) => {
    const cleaned = stripHtmlNotes(rawNotes);
    if (!cleaned) {
      sendChat('CCImport', `/w "${whisperTo(who)}" That handout's GM Notes are empty.`);
      return;
    }
    let data;
    try {
      data = JSON.parse(cleaned);
    } catch (err) {
      // Show the text around the parse failure, in chat and the API console.
      const pos = Number((String(err.message).match(/position (\d+)/) || [])[1]);
      const near = Number.isFinite(pos) ? cleaned.slice(Math.max(0, pos - 30), pos + 30) : cleaned.slice(0, 60);
      const codes = Number.isFinite(pos) ? ` (character there: U+${cleaned.charCodeAt(pos).toString(16).toUpperCase().padStart(4, '0')})` : '';
      log(`[CCImport] JSON parse failed: ${err.message}${codes}; near: ${JSON.stringify(near)}; raw GM Notes start: ${JSON.stringify(String(rawNotes || '').slice(0, 300))}`);
      sendChat('CCImport', `/w "${whisperTo(who)}" Could not parse JSON from GM Notes: ${err.message}${codes}. Near: ${near.replace(/[{}[\]]/g, ' ')}`);
      return;
    }
    const npcs = Array.isArray(data) ? data : [data];
    debug(`GM Notes: ${String(rawNotes || '').length} characters, ${cleaned.length} after cleanup; ${npcs.length} NPC(s)`);
    if (!npcs.length) {
      sendChat('CCImport', `/w "${whisperTo(who)}" No NPCs found in that JSON.`);
      return;
    }
    // One NPC failing mustn't hide the others' results, and a crash should be
    // reported.
    const library = await loadTokenLibrary();
    announceResults(who, npcs.map((npc) => {
      try {
        return importNpc(npc, library);
      } catch (err) {
        log(`[CCImport] import of "${npc && npc.name}" failed: ${err.stack || err.message}`);
        return {name: (npc && npc.name) || '(unnamed)', warnings: [`IMPORT FAILED part-way (${err.message}) - delete this character and report the error`]};
      }
    }));
  };

  const usage = (who) => {
    sendChat('CCImport', `/w "${whisperTo(who)}" Usage: !ccimport handout|<Handout Name> - paste one NPC object or a JSON array of several into that handout's GM Notes first. See npc-import/FORMAT.md for the data format. Also: !ccimport tokens lists the token images found; !ccimport token|<Character Name>[|<Token Name>] gives an existing character its token.`);
  };

  const handleMessage = (msg) => {
    if (handleDebugCommand(msg)) { return; }
    const content = String(msg.content || '').trim();
    if (!content.startsWith('!ccimport')) { return; }
    debug(`command ${JSON.stringify(msg.content)} by ${msg.who} (GM: ${playerIsGM(msg.playerid)})`);

    // Reading GM Notes and creating characters are GM-only.
    if (!playerIsGM(msg.playerid)) {
      sendChat('CCImport', `/w "${whisperTo(msg.who)}" Only the GM can import NPCs.`);
      return;
    }

    const rest = content.slice('!ccimport'.length).trim();
    if (!rest) { usage(msg.who); return; }

    // Lists the token names the import can use.
    if (rest === 'tokens') {
      loadTokenLibrary().then((library) => {
        const where = (e) => (e.source === 'token marker' ? '' : e.source.startsWith('page') ? ' (page)' : ' (folder)');
        const names = [...new Set(library.map((e) => `${e.name}${where(e)}`))].sort();
        sendChat('CCImport', `/w "${whisperTo(msg.who)}" &{template:default} {{name=Token images (${names.length})}} ` +
          `{{Found=${names.length ? names.join(', ') : 'none - add a Journal folder "Token Images" with a folder per token (as for ModifyTokenImage), a page named "Token Library" with named tokens, or a custom token marker set'}}}`);
      });
      return;
    }

    // Gives an existing character its token, from its stat block values.
    if (rest.startsWith('token|')) {
      const [charName, tokenName] = rest.slice('token|'.length).split('|').map((p) => p.trim());
      const character = findObjs({_type: 'character', name: charName})[0];
      if (!character) {
        sendChat('CCImport', `/w "${whisperTo(msg.who)}" No character named "${charName}" found.`);
        return;
      }
      const attr = (name) => {
        const obj = findObjs({_type: 'attribute', _characterid: character.id, name})[0];
        return obj ? obj.get('current') : '';
      };
      const warnings = [];
      loadTokenLibrary().then((library) => {
        const note = setupToken(character, tokenName || charName, {
          name: character.get('name'),
          npcType: attr('character_type'),
          adversary: attr('npc_allegiance') !== 'ally',
          stress: Number(attr('stress')) || 0,
          stressMax: Number(attr('stress_max')) || 0,
          injuryLimit: Number(attr('injury_limit')) || 0,
        }, warnings, library);
        sendChat('CCImport', `/w "${whisperTo(msg.who)}" ${charName}: ${note || 'token not set'}${warnings.length ? ` (${warnings.join('; ')})` : ''}`);
      });
      return;
    }

    const [sourceType, ...identifierParts] = rest.split('|');
    const identifier = identifierParts.join('|').trim();
    if (sourceType.trim() !== 'handout' || !identifier) {
      usage(msg.who);
      return;
    }

    const handout = findObjs({_type: 'handout', name: identifier})[0];
    debug(`handout "${identifier}": ${handout ? handout.id : 'not found'}`);
    if (!handout) {
      sendChat('CCImport', `/w "${whisperTo(msg.who)}" No handout named "${identifier}" found.`);
      return;
    }
    // handout.get('gmnotes') is asynchronous and needs a callback.
    handout.get('gmnotes', (gmnotes) => runImport(msg.who, gmnotes));
  };

  on('chat:message', handleMessage);

  log(`Cohors Cthulhu NPC Import ready. Debug logging ${state.CCDebug.on ? 'on' : 'off'} (!ccdebugon / !ccdebugoff).`);
});
