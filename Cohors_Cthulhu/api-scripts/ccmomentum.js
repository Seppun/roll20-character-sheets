// api-scripts/ccmomentum.js
// Cohors Cthulhu - Global Momentum Pool
//
// Momentum in the 2d20 System is a shared party resource, not a
// per-character stat, so it can't live on the character sheet itself
// (each character's sheet only has its own private set of attributes -
// there's no "global" attribute shared across characters). This script
// maintains a single, game-wide Momentum pool in the API's own persistent
// state instead, kept in sync automatically by a hidden signal the
// character sheet itself sends on every roll (see ccSendMomentumSignal in
// source/views/_character.pug) - not something a player ever needs to
// type themselves.
//
// +1 to the pool per point of Momentum a passed roll generates.
// -1 per additional d20 bought (2d20 RAW: buying an extra d20 costs 1
//    Momentum each, whether or not the roll then succeeds).
// -1 per point of Extra Momentum a spellcaster declares spending (see the
//    Cast button's "Extra Momentum spent" prompt on the Spells tab).
//
// The signal itself is a whispered, hidden (display:none) roll using a
// dedicated template, ccmomentumsignal (rolltemplate/_index.pug) - sheet
// workers turned out to have no sendChat() of their own (confirmed live:
// calling it throws "sendChat is not defined"), so startRoll/a real dice
// roll is the only way sheet-worker code can reach chat at all. This
// script reads the delta from msg.inlinerolls[0].results.total - the API
// never renders roll templates to HTML at all (that only happens
// client-side, in a player's browser), so msg.content for a message
// containing [[...]] just holds the raw template invocation with a
// $[[0]] placeholder; the actually-computed value lives in the separate
// inlinerolls array Roll20 attaches to the message instead.
//
// INSTALL: This is a separate piece from the character sheet's own
// Layout/Style/Script boxes. In your Roll20 game: Game Settings > API
// Scripts > New Script, paste this whole file in, Save Script. This
// requires a Pro-tier game with the API sandbox enabled - the character
// sheet works fine without this script installed, the hidden signal just
// has nothing listening for it.
//
// CHAT COMMANDS:
//   !momentum            - announce the current pool value
//   !momentum-set N      - GM only: set the pool to an exact value
//   !momentum-adjust N   - GM only: add N (negative to subtract) - for
//                          manual corrections the automation doesn't cover
//
// DISPLAY: posts a public chat message every time the pool changes, and
// keeps it visible in two places that don't require re-opening chat:
//   1. If a token/graphic on the current page is named "Momentum Pool"
//      (case-insensitive, set by the GM once - any graphic works, e.g. a
//      spare token or a simple icon), its bar1 value and tooltip are kept
//      in sync, similar to a deck's visible card count sitting on the
//      tabletop. Skipped silently if no such graphic exists.
//   2. A pinned, custom (non-token) entry at the top of the Turn Order
//      tracker reading "Momentum Pool: N" - Roll20's closest built-in
//      equivalent to a persistent shared counter widget, and needs no
//      setup at all.
//
// This script's chat/state handling can only be verified in a live Roll20
// game (the API sandbox doesn't exist outside Roll20 itself), so test it
// at the table: make a roll on the sheet and confirm "Momentum Pool: ..."
// appears in chat, or run !momentum directly.

on('ready', () => {
  'use strict';

  const STATE_KEY = 'CCMomentum';
  const TURN_ORDER_ID = '-ccmomentum-pool';
  const TOKEN_NAME = 'momentum pool';

  if (!state[STATE_KEY] || typeof state[STATE_KEY].pool !== 'number') {
    state[STATE_KEY] = {pool: 0};
  }

  const getPool = () => Number(state[STATE_KEY].pool) || 0;

  const setPool = (value) => {
    state[STATE_KEY].pool = Math.max(0, Math.round(Number(value) || 0));
  };

  // Any graphic on the current page named "Momentum Pool" gets its bar1
  // driven by the pool, the same way a deck shows its remaining count
  // directly on the tabletop. Entirely optional - if the GM never places
  // one, this just finds nothing and does nothing.
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
          tooltip: `Momentum Pool: ${pool}`,
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
    sendChat('Momentum Pool', `&{template:default} {{name=Momentum Pool}} {{Current=${value}${suffix}}}`);
    refreshDisplays();
  };

  const formatDelta = (delta) => (delta > 0 ? `+${delta}` : `${delta}`);

  // Pulls the numeric delta out of the hidden ccmomentumsignal roll.
  // msg.content for a message with an inline roll ([[0+delta]] in the
  // sheet worker) holds the RAW template invocation with a $[[0]]
  // placeholder, not rendered HTML - the API never renders templates to
  // HTML at all (that's a client-side/browser step). The actual computed
  // value lives in msg.inlinerolls, a separate array Roll20 populates for
  // any message containing one or more [[...]] expressions.
  const extractMomentumSignalDelta = (msg) => {
    const content = String(msg.content || '');
    if (!content.includes('template:ccmomentumsignal')) { return null; }
    const rolls = Array.isArray(msg.inlinerolls) ? msg.inlinerolls : [];
    if (!rolls.length) {
      log(`[CCMomentum] ccmomentumsignal message with no inlinerolls - raw msg: ${JSON.stringify(msg)}`);
      return null;
    }
    const total = rolls[0] && rolls[0].results && rolls[0].results.total;
    if (!Number.isFinite(total)) {
      log(`[CCMomentum] ccmomentumsignal inlinerolls[0] had no usable .results.total - raw msg: ${JSON.stringify(msg)}`);
      return null;
    }
    return total;
  };

  const handleMessage = (msg) => {
    // Temporary, unconditional diagnostic - logs every chat message this
    // script sees (type, raw content, and any inlinerolls) while we
    // confirm the hidden signal actually reaches this handler at all.
    // Remove once the Momentum pool is confirmed working end to end.
    log(`[CCMomentum] chat:message type=${msg.type} content=${JSON.stringify(msg.content)} inlinerolls=${JSON.stringify(msg.inlinerolls)}`);

    const signalDelta = extractMomentumSignalDelta(msg);
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
    // `!ccmomentum-adjust 2`), not something the sheet itself sends.
    if (command === '!ccmomentum-adjust') {
      const delta = Number(args[0]);
      if (!Number.isFinite(delta) || delta === 0) { return; }
      setPool(getPool() + delta);
      announce(formatDelta(delta));
      return;
    }

    if (command === '!momentum') {
      announce();
      return;
    }

    if (command === '!momentum-set') {
      if (!playerIsGM(msg.playerid)) {
        sendChat('Momentum Pool', `/w "${msg.who}" Only the GM can set the Momentum pool directly.`);
        return;
      }
      const value = Number(args[0]);
      if (!Number.isFinite(value)) {
        sendChat('Momentum Pool', `/w "${msg.who}" Usage: !momentum-set <number>`);
        return;
      }
      setPool(value);
      announce('set by GM');
      return;
    }

    if (command === '!momentum-adjust') {
      if (!playerIsGM(msg.playerid)) {
        sendChat('Momentum Pool', `/w "${msg.who}" Only the GM can manually adjust the Momentum pool.`);
        return;
      }
      const delta = Number(args[0]);
      if (!Number.isFinite(delta)) {
        sendChat('Momentum Pool', `/w "${msg.who}" Usage: !momentum-adjust <number, may be negative>`);
        return;
      }
      setPool(getPool() + delta);
      announce(`${formatDelta(delta)}, GM correction`);
      return;
    }
  };

  on('chat:message', handleMessage);

  // Re-show the pinned Turn Order entry (and re-sync any Momentum Pool
  // token) on script load, e.g. after the game/sandbox restarts, so it
  // doesn't take a roll or a command to reappear.
  refreshDisplays();

  log(`Cohors Cthulhu Momentum pool ready. Current pool: ${getPool()}`);
});
