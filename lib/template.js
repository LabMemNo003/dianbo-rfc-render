'use strict';

module.exports = Tpl;

function Tpl(debug) {
    if (debug) {
        for (let attr in Tpl) {
            if (Tpl[attr].cvt) {
                const cvtr = Tpl[attr];
                cvtr.cvt = cvtr.cvt.bind(cvtr);
                cvtr.cvt = Tpl.debug(cvtr.cvt, cvtr.debug.color);
            }
        }
    }
    return Tpl;
}

Tpl.pattern = /tpl_.*?_tpl/sg;

Tpl.encode = Tpl.enc = (cvtr, ...args) => {
    let dataList = args;
    dataList.push(cvtr.token);
    dataList = dataList.map(item => String(item));
    dataList = dataList.map(item => Tpl.escape(item));
    dataList = dataList.map(item => item.replace(/./sg, '=$&'));
    dataList = ['tpl', ...dataList, 'tpl'];
    return dataList.join('_');
};

Tpl.decode = Tpl.dec = (match) => {
    let dataList = match.split(/(?<=[^=](?:==)*)_/g);
    dataList = dataList.slice(1, dataList.length - 1);
    dataList = dataList.map(item => item.replace(/=(.)/sg, '$1'));
    dataList = dataList.map(item => Tpl.unescape(item));
    let token = dataList.pop();
    return Tpl[token].cvt(...dataList);
};

// Prevent encoded data from being escaped by html special characters.
Tpl.escape = (str) => {
    return str
        .replace(/=/g, "=eql;")
        .replace(/&/g, "=amp;")
        .replace(/</g, "=lt;")
        .replace(/>/g, "=gt;")
        .replace(/"/g, "=quot;")
        .replace(/'/g, "=#039;");
}

Tpl.unescape = (str) => {
    return str
        .replace(/=eql;/g, '=')
        .replace(/=amp;/g, '&')
        .replace(/=lt;/g, '<')
        .replace(/=gt;/g, '>')
        .replace(/=quot;/g, '"')
        .replace(/=#039;/g, "'");
}

Tpl.debug = (cvt, color) => {
    return (...args) => `<span style="background-color:${color};">${cvt(...args)}</span>`;
};

Tpl.rfc = {
    token: 'rfc',
    debug: { color: 'red' },
    cvt: (ind, txt) => `<a href="./rfc${ind}">${txt}</a>`,
    // linkBgn: 'https://www.rfc-editor.org/rfc/rfc',
    // linkEnd: '.html',
    // cvt: function (ind, txt) { return `<a href="${this.linkBgn}${ind}${this.linkEnd}">${txt}</a>`; },
};

Tpl.rfc_sec = {
    token: 'rfc_sec',
    debug: { color: 'gray' },
    cvt: (rind, sind, txt) => `<a href="./rfc${rind}#sec-${sind}">${txt}</a>`,
    // linkBgn: 'https://www.rfc-editor.org/rfc/rfc',
    // linkEnd: '.html#section-',
    // cvt: function (rind, sind, txt) { return `<a href="${this.linkBgn}${rind}${this.linkEnd}${sind}">${txt}</a>`; },
};

Tpl.ref = {
    token: 'ref',
    debug: { color: 'lightblue' },
    cvt: (ind) => `<a id="ref-${ind}">${ind}</a>`,
}

Tpl.to_ref = {
    token: 'to_ref',
    debug: { color: 'cyan' },
    cvt: (ind, title) => `<a href="#ref-${ind}" title="${title}">${ind}</a>`,
}

Tpl.sec = {
    token: 'sec',
    debug: { color: 'violet' },
    cvt: (ind) => `<a id="sec-${ind}">${ind}</a>`,
}

Tpl.to_sec = {
    token: 'to_sec',
    debug: { color: 'lime' },
    cvt: (ind, txt) => `<a href="#sec-${ind}">${txt}</a>`,
}

Tpl.page = {
    token: 'page',
    debug: { color: 'VioletRed' },
    cvt: (ind) => `<span id="page-${ind}"></span>`,
}

Tpl.to_page = {
    token: 'to_page',
    debug: { color: 'limegreen' },
    cvt: (ind) => `<a href="#page-${ind}">${ind}</a>`,
}

Tpl.hr = {
    token: 'hr',
    debug: { color: 'black' },
    cvt: () => `<hr/>`,
}

Tpl.uri = {
    token: 'uri',
    debug: { color: 'chocolate' },
    cvt: (uri) => `<a href="${uri}">${uri}</a>`,
}
