#!/usr/bin/env node

'use strict';

const { program } = require('commander');
const process = require('process');
const fse = require('fs-extra');
const path = require('path');
const t = require('./lib/template')(true);

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

    // Text normalize
    // Remove empty lines at the beginning of text
    text = text.replace(/^([ \t]*\n)*/, '');
    // Remove empty lines at the end of text
    text = text.replace(/([ \t]*\n)*$/, '');
    // Remove white spaces at the end of each line
    text = text.replace(/[ \t]+$/mg, '');

    // Extract reference titles
    const refTitles = ((doc) => {
        let res = []
        doc.replace(/(?<=\n[ \t]*\[)(\d+)\] ((.+\n)+\n)/g, (_, ind, ref) => {
            let match, title;
            if ((match = /"(.*)"/s.exec(ref)) !== null)
                title = match[1].replace(/[ \t]*\n[ \t]*/g, ' ');
            else
                title = ref.split('.')[0];
            res[ind] = title;
        });
        return res;
    })(text);

    { // Insert RFC links with index of section
        // Match 'section 1.1 of RFC 0000'
        text = text.replace(/section (\d+(?:\.\d+)*) of RFC (\d+)/ig, (mat, sind, rind) => t.enc(t.rfc_sec, rind, sind, mat));
        // Match 'section\n 1.1\n of\n RFC\n 0000'
        text = text.replace(/section(?:(?:\n[ \t]*)| )(\d+(?:\.\d+)*)(?:(?:\n[ \t]*)| )of(?:(?:\n[ \t]*)| )RFC(?:(?:\n[ \t]*)| )(\d+)/ig, (mat, sind, rind) => {
            return mat.replace(/(.*)(\n[ \t]*)(.*)/g, (_, p1, mid, p2) => t.enc(t.rfc_sec, rind, sind, p1) + mid + t.enc(t.rfc_sec, rind, sind, p2));
        });
    }

    { // Insert section and page links in Table of Contents
        // Match '   1.1  Introduction .................... 10'
        text = text.replace(/(?<=^[ \t]*)(\d+(?:\.\d+)*)(  .+\.+)(\d+)$/mg, (_, sind, mid, pind) => t.enc(t.to_sec, sind, sind) + mid + t.enc(t.to_page, pind));
    }

    { // Insert section links
        // Match 'section 1.1'
        text = text.replace(/section (\d+(\.\d+)*)/ig, (mat, ind) => t.enc(t.to_sec, ind, mat));
        // Match 'section\n 1.1'
        text = text.replace(/(section)(\n[ \t]*)(\d+(\.\d+)*)/ig, (_, sec, mid, ind) => t.enc(t.to_sec, ind, sec) + mid + t.enc(t.to_sec, ind, ind));
        // Match 'sections 1.1, 2.2, 3.3'
        text = text.replace(/(?<=sections?)(((,?( |\n *)|,?( |\n *)and( |\n *))(\d+(\.\d+)*)){2,})/ig, (_, secs) => {
            return secs.replace(/\d+(\.\d+)*/g, (_, ind) => t.enc(t.to_sec, ind, ind));
        });
    }

    { // Insert RFC links
        // Match 'Obsoletes: 0000'
        text = text.replace(/(?<=Obsoletes: )(\d+)/, (_, ind) => t.enc(t.rfc, ind, ind));
        // Match 'RFC 0000' or 'RFCs 0000'
        text = text.replace(/RFCs? (\d+)/g, (mat, ind) => t.enc(t.rfc, ind, mat));
        // Match 'RFC\n    0000' or 'RFCs\n    0000'
        // Tip: In RFC 2616, section 3.2.1, it says 'RFCs\n   1738'
        text = text.replace(/(RFCs?)(\n[ \t]*)(\d+)/g, (_, rfc, mid, ind) => t.enc(t.rfc, ind, rfc) + mid + t.enc(t.rfc, ind, ind));
        // Match 'rfc0000'
        text = text.replace(/rfc(\d+)/g, (mat, ind) => t.enc(t.rfc, ind, mat));
    }

    { // Insert reference links
        // Match '\n   [1] '
        text = text.replace(/(?<=\n[ \t]*\[)(\d+)(?=\] (.+\n)+\n)/g, (_, ind) => t.enc(t.ref, ind));
        // Match rest '[1]'
        text = text.replace(/(?<=\[)(\d+)(?=\])/g, (_, ind) => t.enc(t.to_ref, ind, refTitles[ind]));
    }

    text = escapeHtml(text);
    text = text.replace(t.pattern, t.decode);
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
