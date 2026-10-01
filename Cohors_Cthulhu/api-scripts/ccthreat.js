// api-scripts/ccthreat.js
// Cohors Cthulhu - Global Threat Pool
//
// Threat is the GM's mirror of the Momentum pool (see ccmomentum.js) - a
// single, game-wide resource the GM spends to buy extra d20s for NPCs,
// trigger directorial effects, or introduce complications, kept in the
// API's own persistent state since it isn't a per-character stat either.
//
// +1 to the pool per Complication a player's roll generates (2d20 RAW:
//    each Complication generates 1 point of Threat for the GM).
// There is no automatic decrease: RAW never has a player spend Threat
// from their own sheet, only the GM spends it (buying NPC dice,
// directorial moves), which happens in narration, not on this sheet - so
// !threat-adjust (GM only) is the only way the pool goes down.
//
// The signal itself works exactly like ccmomentum.js's (see
// lessons_learned.md for the sendChat/msg.content mechanics both scripts
// rely on) via a separate hidden (display:none) roll template,
// ccthreatsignal (rolltemplate/_index.pug), kept fully independent from
// ccmomentum.js's own signal so this script can never risk the
// already-working Momentum pool.
//
// INSTALL: a separate piece from the character sheet's own Layout/Style/
// Script boxes, and separate from ccmomentum.js too - both are ordinary
// Roll20 API scripts and can run side by side. Game Settings > API
// Scripts > New Script, paste this whole file in, Save Script. Requires
// a Pro-tier game with the API sandbox enabled.
//
// CHAT COMMANDS:
//   !threat            - announce the current pool value
//   !threat-set N      - GM only: set the pool to an exact value
//   !threat-adjust N   - GM only: add N (negative to subtract) - this is
//                        how the GM actually spends Threat, since nothing
//                        on the character sheet does it automatically
//
// DISPLAY: posts a public chat message every time the pool changes, and
// keeps it visible in two places that don't require re-opening chat:
//   1. If a token/graphic on the current page is named "Threat Pool"
//      (case-insensitive), its bar1 value and tooltip are kept in sync.
//      Skipped silently if no such graphic exists.
//   2. A pinned, custom (non-token) entry at the top of the Turn Order
//      tracker reading "Threat Pool: N".
//
// Logging: this script logs every chat message it sees (same as
// ccmomentum.js) to make debugging easier - kept in deliberately, not a
// temporary scaffold to be removed later.
on('ready', () => {
  'use strict';

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

  // Any graphic on the current page named "Threat Pool" gets its bar1
  // driven by the pool, the same way ccmomentum.js drives a "Momentum
  // Pool" token. Entirely optional - if the GM never places one, this
  // just finds nothing and does nothing.
  const updateTokenDisplay = () => {
    const page = Campaign() && Campaign().get('playerpageid');
    if (!page) { return; }
    const tokens = findObjs({_type: 'graphic', _pageid: page}) || [];
    const pool = getPool();
    tokens
      .filter((token) => String(token.get('name') || '').trim().toLowerCase() === TOKEN_NAME)
      .forEach((token) => {
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
    const withoutOurs = turnOrder.filter((item) => item && item.id !== TURN_ORDER_ID);
    campaign.set('turnorder', JSON.stringify([entry, ...withoutOurs]));
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

  // Pulls the numeric delta out of the hidden ccthreatsignal roll. See
  // ccmomentum.js's extractMomentumSignalDelta for the full explanation -
  // same mechanism, different field name so the two scripts never
  // collide.
  const extractThreatSignalDelta = (msg) => {
    const content = String(msg.content || '');
    if (!content.includes('{{ccthreatdelta=')) { return null; }
    const rolls = Array.isArray(msg.inlinerolls) ? msg.inlinerolls : [];
    if (!rolls.length) {
      log(`[CCThreat] ccthreatdelta message with no inlinerolls - raw msg: ${JSON.stringify(msg)}`);
      return null;
    }
    const total = rolls[0] && rolls[0].results && rolls[0].results.total;
    if (!Number.isFinite(total)) {
      log(`[CCThreat] ccthreatdelta inlinerolls[0] had no usable .results.total - raw msg: ${JSON.stringify(msg)}`);
      return null;
    }
    return total;
  };

  const handleMessage = (msg) => {
    // Unconditional diagnostic - logs every chat message this script
    // sees (type, raw content, and any inlinerolls), same as
    // ccmomentum.js, kept in deliberately to make debugging easier.
    log(`[CCThreat] chat:message type=${msg.type} content=${JSON.stringify(msg.content)} inlinerolls=${JSON.stringify(msg.inlinerolls)}`);

    const signalDelta = extractThreatSignalDelta(msg);
    if (signalDelta !== null) {
      if (Number.isFinite(signalDelta) && signalDelta !== 0) {
        setPool(getPool() + signalDelta);
        announce(formatDelta(signalDelta));
      }
      return;
    }

    const content = String(msg.content || '');
    const trimmed = content.trim();
    const [command, ...args] = trimmed.split(/\s+/);
    if (!command) { return; }

    // Manual/legacy alias for the same adjustment the hidden signal above
    // makes automatically - kept for testing from chat directly (e.g.
    // `!ccthreat-adjust 2`), not something the sheet itself sends.
    if (command === '!ccthreat-adjust') {
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
        sendChat('Threat Pool', `/w "${msg.who}" Only the GM can set the Threat pool directly.`);
        return;
      }
      const value = Number(args[0]);
      if (!Number.isFinite(value)) {
        sendChat('Threat Pool', `/w "${msg.who}" Usage: !threat-set <number>`);
        return;
      }
      setPool(value);
      announce('set by GM');
      return;
    }

    if (command === '!threat-adjust') {
      if (!playerIsGM(msg.playerid)) {
        sendChat('Threat Pool', `/w "${msg.who}" Only the GM can manually adjust the Threat pool.`);
        return;
      }
      const delta = Number(args[0]);
      if (!Number.isFinite(delta)) {
        sendChat('Threat Pool', `/w "${msg.who}" Usage: !threat-adjust <number, may be negative>`);
        return;
      }
      setPool(getPool() + delta);
      announce(`${formatDelta(delta)}, GM`);
      return;
    }
  };

  on('chat:message', handleMessage);

  // Re-show the pinned Turn Order entry (and re-sync any Threat Pool
  // token) on script load, e.g. after the game/sandbox restarts, so it
  // doesn't take a roll or a command to reappear.
  refreshDisplays();

  log(`Cohors Cthulhu Threat pool ready. Current pool: ${getPool()}`);
});
