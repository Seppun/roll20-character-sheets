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
k.all(kOpts);
