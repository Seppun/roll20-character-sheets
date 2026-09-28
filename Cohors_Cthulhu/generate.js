//Require the K-scaffold that we installed via NPM
const k = require('@kurohyou/k-scaffold');
const fs = require("fs");

const kOpts = {
    destination: '.',
    testDestination: './__tests__',
    source: './source',
    pugOptions: { "require": require, "fs": fs },
    // 'compressed' strips CSS comments (among other things). Roll20's
    // roll-template CSS pipeline has a known, documented bug where a
    // /* ... */ comment block ANYWHERE in the pasted stylesheet silently
    // breaks styling for roll templates specifically, while the sheet's
    // own CSS keeps working fine (see Roll20 forum threads on
    // "rolltemplate styling not registering" / "CSS does not apply to
    // roll templates"). k-scaffold's own default styles (materialIcons)
    // include a couple of harmless comments that were enough to trigger
    // this - not something we authored or can remove from our own source.
    scssOptions: { style: 'compressed' },
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
