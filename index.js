#!/usr/bin/env node

'use strict';

const { program } = require('commander');
const process = require('process');
const fse = require('fs-extra');
const path = require('path');

program
    .requiredOption('-i, --input <file>', 'Input file')
    .option('-o, --output <file>', 'Input file')
    .parse(process.argv);

const args = {};
args.inFile = program.input;
args.dir = path.dirname(args.inFile);
args.ext = path.extname(args.inFile);
args.base = path.basename(args.inFile, args.ext);
args.dftFile = path.join(args.dir, `${args.base}.html`);
args.outFile = program.output || args.dftFile;

(async () => {
    let text = '' + await fse.readFile(args.inFile);

    { // Text normalize
        // Remove empty lines at the beginning of text
        text = text.replace(/^([ \t]*\n)*/, '');
        // Remove empty lines at the end of text
        text = text.replace(/([ \t]*\n)*$/, '');
        // Remove white spaces at the end of each line
        text = text.replace(/[ \t]+$/mg, '');
    }

    // Escape html special characters before insert html elements 
    text = escapeHtml(text);

    { // Insert RFC links
        const rfcLinkBgnSgn = 'rfcLinkBgnSgn';
        const rfcLinkEndSgn = 'rfcLinkEndSgn';
        const rfcLinkBgn = 'https://www.rfc-editor.org/rfc/rfc';
        const rfcLinkEnd = '.html';
        // Match 'Obsoletes: 0000'
        text = text.replace(/(Obsoletes: )(\d+)/, `$1<a href="${rfcLinkBgnSgn}$2${rfcLinkEndSgn}">$2</a>`);
        // Match 'RFC 0000' or 'RFCs 0000'
        text = text.replace(/(RFCs? (\d+))/g, `<a href="${rfcLinkBgnSgn}$2${rfcLinkEndSgn}">$1</a>`);
        // Match 'RFC\n    0000' or 'RFCs\n    0000'
        // Tip: In RFC 2616, section 3.2.1, it says 'RFCs\n   1738'
        text = text.replace(/(RFCs?)(\n[ \t]*)(\d+)/g, `<a href="${rfcLinkBgnSgn}$3${rfcLinkEndSgn}">$1</a>$2<a href="${rfcLinkBgnSgn}$3${rfcLinkEndSgn}">$3</a>`);
        // Match 'rfc0000'
        text = text.replace(/(rfc(\d+))/g,`<a href="${rfcLinkBgnSgn}$2${rfcLinkEndSgn}">$1</a>`);
        // End work
        text = text.replace(rfcLinkBgnSgn,rfcLinkBgn);
        text = text.replace(rfcLinkEndSgn,rfcLinkEnd);
    }

    {
        text = '<pre>' + text + '</pre>';
    }

    await fse.writeFile(args.outFile, text);
    console.log('Done');
})().catch(e => console.log(e));

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
