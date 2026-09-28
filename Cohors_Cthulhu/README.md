# Cohors Cthulhu sheet

This folder contains the source code for the Roll20 VTT sheet for
Cohors Cthulhu, a Roman-legion / Cthulhu Mythos horror game built on
Modiphius's 2d20 System.

Maintained by Han Vanholder.

## Tools

This sheet is built with [k-scaffold](https://kurohyou-studios.github.io/k-scaffold/),
a PUG/SCSS framework for Roll20 character sheets.

- [PUG](https://pugjs.org/api/getting-started.html) compiles the sheet's HTML from
  the `.pug` source files.
- [SCSS](https://sass-lang.com/documentation/syntax) compiles the sheet's CSS from
  the `.scss` source files.
- [node.js](https://nodejs.org/en/) and `npm` build the sheet from source.

### Development environment

- Install `npm` (via [`nvm`](https://github.com/nvm-sh/nvm) is recommended).
- Run `npm install` in this directory to install dependencies.

### Building the sheet

```bash
npm run build
```

compiles the sheet once. To watch source files and rebuild on change:

```bash
npm run start
```

All source files live in `source/`. The compiled `Cohors_Cthulhu.html` and
`Cohors_Cthulhu.css` are generated at the root of this folder and should not
be edited directly.

## Status

Work in progress. Current stage: build pipeline scaffold, static layout not
yet implemented.
