#!/usr/bin/env node

'use strict';

const { program } = require('commander');
const process = require('process');
const fse = require('fs-extra');
const path = require('path');
const M = require('./lib/markup')(true);

program
    .requiredOption('-i, --input <file>', 'Input file')
    .option('-o, --output <file>', 'Input file')
    .option('-d, --debug', 'Debug mode')
    .parse(process.argv);

const args = {};
args.inFile = program.input;
args.dir = path.dirname(args.inFile);
args.ext = path.extname(args.inFile);
args.base = path.basename(args.inFile, args.ext);
args.dftFile = path.join(args.dir, `${args.base}.html`);
args.outFile = program.output || args.dftFile;
args.debug = program.debug;

(async () => {
    let text = '' + await fse.readFile(args.inFile);

    text = M.do(text);

    await fse.writeFile(args.outFile, text);
    console.log('Done');
})().catch(e => console.log(e));
