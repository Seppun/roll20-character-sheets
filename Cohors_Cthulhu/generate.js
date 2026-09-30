//Require the K-scaffold that we installed via NPM
const k = require('@kurohyou/k-scaffold');
const fs = require("fs");

const kOpts = {
    destination: '.',
    testDestination: './__tests__',
    source: './source',
    pugOptions: { "require": require, "fs": fs },
    // Previously compiled with style: 'compressed' to strip CSS comments,
    // after an earlier debugging session found that a /* ... */ comment
    // ANYWHERE in the pasted stylesheet (even k-scaffold's own harmless
    // "/* Preferred icon size */" comment in its bundled materialIcons
    // styles) silently broke roll-template styling in chat, while the
    // sheet's own CSS kept working fine. Re-tested live in a scratch
    // Roll20 sandbox campaign (a minimal custom sheet with a rolltemplate
    // styled via a child-wrapper rule, preceded by that exact comment
    // text) and the roll template rendered correctly - Roll20 no longer
    // reproduces the bug. Switched back to 'expanded' so the shipped CSS
    // stays human-readable with real comments, matching the .scss/.pug
    // source. If roll-template styling ever silently breaks again, the
    // CSS comments (not custom properties, which have their own separate,
    // still-live restriction inside +scss('roll') - see that file) are
    // the first thing to re-suspect.
    scssOptions: { style: 'expanded' },
};

if (process.argv[2] === '--watch') {
    kOpts.watch = true;
}

const cssPath = './Cohors_Cthulhu.css';

// k-scaffold's own default styles unconditionally bundle a modal component
// (.kmodal__outer/.kmodal__inner) that we never use anywhere in this sheet
// (no +modal/+collapsible in our source, and no kmodal-* elements in the
// compiled HTML) - it ships with position:fixed, which Roll20's chat
// pipeline treats as a security violation and, on detecting it ANYWHERE in
// the pasted stylesheet, throws out ALL roll-template styling for the
// whole file (confirmed directly via the console error "Potential CSS
// security violation; character sheet template styling thrown out").
// Since the modal is never rendered, swapping position:fixed for
// position:absolute here is behaviorally invisible and safe.
const patchCss = () => {
    if (!fs.existsSync(cssPath)) return;
    const css = fs.readFileSync(cssPath, 'utf8');
    if (!css.includes('position:fixed') && !css.includes('position: fixed')) return;
    const patched = css
        .replace(/position:\s*fixed/g, 'position: absolute');
    fs.writeFileSync(cssPath, patched);
};

if (kOpts.watch) {
    // k-scaffold's own watcher rewrites Cohors_Cthulhu.css on every source
    // change, which would undo a one-time patch - watch the output file
    // ourselves and re-patch it after every rebuild.
    fs.watchFile(cssPath, {interval: 500}, patchCss);
}

(async () => {
    await k.all(kOpts);
    patchCss();
})();
