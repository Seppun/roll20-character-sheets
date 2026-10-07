// api-scripts/ccmomentum.js
// Cohors Cthulhu - Global Momentum Pool
//
// Keeps the party's shared Momentum pool (0-6) in the API's persistent state.
// The sheet sends a hidden signal roll on every roll that generates or spends
// Momentum (ccSendMomentumSignal in source/views/_global_sheetworker.pug):
//   ccmomentumsignal: a signed delta (+ generated, - spent). Momentum that
//   doesn't fit under the cap is announced as lost.
//   ccmomentumspendsignal: a cost (bought d20s, or a roll's net spend).
//   Whatever the pool can't cover becomes Threat, point for point.
// Signals are recognised by msg.rolltemplate; the value is the inline roll's
// total.
//
// INSTALL: Game Settings > API Scripts > New Script, paste this file, Save
// Script. Needs a Pro game. The sheet works without it.
//
// CHAT COMMANDS:
//   !momentum            - announce the pool
//   !momentum-set N      - GM only: set the pool
//   !momentum-adjust N   - GM only: add N (negative to subtract)
//   !ccdebugon / !ccdebugoff - GM only: debug logging to the API console,
//                          for all Cohors Cthulhu scripts (!ccdebug: status)
//
// DISPLAY: every change is announced in chat, and the pool is shown on:
//   1. bar1 of any graphic on the current page named "Momentum Pool"
//      (optional).
//   2. A "Momentum Pool: N" entry in the Turn Order.

on('ready', () => {
  'use strict';

  // msg.who for a GM ends in " (GM)", which /w can't resolve; whisper to the
  // bare name.
  const whisperTo = (who) => String(who || '').replace(/\s*\(GM\)\s*$/, '');

  // Debug logging, shared by every Cohors Cthulhu script through
  // state.CCDebug: !ccdebugon / !ccdebugoff (GM only, any case) switch it for
  // all of them, !ccdebug shows the setting. Off by default; errors are always
  // logged.
  const DEBUG_NAME = 'ccmomentum.js';
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

  const STATE_KEY = 'CCMomentum';
  const TURN_ORDER_ID = '-ccmomentum-pool';
  const TOKEN_NAME = 'momentum pool';
  const MAX_POOL = 6;

  if (!state[STATE_KEY] || typeof state[STATE_KEY].pool !== 'number') {
    state[STATE_KEY] = {pool: 0};
  }

  const getPool = () => Number(state[STATE_KEY].pool) || 0;

  const setPool = (value) => {
    state[STATE_KEY].pool = Math.min(MAX_POOL, Math.max(0, Math.round(Number(value) || 0)));
  };

  // Optional "Momentum Pool" graphic. bar1_max is the cap, so the bar shows a
  // fill fraction.
  const updateTokenDisplay = () => {
    const page = Campaign() && Campaign().get('playerpageid');
    if (!page) { return; }
    const tokens = findObjs({_type: 'graphic', _pageid: page}) || [];
    const pool = getPool();
    tokens
      .filter((token) => String(token.get('name') || '').trim().toLowerCase() === TOKEN_NAME)
      .forEach((token) => {
        debug(`display: token ${token.id} bar1 = ${pool}/${MAX_POOL}`);
        token.set({
          bar1_value: pool,
          bar1_max: MAX_POOL,
          tooltip: `Momentum Pool: ${pool}/${MAX_POOL}`,
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
      custom: 'Momentum Pool',
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
    sendChat('Momentum Pool', `&{template:default} {{name=Momentum Pool}} {{Current=${value}/${MAX_POOL}${suffix}}}`);
    refreshDisplays();
  };

  const formatDelta = (delta) => (delta > 0 ? `+${delta}` : `${delta}`);

  // Applies delta, clamped to 0-6, and returns the actual change.
  const applyDelta = (delta) => {
    const before = getPool();
    setPool(before + delta);
    return getPool() - before;
  };

  // The value of a hidden signal roll, or null for any other message.
  const signalValue = (msg, templateName) => {
    if (msg.rolltemplate !== templateName) { return null; }
    const roll = Array.isArray(msg.inlinerolls) ? msg.inlinerolls[0] : null;
    const total = roll && roll.results && roll.results.total;
    if (!Number.isFinite(total)) {
      log(`[CCMomentum] ${templateName} message without a usable inline roll - raw msg: ${JSON.stringify(msg)}`);
      return null;
    }
    return total;
  };

  // Spends what the pool has and sends the rest as a ccthreatsignal, the same
  // signal the sheet sends.
  const handleMomentumSpend = (cost) => {
    const pool = getPool();
    const spend = Math.min(cost, pool);
    const shortfall = cost - spend;
    debug(`spend ${cost}: pool ${pool} -> ${pool - spend}, paid ${spend}, shortfall ${shortfall}${shortfall > 0 ? ' sent as Threat' : ''}`);
    if (spend > 0) {
      const actualDelta = applyDelta(-spend);
      if (actualDelta !== 0) {
        announce(`${formatDelta(actualDelta)}, spent`);
      }
    }
    if (shortfall > 0) {
      sendChat('API', `/w gm &{template:ccthreatsignal} {{ccthreatdelta=[[0+${shortfall}]]}}`);
    }
  };

  const handleMessage = (msg) => {
    if (handleDebugCommand(msg)) { return; }
    debug(`chat:message type=${msg.type} rolltemplate=${msg.rolltemplate} content=${JSON.stringify(msg.content)} inlinerolls=${JSON.stringify(msg.inlinerolls)}`);

    // Signed delta from a roll; Momentum past the cap is announced as lost.
    const delta = signalValue(msg, 'ccmomentumsignal');
    if (delta !== null) {
      const before = getPool();
      const actualDelta = delta ? applyDelta(delta) : 0;
      const lost = delta > 0 ? delta - actualDelta : 0;
      debug(`ccmomentumsignal ${formatDelta(delta)}: pool ${before} -> ${getPool()}${lost > 0 ? `, ${lost} lost (cap ${MAX_POOL})` : ''}`);
      if (lost > 0) {
        announce(`${actualDelta ? `${formatDelta(actualDelta)}, ` : ''}${lost} lost - pool full`);
      } else if (actualDelta !== 0) {
        announce(formatDelta(actualDelta));
      }
      return;
    }

    // A cost the pool may not cover.
    const cost = signalValue(msg, 'ccmomentumspendsignal');
    if (cost !== null) {
      debug(`ccmomentumspendsignal ${cost}`);
      if (cost > 0) {
        handleMomentumSpend(cost);
      }
      return;
    }

    const content = String(msg.content || '');
    const trimmed = content.trim();
    const [command, ...args] = trimmed.split(/\s+/);
    if (!command) { return; }
    if (/^!(cc)?momentum/.test(command)) {
      debug(`command ${trimmed} by ${msg.who} (GM: ${playerIsGM(msg.playerid)}), pool ${getPool()}`);
    }

    // Testing aliases; GM-only since they change the pool.
    if ((command === '!ccmomentum-adjust' || command === '!ccmomentum-spend') && !playerIsGM(msg.playerid)) {
      sendChat('Momentum Pool', `/w "${whisperTo(msg.who)}" Only the GM can use ${command}.`);
      return;
    }

    // e.g. `!ccmomentum-adjust 2`: same as the delta signal.
    if (command === '!ccmomentum-adjust') {
      const delta = Number(args[0]);
      if (!Number.isFinite(delta) || delta === 0) { return; }
      const actualDelta = applyDelta(delta);
      if (actualDelta !== 0) {
        announce(formatDelta(actualDelta));
      }
      return;
    }

    // e.g. `!ccmomentum-spend 4`: same as the spend signal.
    if (command === '!ccmomentum-spend') {
      const cost = Number(args[0]);
      if (!Number.isFinite(cost) || cost <= 0) { return; }
      handleMomentumSpend(cost);
      return;
    }

    if (command === '!momentum') {
      announce();
      return;
    }

    if (command === '!momentum-set') {
      if (!playerIsGM(msg.playerid)) {
        sendChat('Momentum Pool', `/w "${whisperTo(msg.who)}" Only the GM can set the Momentum pool directly.`);
        return;
      }
      const value = Number(args[0]);
      if (!Number.isFinite(value)) {
        sendChat('Momentum Pool', `/w "${whisperTo(msg.who)}" Usage: !momentum-set <number>`);
        return;
      }
      setPool(value);
      announce('set by GM');
      return;
    }

    if (command === '!momentum-adjust') {
      if (!playerIsGM(msg.playerid)) {
        sendChat('Momentum Pool', `/w "${whisperTo(msg.who)}" Only the GM can manually adjust the Momentum pool.`);
        return;
      }
      const delta = Number(args[0]);
      if (!Number.isFinite(delta)) {
        sendChat('Momentum Pool', `/w "${whisperTo(msg.who)}" Usage: !momentum-adjust <number, may be negative>`);
        return;
      }
      const actualDelta = applyDelta(delta);
      announce(`${formatDelta(actualDelta)}, GM correction`);
      return;
    }
  };

  on('chat:message', handleMessage);

  // Re-show the Turn Order entry and token on script load.
  refreshDisplays();

  log(`Cohors Cthulhu Momentum pool ready. Current pool: ${getPool()}. Debug logging ${state.CCDebug.on ? 'on' : 'off'} (!ccdebugon / !ccdebugoff).`);
});
