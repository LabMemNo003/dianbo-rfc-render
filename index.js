'use strict';

const http = require('http');
const path = require('path');
const process = require('process');

const fse = require('fs-extra');
const { program } = require('commander');
const { JSDOM } = require("jsdom");
const { resolve } = require('path');

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
    const text = await cache.get(args.textFile, args.textURL);

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
