'use strict';

const http = require('http');
const path = require('path');
const process = require('process');

const fse = require('fs-extra');
const { program } = require('commander');
const { JSDOM } = require("jsdom");

program
    .option('-i, --index <int>', 'RFC index')
    .parse(process.argv);

const args = {};
args.index = program.index || 7540;
args.textFile = `rfc${args.index}.txt`;
args.textURL = `http://www.rfc-editor.org/rfc/rfc${args.index}.txt`;
args.htmlFile = `rfc${args.index}.html`;
args.htmlURL = `http://www.rfc-editor.org/rfc/rfc${args.index}.html`;
args.htmlBodyFile = `rfc${args.index}_body.html`;
args.cacheDir = './cache/';


(async () => {
    const cache = await Cache(args.cacheDir);

    // Target html body
    const html = await cache.get(args.htmlFile, args.htmlURL);
    const dom = new JSDOM(html);
    const body = dom.window.document.body;
    while (body.firstChild.nodeName !== 'PRE')
        body.removeChild(body.firstChild);
    await cache.save(args.htmlBodyFile, body.outerHTML);

    // Process RFC text
    let text = await cache.get(args.textFile, args.textURL);
    text = String(text);

    {
        String.prototype.old_replace = String.prototype.replace;
        // String.prototype.replace = function (regexp, replacement) {
        //     if (this.search(regexp) !== -1)
        //         console.log(regexp);
        //     return this.old_replace(regexp, replacement);
        // }
        String.prototype.replace = function (regexp, replacement) {
            const result = this.old_replace(regexp, replacement);
            if (result != this) console.log(regexp);
            return result;
        }
    }
    {
        // # ------------------------------------------------------------------------
        // # Start of markup handling

        // # Convert \r which is not followed or preceded by a \n to \n
        // #  (in case this is a mac document)
        // data = re.sub("([^\n])\r([^\n])", "\g<1>\n\g<2>", data)
        text = text.replace(/([^\n])\r([^\n])/g, '$1\n$2');
    }
    {
        // # Strip \r (in case this is a ms format document):
        // data = string.replace(data,"\r","")
        text = text.replace(/\r/g, '');
    }
    {
        // # -------------
        // # Normalization

        // # Remove whitespace at the end of lines
        // data = re.sub("[\t ]+\n", "\n", data)
        text = text.replace(/[\t ]+\n/g, '\n');
    }
    {
        // # Remove whitespace (including formfeeds) at the end of the document.
        // # (Trailing formfeeds will result in trailing blank pages.)
        // data = re.sub("[\t \r\n\f]+$", "\n", data)
        text = text.replace(/[\t \r\n\f]+$/g, '\n');
    }
    {
        // data = data.expandtabs()
        text = text.replace(/\t/g, '        ');
    }
    {
        // # Remove extra blank lines at the start of the document
        // data = re.sub("^\n*", "", data, 1)
        text = text.replace(/^\n*/g, '');
    }
    {
        // # Fix up page breaks:
        // # \f should aways be preceeded and followed by \n
        // data = re.sub("([^\n])\f", "\g<1>\n\f", data)
        // data = re.sub("\f([^\n])", "\f\n\g<1>", data)
        text = text.replace(/([^\n])\f/g, '$1\n\f');
        text = text.replace(/\f([^\n])/g, '\f\n$1');
    }
    {
        // # [Page nn] should be followed by \n\f\n
        // data = re.sub("(?i)(\[Page [0-9ivxlc]+\])[\n\f\t ]*(\n *[^\n\f\t ])", "\g<1>\n\f\g<2>", data)
        text = text.replace(/(\[Page [0-9ivxlc]+\])[\n\f\t ]*(\n *[^\n\f\t ])/ig, '$1\n\f$2');
    }
    {
        // # Normalize indentation
        // linestarts = re.findall("(?m)^([ ]*)\S", data)
        // prefixlen = 72
        // for start in linestarts:
        //     if len(start) < prefixlen:
        //         prefixlen = len(start)
        // if prefixlen:
        //     data = re.sub("\n"+(" "*prefixlen), "\n", data)
    }
    fse.writeFile('tmp.txt', text);

})().catch(e => console.log(e));

async function Cache(dir) {
    await fse.ensureDir(dir);

    const cache = {};
    cache.get = async (file, url) => {
        let data;
        let cacheFile = path.join(dir, file);

        if (await fse.pathExists(cacheFile)) {
            data = await fse.readFile(cacheFile);
        } else if (url !== undefined) {
            data = await httpGet(url);
            await fse.writeFile(cacheFile, data);
        } else {
            throw Error('No cached file, and URL is not given!');
        }
        return data;
    }
    cache.save = async (file, data) => {
        await fse.writeFile(path.join(dir, file), data);
    }

    return cache;
}

function httpGet(url) {
    return new Promise((resolve, reject) => {
        let data = '';
        http.get(url, (response) => {
            response.on('data', (chunk) => { data += chunk; });
            response.on('end', () => { resolve(data); });
        }).on('error', reject);
    });
};

function pressEntry() {
    return new Promise((resolve) => {
        process.stdin.once('readable', () => {
            while (process.stdin.read() !== null);
            resolve();
        });
    });
}
