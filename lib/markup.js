'use strict';

const T = require('./template');

module.exports = Markup;

function Markup(debug) {
    if (!!debug && !Markup.debugged) {
        Markup.debugged = true;
        if (debug === true) {
            T(true);
        } else if (typeof (debug) === 'string') {
            if (debug.includes('u')) Markup.debug.url = true;
            if (debug.includes('t')) Markup.debug.tpl = true;
            T(Markup.debug.tpl);
        } else {
            Markup.debug = debug;
            T(debug.tpl);
        }
    }
    return Markup;
}

Markup.debug = {};

Markup.do = (text) => {
    // The order matters
    text = Markup.norm(text);

    text = Markup.refSec(text);
    text = Markup.title(text);
    text = Markup.table(text);
    text = Markup.page(text);
    text = Markup.header(text);
    text = Markup.footer(text);
    text = Markup.detail(text);

    text = Markup.url(text);
    text = Markup.rfc(text);
    text = Markup.bcp(text);
    text = Markup.sec(text);
    text = Markup.appx(text);
    text = Markup.ref(text);

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
    text = text.replace(/(?<=\n\n[ \t]*)\S.*(?=\n\n)/, (title) => {
        // Markup RFC reference in main title
        // Tip: In RFC 8174, main title, it says 'Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words'
        title = Markup.rfc(title);
        return T.enc(T.title, title);
    });

    // Markup section titles
    // Insert section links and markup section titles
    // Match '1.1 title'
    // Tip: In RFC 2119, section 1, it says '1. MUST   This word, ...'
    // Tip: In RFC 2616, section 21, it says '21.  Full Copyright Statement'
    // Tip: In RFC 2616, page 170, it says '19.6.1.1 Changes to Simplify Multi-homed Web Servers and Conserve IP\n         Addresses'
    text = text.replace(/(?<=\n)(?:\d+(:?\.\d+)*)\.? +(?:\S+( |\n *)?)+(?=\n\n|   )/sg, (title) => {
        // There may some RFC references in the title, markup them before encode
        // Tip: In RFC 2616, page 167, it says '19.4 Differences Between HTTP Entities and RFC 2045 Entities'
        title = Markup.rfc(title);
        // Insert section links
        title = title.replace(/^\d+(:?\.\d+)*/, (ind) => T.enc(T.sec, ind));
        // Markup section titles
        title = title.replace(/(?<=^[ \t]*)\S.*(?=$)/mg, (title) => T.enc(T.title, title));

        return title;
    });

    // Markup appendix titles
    text = text.replace(/(?<=\n)(?:Appendix )?[A-Z](?:\.\d)*\. +(?:\S+ ?)+(?=\n\n)/sg, (title) => {
        // Insert appendix links
        title = title.replace(/^(?:Appendix )?([A-Z](?:\.\d)*)/, (appx, ind) => T.enc(T.appx, ind, appx));
        // Markup section titles
        title = T.enc(T.title, title);

        return title;
    });

    return text;
};

// Makrup table of contents
Markup.table = Markup.tab = (text) => {
    // Match Table of Contents which has the same format as it in RFC 2616
    return text.replace(/Table of Contents\n\n(([ \t]+.*\d+\n)+(\n\n\n\S.+\n\f\n\S.+\n\n\n)?)+/, (tab) => {
        // Match '   1.1  Introduction .................... 10'
        tab = tab.replace(/(?<=^[ \t]+)(\d+(?:\.\d+)*)(.*?)(\d+)$/mg, (_, sind, mid, pind) => {
            return T.enc(T.to_sec, sind, sind) + mid + T.enc(T.to_page, pind);
        });
        // Match 'Appendix A. Acknowledgements ...................37'
        tab = tab.replace(/(?<=^[ \t]+)(Appendix ([A-Z](?:\.\d)*))(.*?)(\d+)$/mg, (_, appx, aind, mid, pind) => {
            return T.enc(T.to_appx, aind, appx) + mid + T.enc(T.to_page, pind);
        });

        // Tip: In RFC 8174, page 2, it says 'Author's Address  . . . . . . . . . . . . . . . . . . . . . . . .   4'
        tab = tab.replace(/(?<=.*?(\. ){5,}.*)\d+$/mg, pind => T.enc(T.to_page, pind));

        return tab;
    });
};

// Markup reference sections (must be called before Markup.ref())
Markup.referenceSection = Markup.refSec = (text) => {
    // Reference titles
    Markup._refTitles = {};
    // Match reference sections
    return text.replace(/(?<=\n)(\d+(?:\.\d+)*\.? +.*References\n\n)(( +\[\S+\]\n?(( +[^\[\s].*\n)( +\S.*\n)*\n)+)|(\n*\S.*\n\f.*\n\S.*\n*))+/g, refSec => {
        // Match each reference
        return refSec.replace(/(?<=\n +\[)(\S+)(\]\n? +)((?: *\S.*\n)+)/g, (_, ind, mid, ref) => {
            let match, title;
            if ((match = /"(.*)"/s.exec(ref)) !== null) // Match the reference title between double quotes
                title = match[1].replace(/[ \t]*\n[ \t]*/g, ' ');
            else // Use the first word of reference as title
                title = ref.split('.')[0];
            Markup._refTitles[ind] = title;

            // Markup reference index (set 'ref-xx' like id)
            // return T.enc(T.ref,ind)+mid+ref;
            return T.enc(T.ref, ind, Markup.rfc(ind)) + mid + ref;
        })
    });
};

// Markup reference (must be called after Markup.refSec())
Markup.reference = Markup.ref = (text) => {
    // Iterate each reference index
    for (let ind in Markup._refTitles) {
        // Markup rest reference index in text (set '#ref-xx' like href)
        // text = text.replace(RegExp(`(?<=\\\[)${ind}(?=\\\])`, 'g'), T.enc(T.to_ref, ind, refTitles[ind]));

        text = text.replace(RegExp(`(?<=\\\[)${ind}(?=\\\])`, 'g'), (mat) => {
            // If reference index is a RFC reference, then use RFC link instead reference link
            mat = Markup.rfc(mat);
            if (mat === ind) return T.enc(T.to_ref, ind, Markup._refTitles[ind]);
            else return mat;
        });
    }

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
    return text.replace(/(?<=\n).*(?=\n\f.*\n|$)/g, (mat) => T.enc(T.footer, mat));
};

// Markup header
Markup.header = (text) => {
    // Match the first after '\n\f.*\n'
    return text.replace(/(?<=\n\f.*\n).*(?=\n)/g, (mat) => {
        // Markup RFC reference in header
        mat = mat.replace(/RFC (\d+)/g, (mat, ind) => T.enc(T.rfc, ind, mat, 'gray'));
        return T.enc(T.header, mat);
    });
};

// Markup others
Markup.detail = (text) => {
    // Match 'Obsoletes: 0000'
    text = text.replace(/(?<=Obsoletes: )(\d+)/, (_, ind) => T.enc(T.rfc, ind, ind));
    // Match 'Updates: xxxx'
    text = text.replace(/(?<=Updates: )(\d+)/, (_, ind) => T.enc(T.rfc, ind, ind));

    return text;
}

// -----------------------------------------------------------------------------

// Markup RFC reference
Markup.rfc = (text) => {
    // RFC links with index of section

    // Match 'section 1.1 of RFC 0000'
    text = text.replace(/section (\d+(?:\.\d+)*) of RFC (\d+)/ig, (mat, sind, rind) => T.enc(T.rfc_sec, rind, sind, mat));
    // Match 'section\n 1.1\n of\n RFC\n 0000'
    text = text.replace(/section(?:\n *| )(\d+(?:\.\d+)*)(?:\n *| )of(?:\n *| )RFC(?:\n *| )(\d+)/ig, (mat, sind, rind) => {
        return mat.replace(/(.*)(\n *)(.*)/g, (_, p1, mid, p2) => T.enc(T.rfc_sec, rind, sind, p1) + mid + T.enc(T.rfc_sec, rind, sind, p2));
    });
    // Match 'Section 1.1 of [RFC0000]'
    text = text.replace(/section (\d+(?:\.\d+)*) of \[RFC(\d+)\]/ig, (mat, sind, rind) => T.enc(T.rfc_sec, rind, sind, mat));
    // Match 'Section\n 1.1\n of\n [RFC0000]'
    text = text.replace(/section(?:\n *| )(\d+(?:\.\d+)*)(?:\n *| )of(?:\n *| )\[RFC(\d+)\]/ig, (mat, sind, rind) => {
        return mat.replace(/(.*)(\n *)(.*)/g, (_, p1, mid, p2) => T.enc(T.rfc_sec, rind, sind, p1) + mid + T.enc(T.rfc_sec, rind, sind, p2));
    });

    // Match 'RFC 0000 section 0.0'
    // Tip: In RFC 4648, page 14, it says '(RFC 3978 section 5.4)'
    text = text.replace(/RFC (\d+) section (\d+(?:\.\d+)*)/ig, (mat, rind, sind) => T.enc(T.rfc_sec, rind, sind, mat));
    // Match 'RFC\n 0000\n section\n 0.0'
    text = text.replace(/RFC(?:\n *| )(\d+)(?:\n *| )section(?:\n *| )(\d+(?:\.\d+)*)/ig, (mat, rind, sind) => {
        return mat.replace(/(.*)(\n *)(.*)/g, (_, p1, mid, p2) => T.enc(T.rfc_sec, rind, sind, p1) + mid + T.enc(T.rfc_sec, rind, sind, p2));
    });
    // Match '[RFC0000], Section 1.0'
    text = text.replace(/\[RFC(\d+)\], Section (\d+(?:\.\d+)*)/ig, (mat, rind, sind) => T.enc(T.rfc_sec, rind, sind, mat));
    // Match '[RFC0000],\n Section\n 1.0'
    // Tip: In RFC 6265, page 5, it says '([RFC2616], Section\n 1.3)'
    text = text.replace(/\[RFC(\d+)\],(?:\n *| )Section(?:\n *| )(\d+(?:\.\d+)*)/ig, (mat, rind, sind) => {
        return mat.replace(/(.*)(\n *)(.*)/g, (_, p1, mid, p2) => T.enc(T.rfc_sec, rind, sind, p1) + mid + T.enc(T.rfc_sec, rind, sind, p2));
    });

    // RFC links with index of appendix

    // Match '[RFC0000], Appendix A.1'
    // Tip: In RFC 6265, page 5, it says '[RFC5234], Appendix B.1'
    text = text.replace(/\[RFC(\d+)\], Appendix ([A-Z](\.\d)*)/g, (mat, rind, aind) => T.enc(T.rfc_appx, rind, aind, mat));

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
    // Exception: In RFC 8174, page 2, it says 'as described in Section 4.e of\n   the Trust Legal Provisions'
    text = text.replace(/(?<=as described in )Section 4\.e(?= of\n   the Trust Legal Provisions)/g, (mat) => T.enc(T.none, mat));

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

// Markup appendix reference (This should be done after markup rfc)
Markup.appendix = Markup.appx = (text) => {
    // Match 'Appendix A.1'
    return text.replace(/Appendix ([A-Z](?:\.\d)*)/g, (appx, ind) => T.enc(T.to_appx, ind, appx));
};

// Makrup URL (from specific to general)
Markup.url = (text) => {
    // Exceptions
    // Tip: In RFC 6265, page 33, it says 'http://example.com/foo/bar', 'https://example.com/'
    text = text.replace(/https?:\/\/example.com\S*/g, mat => T.enc(T.none, mat));

    // Tip: In RFC 2616, page 160, it says '<http://www.w3.org/pub/WWW/>'
    // Tip: In RFC 2616, page 160, it says '<URL: http://www.isi.edu/touch/pubs/http-perf96/>'
    // Tip: In RFC 6265, page 36, it says '<http://web.archive.org/web/\n 20020803110822/http://wp.netscape.com/newsref/std/\n cookie_spec.html>'
    text = text.replace(/(?<=<(URL: )?)https?:\/\/.+?(?=>)/sg, (mat) => {
        if (Markup.debug.url) console.log(mat);
        const uri = mat.replace(/\s/g, '');
        return mat.replace(/(?<=^ *)\S+(?= *$)/mg, txt => T.enc(T.uri, uri, txt));
    });
    // Tip: In RFC 8174, page 2, it says '(http://trustee.ietf.org/license-info)'
    text = text.replace(/(?<=\()https?:\/\/\S+(?=\))/g, (uri) => {
        if (Markup.debug.url) console.log(uri);
        return T.enc(T.uri, uri)
    });
    // Match the URI end with .html or .pdf
    text = text.replace(/https?:\/\/\S+.(html|pdf)/g, (uri) => {
        if (Markup.debug.url) console.log(uri);
        return T.enc(T.uri, uri)
    });
    // Match the URI end with .html or .pdf, and across two lines
    text = text.replace(/(https?:\/\/\S+)(\n[ \t]*)(\S+.(html|pdf))/g, (uri, p1, mid, p2) => {
        if (Markup.debug.url) console.log(uri);
        return T.enc(T.uri, p1 + p2, p1) + mid + T.enc(T.uri, p1 + p2, p2)
    });
    // Match the URI followed by a dot (not match the dot)
    // Tip: In RFC 4648, page 18, it says 'http://www.ietf.org/ipr.'
    text = text.replace(/https?:\/\/\S+[^.\s]/g, (uri) => {
        if (Markup.debug.url) console.log(uri);
        return T.enc(T.uri, uri)
    });

    return text;
};

// -----------------------------------------------------------------------------

// Markup horizontal lines as page break
Markup.horizon = Markup.hr = (text) => {
    // Insert horizontal lines after \f
    return text.replace(/(?:\f)()/g, T.enc(T.hr));
};
