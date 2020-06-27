'use strict';

const http = require('http');
const path = require('path');
const process = require('process');

const fse = require('fs-extra');
const { program } = require('commander');

program
    .option('-i, --index <int>', 'RFC index')
    .parse(process.argv);

const args = {};
args.index = program.index || 7540;
args.txtFile = `rfc${args.index}.txt`;
args.txtURL = `http://www.rfc-editor.org/rfc/rfc${args.index}.txt`;
args.htmlFile = `rfc${args.index}.html`;
args.htmlURL = `http://www.rfc-editor.org/rfc/rfc${args.index}.html`;
args.cacheDir = './cache/';


(async () => {
    let txt = cacheGet(args.cacheDir, args.txtFile, args.txtURL);
    let hrml = cacheGet(args.cacheDir, args.htmlFile, args.htmlURL);
})().catch(e => console.log(e));


async function cacheGet(dir, file, url) {
    let data;
    let cacheFile = path.join(dir, file);

    await fse.ensureDir(dir);
    if (await fse.pathExists(cacheFile)) {
        data = await fse.readFile(cacheFile);
    } else {
        data = await httpGet(url);
        await fse.writeFile(cacheFile, data);
    }
    return data;
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
