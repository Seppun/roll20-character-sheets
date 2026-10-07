// api-scripts/ccthreat.js
// Cohors Cthulhu - Global Threat Pool
//
// Keeps the GM's Threat pool in the API's persistent state. The sheet sends a
// hidden ccthreatsignal roll (recognised by msg.rolltemplate, value from the
// inline roll's total):
//   - +1 per Complication on a player's roll.
//   - An adversary NPC's roll: one net delta, extra successes less the d20s
//     it bought (may be negative).
// The pool never drops below 0. Other Threat spends are made with !threat-
// adjust.
//
// INSTALL: Game Settings > API Scripts > New Script, paste this file, Save
// Script. Needs a Pro game. Runs alongside ccmomentum.js.
//
// CHAT COMMANDS:
//   !threat            - announce the pool
//   !threat-set N      - GM only: set the pool
//   !threat-adjust N   - GM only: add N (negative to subtract)
//   !ccdebugon / !ccdebugoff - GM only: debug logging to the API console,
//                          for all Cohors Cthulhu scripts (!ccdebug: status)
//
// DISPLAY: every change is announced in chat, and the pool is shown on:
//   1. bar1 of any graphic on the current page named "Threat Pool"
//      (optional).
//   2. A "Threat Pool: N" entry in the Turn Order.
on('ready', () => {
  'use strict';

  // msg.who for a GM ends in " (GM)", which /w can't resolve; whisper to the
  // bare name.
  const whisperTo = (who) => String(who || '').replace(/\s*\(GM\)\s*$/, '');

  // Debug logging, shared by every Cohors Cthulhu script through
  // state.CCDebug: !ccdebugon / !ccdebugoff (GM only, any case) switch it for
  // all of them, !ccdebug shows the setting. Off by default; errors are always
  // logged.
  const DEBUG_NAME = 'ccthreat.js';
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

  const STATE_KEY = 'CCThreat';
  const TURN_ORDER_ID = '-ccthreat-pool';
  const TOKEN_NAME = 'threat pool';

  if (!state[STATE_KEY] || typeof state[STATE_KEY].pool !== 'number') {
    state[STATE_KEY] = {pool: 0};
  }

  const getPool = () => Number(state[STATE_KEY].pool) || 0;

  const setPool = (value) => {
    state[STATE_KEY].pool = Math.max(0, Math.round(Number(value) || 0));
  };

  // Optional "Threat Pool" graphic.
  const updateTokenDisplay = () => {
    const page = Campaign() && Campaign().get('playerpageid');
    if (!page) { return; }
    const tokens = findObjs({_type: 'graphic', _pageid: page}) || [];
    const pool = getPool();
    tokens
      .filter((token) => String(token.get('name') || '').trim().toLowerCase() === TOKEN_NAME)
      .forEach((token) => {
        debug(`display: token ${token.id} bar1 = ${pool}`);
        token.set({
          bar1_value: pool,
          bar1_max: pool,
          tooltip: `Threat Pool: ${pool}`,
        });
      });
  };

  const updateTurnOrderDisplay = () => {
    const campaign = Campaign();
    if (!campaign) { return; }
    let turnOrder = [];
    try {
      turnOrder = JSON.parse(campaign.get('turnorder') || '[]');
      if (!Array.isArray(turnOrder)) { turnOrder = []; }
    } catch (err) {
      turnOrder = [];
    }
    const entry = {
      id: TURN_ORDER_ID,
      pr: String(getPool()),
      custom: 'Threat Pool',
      formula: '',
    };
    // Update the entry in place, or add it at the end: the first entry is the
    // current turn.
    const index = turnOrder.findIndex((item) => item && item.id === TURN_ORDER_ID);
    debug(`display: Turn Order entry ${index === -1 ? 'added' : 'updated'} (${entry.pr})`);
    if (index === -1) {
      turnOrder.push(entry);
    } else {
      turnOrder[index] = entry;
    }
    campaign.set('turnorder', JSON.stringify(turnOrder));
  };

  const refreshDisplays = () => {
    updateTokenDisplay();
    updateTurnOrderDisplay();
  };

  const announce = (note) => {
    const value = getPool();
    const suffix = note ? ` (${note})` : '';
    sendChat('Threat Pool', `&{template:default} {{name=Threat Pool}} {{Current=${value}${suffix}}}`);
    refreshDisplays();
  };

  const formatDelta = (delta) => (delta > 0 ? `+${delta}` : `${delta}`);

  // The value of the hidden ccthreatsignal roll, or null for any other
  // message.
  const threatSignalValue = (msg) => {
    if (msg.rolltemplate !== 'ccthreatsignal') { return null; }
    const roll = Array.isArray(msg.inlinerolls) ? msg.inlinerolls[0] : null;
    const total = roll && roll.results && roll.results.total;
    if (!Number.isFinite(total)) {
      log(`[CCThreat] ccthreatsignal message without a usable inline roll - raw msg: ${JSON.stringify(msg)}`);
      return null;
    }
    return total;
  };

  const handleMessage = (msg) => {
    if (handleDebugCommand(msg)) { return; }
    debug(`chat:message type=${msg.type} rolltemplate=${msg.rolltemplate} content=${JSON.stringify(msg.content)} inlinerolls=${JSON.stringify(msg.inlinerolls)}`);

    const delta = threatSignalValue(msg);
    if (delta !== null) {
      const before = getPool();
      debug(`ccthreatsignal ${formatDelta(delta)}: pool ${before} -> ${Math.max(0, before + delta)}`);
      if (delta !== 0) {
        setPool(getPool() + delta);
        announce(formatDelta(delta));
      }
      return;
    }

    const content = String(msg.content || '');
    const trimmed = content.trim();
    const [command, ...args] = trimmed.split(/\s+/);
    if (!command) { return; }
    if (/^!(cc)?threat/.test(command)) {
      debug(`command ${trimmed} by ${msg.who} (GM: ${playerIsGM(msg.playerid)}), pool ${getPool()}`);
    }

    // e.g. `!ccthreat-adjust 2`: same as the signal. GM-only.
    if (command === '!ccthreat-adjust') {
      if (!playerIsGM(msg.playerid)) {
        sendChat('Threat Pool', `/w "${whisperTo(msg.who)}" Only the GM can use !ccthreat-adjust.`);
        return;
      }
      const delta = Number(args[0]);
      if (!Number.isFinite(delta) || delta === 0) { return; }
      setPool(getPool() + delta);
      announce(formatDelta(delta));
      return;
    }

    if (command === '!threat') {
      announce();
      return;
    }

    if (command === '!threat-set') {
      if (!playerIsGM(msg.playerid)) {
        sendChat('Threat Pool', `/w "${whisperTo(msg.who)}" Only the GM can set the Threat pool directly.`);
        return;
      }
      const value = Number(args[0]);
      if (!Number.isFinite(value)) {
        sendChat('Threat Pool', `/w "${whisperTo(msg.who)}" Usage: !threat-set <number>`);
        return;
      }
      setPool(value);
      announce('set by GM');
      return;
    }

    if (command === '!threat-adjust') {
      if (!playerIsGM(msg.playerid)) {
        sendChat('Threat Pool', `/w "${whisperTo(msg.who)}" Only the GM can manually adjust the Threat pool.`);
        return;
      }
      const delta = Number(args[0]);
      if (!Number.isFinite(delta)) {
        sendChat('Threat Pool', `/w "${whisperTo(msg.who)}" Usage: !threat-adjust <number, may be negative>`);
        return;
      }
      setPool(getPool() + delta);
      announce(`${formatDelta(delta)}, GM`);
      return;
    }
  };

  on('chat:message', handleMessage);

  // Re-show the Turn Order entry and token on script load.
  refreshDisplays();

  log(`Cohors Cthulhu Threat pool ready. Current pool: ${getPool()}. Debug logging ${state.CCDebug.on ? 'on' : 'off'} (!ccdebugon / !ccdebugoff).`);
});
