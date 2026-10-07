//Require the K-scaffold that we installed via NPM
const k = require('@kurohyou/k-scaffold');
const fs = require("fs");

const kOpts = {
    destination: '.',
    testDestination: './__tests__',
    source: './source',
    pugOptions: { "require": require, "fs": fs },
    // Readable CSS with comments; comments don't affect roll-template
    // styling.
    scssOptions: { style: 'expanded' },
};

// The CSS loads images from Roll20's repo, where they only exist once the
// sheet is merged. Cohors_Cthulhu.test.css loads them from the fork's
// Cohors_Cthulhu branch instead, for test games before the merge. It's
// committed with every build, and left out of the Roll20 submission.
const ROLL20_IMAGES = 'https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/Cohors_Cthulhu/images/';
const TEST_IMAGES = 'https://raw.githubusercontent.com/Seppun/roll20-character-sheets/Cohors_Cthulhu/Cohors_Cthulhu/images/';

if (process.argv[2] === '--watch') {
    kOpts.watch = true;
    k.all(kOpts);
} else {
    k.all(kOpts).then(() => {
        const css = fs.readFileSync('Cohors_Cthulhu.css', 'utf8');
        fs.writeFileSync('Cohors_Cthulhu.test.css', css.split(ROLL20_IMAGES).join(TEST_IMAGES));
        // Local additions kept outside the published sheet, if present.
        if (fs.existsSync('./private/build.js')) { require('./private/build.js'); }
    });
}
