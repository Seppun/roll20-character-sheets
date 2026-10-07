// api-scripts/ccnpclock.js
// Cohors Cthulhu - NPC Lock
//
// Keeps the NPC types (Trooper / Toughened / Nemesis) GM-only. Sheets can't
// tell the GM from a player, but only the GM can read GM Notes, so those
// decide:
//
//   - GM Notes containing the word NPC unlock the Character Type selector.
//   - "NPC: Trooper", "NPC: Toughened" or "NPC: Nemesis" also set that tier.
//   - Anything else locks it: the selector is hidden and any NPC type is
//     reset to Player Character (other data is untouched).
//
// Sets the hidden npc_unlocked attribute and corrects character_type whenever
// the character, its character_type or its npc_unlocked changes, and for
// every character on startup.
//
// First run only: characters with an NPC type, no controlling player and no
// marker get "NPC" added to their GM Notes; player-controlled ones are reset.
//
// INSTALL: Game Settings > API Scripts > New Script, paste this file, Save
// Script. ccimport.js writes "NPC: <Tier>" into imported NPCs' GM Notes.
//
// DEBUG: !ccdebugon / !ccdebugoff (GM only) log each check and its outcome to
// the API console, for all Cohors Cthulhu scripts.
on('ready', () => {
  'use strict';

  // Debug logging, shared by every Cohors Cthulhu script through
  // state.CCDebug: !ccdebugon / !ccdebugoff (GM only, any case) switch it for
  // all of them, !ccdebug shows the setting. Off by default; errors are always
  // logged.
  const DEBUG_NAME = 'ccnpclock.js';
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

  const STATE_KEY = 'CCNpcLock';
  const NPC_TIERS = ['trooper', 'toughened', 'nemesis'];
  const LEGACY_NPC_TYPES = ['cannon_fodder', 'npc'];

  // GM Notes are rich-text HTML; only the words matter here.
  const notesText = (raw) => String(raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&');

  // "NPC" as a whole word unlocks; "NPC: Toughened" (or "NPC - Toughened",
  // "NPC Toughened") also names the tier.
  const parseNotes = (raw) => {
    const match = notesText(raw).match(/\bNPC\b(?:\s*[:\-]?\s*(trooper|toughened|nemesis)\b)?/i);
    return match ? {npc: true, tier: match[1] ? match[1].toLowerCase() : null} : {npc: false, tier: null};
  };

  const getAttrValue = (characterId, name) => {
    const attr = findObjs({type: 'attribute', characterid: characterId, name})[0];
    return attr ? String(attr.get('current')) : '';
  };

  // setWithWorker so the sheet's calculations react as if changed on the
  // sheet.
  const setAttrValue = (characterId, name, value) => {
    let attr = findObjs({type: 'attribute', characterid: characterId, name})[0];
    if (!attr) {
      attr = createObj('attribute', {characterid: characterId, name, current: ''});
    }
    attr.setWithWorker({current: String(value)});
  };

  const whisperGM = (text) => sendChat('NPC Lock', `/w gm ${text}`, null, {noarchive: true});

  const enforce = (character, notes) => {
    const id = character.id;
    const {npc, tier} = parseNotes(notes);
    const type = getAttrValue(id, 'character_type') || 'pc';
    const unlocked = getAttrValue(id, 'npc_unlocked') === '1';

    const npcType = NPC_TIERS.includes(type) || LEGACY_NPC_TYPES.includes(type);
    const changes = npc ?
      [!unlocked && 'unlock', tier && type !== tier && `type -> ${tier}`] :
      [unlocked && 'lock', npcType && 'type -> pc'];
    debug(`"${character.get('name')}" (${id}): GM Notes ${npc ? `mark it NPC${tier ? ` (${tier})` : ''}` : 'have no NPC mark'}; ` +
      `type ${type}, unlocked ${unlocked}; ${changes.filter(Boolean).join(', ') || 'no change'}`);

    if (npc) {
      if (!unlocked) { setAttrValue(id, 'npc_unlocked', 1); }
      if (tier && type !== tier) { setAttrValue(id, 'character_type', tier); }
      return;
    }

    if (unlocked) { setAttrValue(id, 'npc_unlocked', 0); }
    if (npcType) {
      setAttrValue(id, 'character_type', 'pc');
      whisperGM(`${character.get('name')} was reset to Player Character - its GM Notes don't mark it as an NPC (add "NPC" or "NPC: Toughened" to them to allow it).`);
    }
  };

  // character.get('gmnotes') is asynchronous - it needs a callback.
  const check = (character) => {
    if (!character) { return; }
    character.get('gmnotes', (notes) => enforce(character, notes));
  };

  // First-run migration (see the top comment).
  const grandfatherExistingNpcs = (characters, done) => {
    state[STATE_KEY] = state[STATE_KEY] || {};
    if (state[STATE_KEY].migrated) { done(); return; }
    debug(`first run: checking ${characters.length} characters for unmarked NPCs`);
    let pending = characters.length;
    const finish = () => {
      pending -= 1;
      if (pending <= 0) {
        state[STATE_KEY].migrated = true;
        done();
      }
    };
    if (!pending) { finish(); return; }
    characters.forEach((character) => {
      const type = getAttrValue(character.id, 'character_type');
      const isNpcType = NPC_TIERS.includes(type) || LEGACY_NPC_TYPES.includes(type);
      const playerControlled = String(character.get('controlledby') || '').trim() !== '';
      if (!isNpcType || playerControlled) { finish(); return; }
      character.get('gmnotes', (notes) => {
        if (!parseNotes(notes).npc) {
          character.set('gmnotes', `${notes ? `${notes}<p>NPC</p>` : 'NPC'}`);
          log(`[CCNpcLock] marked existing NPC "${character.get('name')}" with "NPC" in its GM Notes`);
        }
        finish();
      });
    });
  };

  const characters = findObjs({type: 'character'});
  debug(`startup: checking ${characters.length} characters`);
  grandfatherExistingNpcs(characters, () => characters.forEach(check));

  // Any change to the character, including its GM Notes. (API scripts'
  // changes don't fire these.)
  on('change:character', (character) => {
    debug(`change:character "${character.get('name')}"`);
    check(character);
  });

  // Type or unlock flag changed directly, e.g. on the Attributes & Abilities
  // tab.
  const onAttribute = (attr) => {
    const name = attr.get('name');
    if (name !== 'character_type' && name !== 'npc_unlocked') { return; }
    debug(`${name} = ${attr.get('current')} on character ${attr.get('characterid')}`);
    check(getObj('character', attr.get('characterid')));
  };
  on('change:attribute', onAttribute);
  on('add:attribute', onAttribute);

  on('chat:message', handleDebugCommand);

  log(`Cohors Cthulhu NPC Lock ready (NPC types follow GM Notes). Debug logging ${state.CCDebug.on ? 'on' : 'off'} (!ccdebugon / !ccdebugoff).`);
});
