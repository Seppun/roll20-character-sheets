// api-scripts/cctokenactions.js
// Cohors Cthulhu - Token Actions
//
// Keeps a token action for every weapon and spell on each character, so
// selecting a token shows its attacks and spells in the token action bar.
// Each is an ability with "Show as Token Action" set, named after the weapon
// ("Cast <spell>" for spells), that clicks the same hidden action button as
// the sheet's roll button: %{<character>|repeating_weapon_<row>_weapon-action}.
//
// Abilities it manages are recognised by that action text; any other
// abilities are left alone. They are updated when a weapon or spell is named,
// renamed or deleted on the sheet, when a character is renamed, and for every
// character when the API starts. ccimport.js updates imported NPCs.
//
// INSTALL: Game Settings > API Scripts > New Script, paste this file, Save
// Script. Needs a Pro game. Independent of the other scripts.
//
// CHAT COMMANDS (GM only):
//   !cctokenactions        - rebuild for the selected tokens' characters, or
//                            every character if nothing is selected
//   !cctokenactions clear  - remove them (selected, or every character)
//   !cctokenactions off    - stop automatic updates (on: resume)
//   !ccdebugon / !ccdebugoff - debug logging to the API console, for all
//                            Cohors Cthulhu scripts

// Shared with ccimport.js, which calls CCTokenActions.update for new NPCs.
var CCTokenActions = CCTokenActions || {};

on('ready', () => {
  'use strict';

  const whisperTo = (who) => String(who || '').replace(/\s*\(GM\)\s*$/, '');

  // Debug logging, shared by every Cohors Cthulhu script through
  // state.CCDebug: !ccdebugon / !ccdebugoff (GM only, any case) switch it for
  // all of them, !ccdebug shows the setting. Off by default; errors are always
  // logged.
  const DEBUG_NAME = 'cctokenactions.js';
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

  const STATE_KEY = 'CCTokenActions';
  state[STATE_KEY] = state[STATE_KEY] || {auto: true};

  const SECTIONS = {
    weapon: {button: 'weapon-action', label: (name) => name},
    spell: {button: 'spell-cast-action', label: (name) => `Cast ${name}`},
  };
  const MANAGED = /^%\{[^|}]*\|repeating_(weapon|spell)_[^}]+_(weapon|spell-cast)-action\}$/;
  const ROW_NAME = /^repeating_(weapon|spell)_([^_]+)_name$/;

  // Named weapon and spell rows, in sheet order where Roll20 recorded one.
  const rowsOf = (characterId) => {
    const attrs = findObjs({_type: 'attribute', _characterid: characterId});
    const order = {};
    attrs.forEach((attr) => {
      const m = /^_reporder_repeating_(weapon|spell)$/.exec(attr.get('name'));
      if (m) {
        String(attr.get('current') || '').split(',').forEach((id, i) => { order[`${m[1]}:${id.toLowerCase()}`] = i; });
      }
    });
    return attrs
      .map((attr) => {
        const m = ROW_NAME.exec(attr.get('name'));
        const name = m ? String(attr.get('current') || '').trim() : '';
        return name ? {section: m[1], rowId: m[2], name} : null;
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.section !== b.section) { return a.section === 'weapon' ? -1 : 1; }
        const rank = (row) => {
          const i = order[`${row.section}:${row.rowId.toLowerCase()}`];
          return i === undefined ? 999 : i;
        };
        return rank(a) - rank(b);
      });
  };

  const managedAbilities = (characterId) => findObjs({_type: 'ability', _characterid: characterId})
    .filter((ability) => MANAGED.test(String(ability.get('action') || '')));

  // Makes the character's managed abilities match its weapon and spell rows.
  const update = (characterId) => {
    const character = getObj('character', characterId);
    if (!character) { return; }
    const charName = character.get('name');
    const wanted = new Map();
    const counts = {};
    rowsOf(characterId).forEach(({section, rowId, name}) => {
      let label = SECTIONS[section].label(name);
      counts[label] = (counts[label] || 0) + 1;
      if (counts[label] > 1) { label = `${label} (${counts[label]})`; }
      wanted.set(`%{${charName}|repeating_${section}_${rowId}_${SECTIONS[section].button}}`, label);
    });
    let added = 0;
    let removed = 0;
    managedAbilities(characterId).forEach((ability) => {
      const label = wanted.get(ability.get('action'));
      if (label === undefined) {
        ability.remove();
        removed += 1;
        return;
      }
      if (ability.get('name') !== label) { ability.set('name', label); }
      if (!ability.get('istokenaction')) { ability.set('istokenaction', true); }
      wanted.delete(ability.get('action'));
    });
    wanted.forEach((label, action) => {
      createObj('ability', {characterid: characterId, name: label, action, istokenaction: true});
      added += 1;
    });
    debug(`"${charName}": ${added} added, ${removed} removed`);
  };

  const clear = (characterId) => managedAbilities(characterId).forEach((ability) => ability.remove());

  // Deleting a row destroys all of its attributes; wait for the burst to end.
  const pending = {};
  const schedule = (characterId) => {
    if (!state[STATE_KEY].auto || !characterId) { return; }
    clearTimeout(pending[characterId]);
    pending[characterId] = setTimeout(() => {
      delete pending[characterId];
      update(characterId);
    }, 250);
  };

  const onAttribute = (attr) => {
    if (ROW_NAME.test(String(attr.get('name') || ''))) {
      debug(`${attr.get('name')} changed on ${attr.get('characterid')}`);
      schedule(attr.get('characterid'));
    }
  };
  on('add:attribute', onAttribute);
  on('change:attribute', onAttribute);
  on('destroy:attribute', onAttribute);
  // A rename changes every call's character name.
  on('change:character:name', (character) => schedule(character.id));

  const charactersFor = (msg) => {
    const selected = (msg.selected || [])
      .map((s) => getObj('graphic', s._id))
      .filter((token) => token && token.get('represents'))
      .map((token) => token.get('represents'));
    return selected.length ? [...new Set(selected)] : findObjs({_type: 'character'}).map((c) => c.id);
  };

  on('chat:message', (msg) => {
    if (handleDebugCommand(msg)) { return; }
    if (msg.type !== 'api') { return; }
    const [command, arg] = String(msg.content || '').trim().split(/\s+/);
    if (command !== '!cctokenactions') { return; }
    const reply = (text) => sendChat('Token Actions', `/w "${whisperTo(msg.who)}" ${text}`, null, {noarchive: true});
    if (!playerIsGM(msg.playerid)) {
      reply('Only the GM can manage token actions.');
      return;
    }
    if (arg === 'off' || arg === 'on') {
      state[STATE_KEY].auto = arg === 'on';
      reply(`Automatic token action updates are ${arg}.`);
      return;
    }
    const ids = charactersFor(msg);
    ids.forEach(arg === 'clear' ? clear : update);
    reply(`${arg === 'clear' ? 'Removed' : 'Updated'} weapon and spell token actions for ${ids.length} character${ids.length === 1 ? '' : 's'}.`);
  });

  CCTokenActions.update = update;

  if (state[STATE_KEY].auto) {
    findObjs({_type: 'character'}).forEach((character) => update(character.id));
  }
  log(`Cohors Cthulhu Token Actions ready (automatic updates ${state[STATE_KEY].auto ? 'on' : 'off'}). Debug logging ${state.CCDebug.on ? 'on' : 'off'} (!ccdebugon / !ccdebugoff).`);
});
