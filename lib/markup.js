'use strict';

const T = require('./template');

module.exports = Markup;

function Markup(debug) {
    T(debug);
    return Markup;
}

Markup.do = (text) => {
    // The order matters
    text = Markup.norm(text);

    text = Markup.title(text);
    text = Markup.table(text);
    text = Markup.ref(text);
    text = Markup.page(text);
    text = Markup.header(text);
    text = Markup.footer(text);
    text = Markup.detial(text);

    text = Markup.rfc(text);
    text = Markup.bcp(text);
    text = Markup.sec(text);
    text = Markup.url(text);

    text = Markup.hr(text);

    text = T.escapeHtml(text);
    text = T.iteDec(text);
    text = '<pre>' + text + '</pre>';

    return text;
};

// Text normalize
Markup.normalize = Markup.norm = (text) => {
    // Remove empty lines at the beginning of text
    text = text.replace(/^([ \t]*\n)*/, '');
    // Remove empty lines at the end of text
    text = text.replace(/([ \t\f]*\n)*$/, '');
    // Remove white spaces at the end of each line
    text = text.replace(/[ \t]+$/mg, '');

    return text;
};

// Markup titles
Markup.title = (text) => {
    // Markup main title
    // Match the first non-empty line between two empty lines
    text = text.replace(/(?<=\n\n[ \t]*)\S.*(?=\n\n)/, (title) => T.enc(T.title, title));

    // Markup section titles
    // Insert section links and markup section titles
    // Match '1.1 title'
    // Tip: In RFC 2616, section 21, it says '21.  Full Copyright Statement'
    // Tip: In RFC 2616, page 170, it says '19.6.1.1 Changes to Simplify Multi-homed Web Servers and Conserve IP\n         Addresses'
    text = text.replace(/(?<=\n)(?:\d+(:?\.\d+)*)\.? +(?:.*?)(?=\n\n)/sg, (title) => {
        // There may some RFC references in the title, markup them before encode
        // Tip: In RFC 2616, page 167, it says '19.4 Differences Between HTTP Entities and RFC 2045 Entities'
        title = Markup.rfc(title);
        // Insert section links
        title = title.replace(/^\d+(:?\.\d+)*/, (ind) => T.enc(T.sec, ind));
        // Markup section titles
        title = title.replace(/(?<=^[ \t]*)\S.*(?=$)/mg, (title) => T.enc(T.title, title));

        return title;
    });

    return text;
};

// Makrup table of contents
Markup.table = Markup.tab = (text) => {
    // Match Table of Contents
    return text.replace(/\n(([ \t]*\d+(\.\d+)*.*\d+\n)+(([RF].*)?\n|\f)+)+/, (tab) => {
        // Match '   1.1  Introduction .................... 10'
        return tab.replace(/(?<=^[ \t]*)(\d+(?:\.\d+)*)(.*?)(\d+)$/mg, (_, sind, mid, pind) => {
            return T.enc(T.to_sec, sind, sind) + mid + T.enc(T.to_page, pind);
        });
    });
};

// Markup reference
Markup.reference = Markup.ref = (text) => {
    // Reference titles
    const refTitles = [];
    // Match references
    text = text.replace(/(?<=\n[ \t]*\[)(\d+)(\] +)((?:.+\n)+)(?=\n)/g, (_, ind, mid, ref) => {
        let match, title;
        if ((match = /"(.*)"/s.exec(ref)) !== null) // Match the reference title between double quotes
            title = match[1].replace(/[ \t]*\n[ \t]*/g, ' ');
        else // Use the first word of reference as title
            title = ref.split('.')[0];
        refTitles[ind] = title;

        // Markup reference index (set 'ref-xx' like id)
        return T.enc(T.ref, ind) + mid + ref;
    });

    // Markup rest reference index in text (set '#ref-xx' like href)
    text = text.replace(/(?<=\[)(\d+)(?=\])/g, (_, ind) => T.enc(T.to_ref, ind, refTitles[ind]));

    return text;
};

// Markup page
Markup.page = (text) => {
    // Match '...\n...\n...\n...[Page 1]\n'
    return text.replace(/(?<=^|\n\f.*)\n.*?\[Page (\d+)\](?=\n\f.*\n|$)/sg, (mat, ind) => T.enc(T.page, ind) + mat);
};

// Markup footer
Markup.footer = (text) => {
    // Match the last line before '\n\f.*\n' or at the end of document
    return text.replace(/(?<=\n).*(?=\n\f.*\n)/g, (mat) => T.enc(T.footer, mat));
};

// Markup header
Markup.header = (text) => {
    // Match the first after '\n\f.*\n'
    return text.replace(/(?<=\n\f.*\n).*(?=\n)/g, (mat) => {
        // Markup RFC reference in header
        mat = Markup.rfc(mat);
        return T.enc(T.header, mat);
    });
};

// Markup others
Markup.detial = (text) => {
    // Match 'Obsoletes: 0000'
    text = text.replace(/(?<=Obsoletes: )(\d+)/, (_, ind) => T.enc(T.rfc, ind, ind));

    return text;
}

// -----------------------------------------------------------------------------

// Markup RFC reference
Markup.rfc = (text) => {
    // RFC links with index of section
    // Match 'section 1.1 of RFC 0000'
    text = text.replace(/section (\d+(?:\.\d+)*) of RFC (\d+)/ig, (mat, sind, rind) => T.enc(T.rfc_sec, rind, sind, mat));
    // Match 'section\n 1.1\n of\n RFC\n 0000'
    text = text.replace(/section(?:(?:\n[ \t]*)| )(\d+(?:\.\d+)*)(?:(?:\n[ \t]*)| )of(?:(?:\n[ \t]*)| )RFC(?:(?:\n[ \t]*)| )(\d+)/ig, (mat, sind, rind) => {
        return mat.replace(/(.*)(\n[ \t]*)(.*)/g, (_, p1, mid, p2) => T.enc(T.rfc_sec, rind, sind, p1) + mid + T.enc(T.rfc_sec, rind, sind, p2));
    });

    // General RFC links
    // Match 'RFC 0000' or 'RFCs 0000'
    text = text.replace(/RFCs? (\d+)/g, (mat, ind) => T.enc(T.rfc, ind, mat));
    // Match 'RFC\n    0000' or 'RFCs\n    0000'
    // Tip: In RFC 2616, section 3.2.1, it says 'RFCs\n   1738'
    text = text.replace(/(RFCs?)(\n[ \t]*)(\d+)/g, (_, rfc, mid, ind) => T.enc(T.rfc, ind, rfc) + mid + T.enc(T.rfc, ind, ind));
    // Match 'rfc0000' or 'rfc-0000'
    // Tip: In RFC 2616, section 19.3, it says 'assume that an RFC-850 date'
    text = text.replace(/rfc-?(\d+)/ig, (mat, ind) => T.enc(T.rfc, ind, mat));

    return text;
};

// Markup BCP reference
Markup.bcp = (text) => {
    // Match 'BCP 00'
    text = text.replace(/BCP (\d+)/g, (mat, ind) => T.enc(T.bcp, ind, mat));
    // Match 'BCP\n    00'
    text = text.replace(/(BCP)(\n[ \t]*)(\d+)/g, (_, bcp, mid, ind) => T.enc(T.bcp, ind, bcp) + mid + T.enc(T.bcp, ind, ind));

    return text;
};

// Markup section reference (This should be done after markup rfc)
Markup.section = Markup.sec = (text) => {
    // Match 'sections 1.1, 2.2, 3.3'
    // Tip: In RFC 2616, page 173, it says '(Section 10.4.17, 14.16)'
    text = text.replace(/(?<=sections?)(((,?( |\n *)|,?( |\n *)and( |\n *))(\d+(\.\d+)*)){2,})/ig, (_, secs) => {
        return secs.replace(/\d+(\.\d+)*/g, (ind) => T.enc(T.to_sec, ind, ind));
    });
    // Match 'section 1.1'
    text = text.replace(/section (\d+(\.\d+)*)/ig, (mat, ind) => T.enc(T.to_sec, ind, mat));
    // Match 'section\n 1.1'
    text = text.replace(/(section)(\n[ \t]*)(\d+(\.\d+)*)/ig, (_, sec, mid, ind) => T.enc(T.to_sec, ind, sec) + mid + T.enc(T.to_sec, ind, ind));

    return text;
};

// Makrup URL
Markup.url = (text) => {
    // Tip: In RFC 2616, page 160, it says '<URL: http://www.isi.edu/touch/pubs/http-perf96/>'
    text = text.replace(/(?<=<URL: )http:\/\/\S+(?=>)/g, (uri) => T.enc(T.uri, uri));
    // Match general URI
    text = text.replace(/http:\/\/\S+/g, (uri) => T.enc(T.uri, uri));

    return text;
};

// -----------------------------------------------------------------------------

// Markup horizontal lines as page break
Markup.horizon = Markup.hr = (text) => {
    // Insert horizontal lines after \f
    return text.replace(/(?:\f)()/g, T.enc(T.hr));
};
