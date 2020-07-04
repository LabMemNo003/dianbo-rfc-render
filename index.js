#!/usr/bin/env node

'use strict';

const { program } = require('commander');
const process = require('process');
const fse = require('fs-extra');
const path = require('path');

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

const rfcLinkBgnSgn = 'rfcLinkBgnSgn';
const rfcLinkEndSgn = 'rfcLinkEndSgn';
const rfcLinkBgn = 'https://www.rfc-editor.org/rfc/rfc';
const rfcLinkEnd = '.html';
const refTitles = [];

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

    { // Extract reference titles
        text.replace(/(?<=\n[ \t]*\[)(\d+)\] ((.+\n)+\n)/g, (_, ind, ref) => {
            let match, title;
            if ((match = /"(.*)"/s.exec(ref)) !== null)
                title = match[1].replace(/[ \t]*\n[ \t]*/g, ' ');
            else
                title = ref.split('.')[0];
            refTitles[ind] = title;
        });
    }

    // Escape html special characters before insert html elements 
    text = escapeHtml(text);

    { // Insert RFC links
        let tpl_rfc = (ind, txt) => `<a href="${rfcLinkBgnSgn}${ind}${rfcLinkEndSgn}">${txt}</a>`;
        if (args.debug) tpl_rfc = tpl_debug(tpl_rfc, 'red');
        // Match 'Obsoletes: 0000'
        text = text.replace(/(?<=Obsoletes: )(\d+)/, tpl_rfc('$1', '$1'));
        // Match 'RFC 0000' or 'RFCs 0000'
        text = text.replace(/(RFCs? (\d+))/g, tpl_rfc('$2', '$1'));
        // Match 'RFC\n    0000' or 'RFCs\n    0000'
        // Tip: In RFC 2616, section 3.2.1, it says 'RFCs\n   1738'
        text = text.replace(/(RFCs?)(\n[ \t]*)(\d+)/g, `${tpl_rfc('$3', '$1')}$2${tpl_rfc('$3', '$3')}`);
        // Match 'rfc0000'
        text = text.replace(/(rfc(\d+))/g, tpl_rfc('$2', '$1'));
        // End work
        text = text.replace(rfcLinkBgnSgn, rfcLinkBgn);
        text = text.replace(rfcLinkEndSgn, rfcLinkEnd);
    }

    { // Insert reference links
        let tpl_ref = (id) => `<a id="ref-${id}">${id}</a>`;
        let tpl_to_ref = (id) => `<a href="#ref-${id}" title="${refTitles[id]}">${id}</a>`;
        if (args.debug) tpl_ref = tpl_debug(tpl_ref, 'lightblue');
        if (args.debug) tpl_to_ref = tpl_debug(tpl_to_ref, 'cyan');
        // Match '\n   [1] '
        text = text.replace(/(?<=\n[ \t]*\[)(\d+)(?=\] (.+\n)+\n)/g, tpl_ref('$1'));
        // Match rest '[1]'
        text = text.replace(/(?<=\[)(\d+)(?=\])/g, (_, ind) => tpl_to_ref(ind));
    }

    text = '<pre>' + text + '</pre>';

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

function tpl_debug(tpl, color) {
    return (...args) => `<span style="background-color:${color};">${tpl(...args)}</span>`;
}
