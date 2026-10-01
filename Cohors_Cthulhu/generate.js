//Require the K-scaffold that we installed via NPM
const k = require('@kurohyou/k-scaffold');
const fs = require("fs");

const kOpts = {
    destination: '.',
    testDestination: './__tests__',
    source: './source',
    pugOptions: { "require": require, "fs": fs },
    // Compiles with real, readable CSS comments rather than a compressed/
    // comment-stripped build - see lessons_learned.md if roll-template
    // styling ever silently breaks again, since comments are one of a
    // short list of past (and possibly still-live) triggers for that.
    scssOptions: { style: 'expanded' },
};

if (process.argv[2] === '--watch') {
    kOpts.watch = true;
}

const cssPath = './Cohors_Cthulhu.css';

// k-scaffold's own default styles unconditionally bundle a modal component
// (.kmodal__outer/.kmodal__inner) that we never use anywhere in this sheet
// (no +modal/+collapsible in our source, and no kmodal-* elements in the
// compiled HTML) - it ships with position:fixed, which breaks Roll20
// roll-template styling sheet-wide if left in (see lessons_learned.md).
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
