'use strict';

module.exports = Tpl;

function Tpl(debug) {
    if (!!debug && !Tpl.debugged) {
        Tpl.debugged = true;
        for (let attr in Tpl) {
            if (Tpl[attr].cvt && Tpl[attr].debug) {
                const cvtr = Tpl[attr];
                cvtr.cvt = cvtr.cvt.bind(cvtr);
                cvtr.cvt = Tpl.debuglize(cvtr.cvt, cvtr.debug.color);
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

Tpl.iterateDecode = Tpl.iteDec = (text) => {
    let cond = true;
    while (cond) {
        cond = false;
        text = text.replace(Tpl.pattern, (match) => {
            cond = true;
            return Tpl.dec(match);
        });
    }
    return text;
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
};

Tpl.unescape = (str) => {
    return str
        .replace(/=eql;/g, '=')
        .replace(/=amp;/g, '&')
        .replace(/=lt;/g, '<')
        .replace(/=gt;/g, '>')
        .replace(/=quot;/g, '"')
        .replace(/=#039;/g, "'");
};

Tpl.escapeHtml = (unsafe) => {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

Tpl.debuglize = (cvt, color) => {
    return (...args) => `<span style="background-color:${color};">${cvt(...args)}</span>`;
};

Tpl.rfc = {
    token: 'rfc',
    debug: { color: 'Red' },
    cvt: (ind, txt, title, color) => {
        const _title = title ? ` title="${title}"` : '';
        const _style = color ? ` style="color:${color};"` : '';
        return `<a href="./rfc${ind}"${_title}${_style}>${txt}</a>`;
    },
};

Tpl.rfc_sec = {
    token: 'rfc_sec',
    debug: { color: 'Gray' },
    cvt: (rind, sind, txt, title) => {
        const _title = title ? ` title="${title}"` : '';
        return `<a href="./rfc${rind}#sec-${sind}"${_title}>${txt}</a>`;
    },
};

Tpl.rfc_appx = {
    token: 'rfc_appx',
    debug: { color: 'DarkSalmon' },
    cvt: (rind, aind, txt) => `<a href="./rfc${rind}#appx-${aind}">${txt}</a>`,
};

Tpl.bcp = {
    token: 'bcp',
    debug: { color: 'Turquoise' },
    cvt: (ind, txt, title) => {
        const _title = title ? ` title="${title}"` : '';
        return `<a href="https://www.rfc-editor.org/info/bcp${ind}"${_title}>${txt}</a>`;
    },
};

Tpl.bcp_sec = {
    token: 'bcp_sec',
    debug: { color: 'AliceBlue' },
    cvt: (bind, sind, txt, title) => {
        const _title = title ? ` title="${title}"` : '';
        return `<a href="https://www.rfc-editor.org/info/bcp${bind}#sec-${sind}"${_title}>${txt}</a>`;
    },
};

Tpl.ref = {
    token: 'ref',
    debug: { color: 'LightBlue' },
    cvt: (ind, txt) => `<a id="ref-${ind}">${txt ? txt : ind}</a>`,
};

Tpl.to_ref = {
    token: 'to_ref',
    debug: { color: 'Cyan' },
    cvt: (ind, title, txt) => `<a href="#ref-${ind}" title="${title}">${txt ? txt : ind}</a>`,
};

Tpl.sec = {
    token: 'sec',
    debug: { color: 'Violet' },
    cvt: (ind) => `<a id="sec-${ind}">${ind}</a>`,
};

Tpl.to_sec = {
    token: 'to_sec',
    debug: { color: 'Lime' },
    cvt: (ind, txt) => `<a href="#sec-${ind}">${txt}</a>`,
};

Tpl.appx = {
    token: 'appx',
    debug: { color: 'Bisque' },
    cvt: (ind, txt) => `<a id="appx-${ind}">${txt}</a>`,
};

Tpl.to_appx = {
    token: 'to_appx',
    debug: { color: 'Beige' },
    cvt: (ind, txt) => `<a href="#appx-${ind}">${txt}</a>`,
};

Tpl.page = {
    token: 'page',
    debug: { color: 'VioletRed' },
    cvt: (ind) => `<span id="page-${ind}"></span>`,
};

Tpl.to_page = {
    token: 'to_page',
    debug: { color: 'LimeGreen' },
    cvt: (ind) => `<a href="#page-${ind}">${ind}</a>`,
};

Tpl.hr = {
    token: 'hr',
    debug: { color: 'Black' },
    cvt: () => `<hr/>`,
};

Tpl.uri = {
    token: 'uri',
    debug: { color: 'Chocolate' },
    cvt: (uri, txt) => `<a href="${uri}">${txt ? txt : uri}</a>`,
};

Tpl.title = {
    token: 'title',
    debug: { color: 'Pink' },
    cvt: (title) => `<b>${title}</b>`,
};

Tpl.header = {
    token: 'header',
    debug: { color: 'DarkKhaki' },
    cvt: (inner) => `<span style="color:gray;">${inner}</span>`,
};

Tpl.footer = {
    token: 'footer',
    debug: { color: 'BurlyWood' },
    cvt: (inner) => `<span style="color:gray;">${inner}</span>`,
};

Tpl.none = {
    token: 'none',
    cvt: txt => txt,
};
