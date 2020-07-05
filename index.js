#!/usr/bin/env node

'use strict';

const { program } = require('commander');
const process = require('process');
const fse = require('fs-extra');
const path = require('path');
const t = require('./lib/template')(false);

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
    text = text.replace(/([ \t\f]*\n)*$/, '');
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
        // Match Table of Contents
        text = text.replace(/\n(([ \t]*\d+(\.\d+)*.*\d+\n)+(([RF].*)?\n|\f)+)+/, (tab) => {
            // Match '   1.1  Introduction .................... 10'
            return tab.replace(/(?<=^[ \t]*)(\d+(?:\.\d+)*)(.*?)(\d+)$/mg, (_, sind, mid, pind) => {
                return t.enc(t.to_sec, sind, sind) + mid + t.enc(t.to_page, pind)
            });
        });
        // text = text.replace(/(?<=^[ \t]*)(\d+(?:\.\d+)*)(  .+\.+)(\d+)$/mg, (_, sind, mid, pind) => t.enc(t.to_sec, sind, sind) + mid + t.enc(t.to_page, pind));
    }

    { // Insert section links
        // Match 'sections 1.1, 2.2, 3.3'
        // Tip: In RFC 2616, page 173, it says '(Section 10.4.17, 14.16)'
        text = text.replace(/(?<=sections?)(((,?( |\n *)|,?( |\n *)and( |\n *))(\d+(\.\d+)*)){2,})/ig, (_, secs) => {
            return secs.replace(/\d+(\.\d+)*/g, (ind) => t.enc(t.to_sec, ind, ind));
        });
        // Match 'section 1.1'
        text = text.replace(/section (\d+(\.\d+)*)/ig, (mat, ind) => t.enc(t.to_sec, ind, mat));
        // Match 'section\n 1.1'
        text = text.replace(/(section)(\n[ \t]*)(\d+(\.\d+)*)/ig, (_, sec, mid, ind) => t.enc(t.to_sec, ind, sec) + mid + t.enc(t.to_sec, ind, ind));
    }

    { // Insert section links and markup section titles
        // Match '1.1 title'
        // Tip: In RFC 2616, section 21, it says '21.  Full Copyright Statement'
        // Tip: In RFC 2616, page 170, it says '19.6.1.1 Changes to Simplify Multi-homed Web Servers and Conserve IP\n         Addresses'
        text = text.replace(/(?<=\n)(?:\d+(:?\.\d+)*)\.? +(?:.*?)(?=\n\n)/sg, (title) => {
            return title
                .replace(/^\d+(:?\.\d+)*/, (ind) => t.enc(t.sec, ind))
                .replace(/(?<=^[ \t]*)\S.*(?=$)/mg, (title) => t.enc(t.title, title));
        });
    }

    { // Markup main title
        text = text.replace(/(?<=\n\n[ \t]*)\S.*(?=\n\n)/, (title) => t.enc(t.title, title));
    }

    { // Insert page links
        // Match '...\n...\n...\n...[Page 1]\n'
        text = text.replace(/.*?\[Page (\d+)\]\n/sg, (mat, ind) => t.enc(t.page, ind) + mat);
    }

    { // Insert RFC links
        // Match 'Obsoletes: 0000'
        text = text.replace(/(?<=Obsoletes: )(\d+)/, (_, ind) => t.enc(t.rfc, ind, ind));
        // Match 'RFC 0000' or 'RFCs 0000'
        text = text.replace(/RFCs? (\d+)/g, (mat, ind) => t.enc(t.rfc, ind, mat));
        // Match 'RFC\n    0000' or 'RFCs\n    0000'
        // Tip: In RFC 2616, section 3.2.1, it says 'RFCs\n   1738'
        text = text.replace(/(RFCs?)(\n[ \t]*)(\d+)/g, (_, rfc, mid, ind) => t.enc(t.rfc, ind, rfc) + mid + t.enc(t.rfc, ind, ind));
        // Match 'rfc0000' or 'rfc-0000'
        // Tip: In RFC 2616, section 19.3, it says 'assume that an RFC-850 date'
        text = text.replace(/rfc-?(\d+)/ig, (mat, ind) => t.enc(t.rfc, ind, mat));
    }

    { // Insert BCP links
        // Match 'BCP 00'
        text = text.replace(/BCP (\d+)/g, (mat, ind) => t.enc(t.bcp, ind, mat));
        // Match 'BCP\n    00'
        text = text.replace(/(BCP)(\n[ \t]*)(\d+)/g, (_, bcp, mid, ind) => t.enc(t.bcp, ind, bcp) + mid + t.enc(t.bcp, ind, ind));
    }

    { // Insert reference links
        // Match '\n   [1] '
        text = text.replace(/(?<=\n[ \t]*\[)(\d+)(?=\] (.+\n)+\n)/g, (_, ind) => t.enc(t.ref, ind));
        // Match rest '[1]'
        text = text.replace(/(?<=\[)(\d+)(?=\])/g, (_, ind) => t.enc(t.to_ref, ind, refTitles[ind]));
    }

    { // Insert horizontal lines as page break
        // Match '\f'
        text = text.replace(/\f/g, t.enc(t.hr));
    }

    { // Insert URL links
        // Tip: In RFC 2616, page 160, it says '<URL: http://www.isi.edu/touch/pubs/http-perf96/>'
        text = text.replace(/(?<=<URL: )http:\/\/\S+(?=>)/g, (uri) => t.enc(t.uri, uri));
        // Match general URI
        text = text.replace(/http:\/\/\S+/g, (uri) => t.enc(t.uri, uri));
    }

    text = escapeHtml(text);
    text = t.iteDec(text);
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
