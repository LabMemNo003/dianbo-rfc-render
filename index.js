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
        const re_1 = /^([ ]*)\S/mg;
        let prefixlen = 72, match_1;
        while ((match_1 = re_1.exec(text)) !== null)
            if (match_1[1].length < prefixlen)
                prefixlen = match_1[1].length;
        if (prefixlen)
            text = text.replace(RegExp('\n' + ' '.repeat(prefixlen)), '\n');
    }
    {
        // # reference name tag markup
        // reference = {}
        // ref_url = {}

        // ## Locate the start of the References section as the first reference
        // ## definition after the last reference usage
        // ## Incomplete 05 Aug 2010 17:05:27 XXXX Complete this!!

        // ##ref_usages = re.findall("(\W)(\[)([-\w.]+)((, ?[-\w.]+)*\])", data)
        // ref_defs = re.findall("(?sm)^( *\n *)\[([-\w.]+?)\]( +)(.*?)(\n *)$", data)

        // ##ref_pos = [ match.start() for match in ref_usages ]
        // ##def_pos = [ match.start() for match in ref_defs ]
        // ##ref_pos = [ pos for pos in ref_pos if not pos in ref_defs ]
        // ##last_ref_pos = ref_pos[-1] if ref_pos else None

        // #sys.stderr.write("ref_defs: %s\n" % repr(ref_defs))        
        // for tuple in ref_defs:
        //     title_match = re.search("(?sm)^(.*?(\"[^\"]+?\").+?|.*?(,[^,]+?,)[^,]+?)$", tuple[3])
        //     if title_match:
        //         reftitle = title_match.group(2) or title_match.group(3).strip("[ ,]+")
        //         # Get rid of page break information inside the title
        //         reftitle = re.sub("(?s)\n\n\S+.*\n\n", "", reftitle)
        //         reftitle = cgi.escape(reftitle, quote=True)
        //         reftitle = re.sub("[\n\t ]+", " ", reftitle) # Remove newlines and tabs
        //         reference[tuple[1]] = reftitle
        //     url_match = re.search(r"(http|https|ftp)://\S+", tuple[3])
        //     if url_match:
        //         ref_url[tuple[1]] = url_match.group(0)
        const reference = {}, ref_url = {}, ref_defs = [];
        const re_2 = /^( *\n *)\[([-\w.]+?)\]( +)(.*?)(\n *)$/msg;
        let match_2;
        while ((match_2 = re_2.exec(text)) !== null)
            ref_defs.push(match_2);
        for (let tuple of ref_defs) {
            const re_3 = /^(.*?(\"[^\"]+?\").+?|.*?(,[^,]+?,)[^,]+?)$/ms;
            const title_match = re_3.exec(tuple[4]);
            if (title_match !== null) {
                let reftitle = title_match[2] || title_match[3].replace(/(^[\[ ,\]\+]+)|([\[ ,\]\+]+$)/g, '');
                reftitle = reftitle.replace(/\n\n\S+.*\n\n/sg, '');
                reftitle = escapeHtml(reftitle);
                reftitle = reftitle.replace(/[\n\t ]+/g, ' ');
                reference[tuple[2]] = reftitle;
            }
            const re_4 = /(http|https|ftp):\/\/\S+/;
            const url_match = re_4.exec(tuple[4]);
            if (url_match !== null) {
                ref_url[tuple[2]] = url_match[0];
            }
        }
        console.log(reference);
        console.log(ref_url);
    }
    {
        // # -------------
        // # escape any html significant characters
        // data = cgi.escape(data);
        text = escapeHtml(text);
    }
    {
        // # -------------
        // # Adding markup

        // # Typewriter-style underline:
        // data = re.sub("_[\b](.)", "<u>\g<1></u>", data)
        text = text.replace(/_[\b](.)/g,'<u>$1<u>');
    }
    {
        // # Line number markup goes here
        // # Obsoletes: ... markup
        
        // def rfclist_replace(keyword, data):
        //     def replacement(match):
        //         group = list(match.groups(""))
        //         group[3] = re.sub("\d+", """<a href=\"%s?%srfc=\g<0>\">\g<0></a>""" % (script, extra), group[3])
        //         if group[8]:
        //             group[8] = re.sub("\d+", """<a href=\"%s?%srfc=\g<0>\">\g<0></a>""" % (script, extra), group[8])
        //         else:
        //             group[8] = ""
        //         return "\n%s%s%s\n%s%s" % (group[0], group[3], group[5], group[7], group[8])
        //     data = re.sub("\n(%s( RFCs| RFC)?: ?( RFCs| RFC)?)(( \d+,| \d+)+)(.*)\n(( *)((\d+, )*(\d+)))*" % keyword, replacement, data, 1)
        //     return data

        // data = rfclist_replace("Obsoletes", data)
        // data = rfclist_replace("Updates", data)
        () => {};
    }
    {
        // lines = data.splitlines(True)
        // head  = "".join(lines[:28])
        // rest  = "".join(lines[28:])

        // # title markup
        // head = re.sub("""(?im)(([12][0-9][0-9][0-9]|^Obsoletes.*|^Category: (Standards Track|Informational|Experimental|Best Current Practice)) *\n\n+ +)([A-Z][^\n]+)$""", """\g<1><span class=\"h1\">\g<4></span>""", head, 1)
        // head = re.sub("""(?i)(<span class="h1".+</span>)(\n +)([^<\n]+)\n""", """\g<1>\g<2><span class="h1">\g<3></span>\n""", head, 1)
        // head = re.sub("""(?i)(<span class="h1".+</span>)(\n +)([^<\n]+)\n""", """\g<1>\g<2><span class="h1">\g<3></span>\n""", head, 1)

        // if "doctitle" in attribs and attribs["doctitle"] is not None:
        //     args["title"] = args["title"] + " - " + attribs["doctitle"]
        // else:
        //     for match in re.finditer("""(?i)<span class="h1".*?>(.+?)</span>""", head):
        //         if not (match.group(1).startswith("draft-") or match.group(1).startswith("&lt;draft-")):
        //             if not " -" in args["title"]:
        //                 args["title"] = args["title"] + " -"
        //             args["title"] = args["title"] + " " + match.group(1)

        // data = head + rest
    }
    {
//         # http link markup
//         # link crossing a line.  Not permitting ":" after the line break will
//         # result in some URLs broken across lines not being recognized, but
//         # will on the other hand correctly handle a series of URL listed line
//         # by line, one on each line.
//         #  Link crossing a line, where the continuation contains '.' or '/'
//         data = re.sub("(?im)(\s|^|[^=]\"|\()((http|https|ftp)://([:A-Za-z0-9_./@%&?#~=-]+)?)(\n +)([A-Za-z0-9_./@%&?#~=-]+[./][A-Za-z0-9_./@%&?#~=-]+[A-Za-z0-9_/@%&?#~=-])([.,)\"\s]|$)",
//                         "\g<1><a href=\"\g<2>\g<6>\">\g<2></a>\g<5><a href=\"\g<2>\g<6>\">\g<6></a>\g<7>", data)
//         data = re.sub("(?im)(&lt;)((http|https|ftp)://([:A-Za-z0-9_./@%&?#~=-]+)?)(\n +)([A-Za-z0-9_./@%&?#~=-]+[A-Za-z0-9_/@%&?#~=-])(&gt;)",
//                         "\g<1><a href=\"\g<2>\g<6>\">\g<2></a>\g<5><a href=\"\g<2>\g<6>\">\g<6></a>\g<7>", data)
//         #  Link crossing a line, where first line ends in '-' or '/'
//         data = re.sub("(?im)(\s|^|[^=]\"|\()((http|https|ftp)://([:A-Za-z0-9_./@%&?#~=-]+)?[-/])(\n +)([A-Za-z0-9_./@%&?#~=-]+[A-Za-z0-9_/@%&?#~=-])([.,)\"\s]|$)",
//                         "\g<1><a href=\"\g<2>\g<6>\">\g<2></a>\g<5><a href=\"\g<2>\g<6>\">\g<6></a>\g<7>", data)
//         data = re.sub("(?im)(&lt;)((http|https|ftp)://([:A-Za-z0-9_./@%&?#~=-]+)?)(\n +)([A-Za-z0-9_./@%&?#~=-]+[A-Za-z0-9_/@%&?#~=-])(&gt;)",
//                         "\g<1><a href=\"\g<2>\g<6>\">\g<2></a>\g<5><a href=\"\g<2>\g<6>\">\g<6></a>\g<7>", data)
//         # link crossing a line, enclosed in "<" ... ">"
//         data = re.sub("(?im)<((http|https|ftp)://([:A-Za-z0-9_./@%&?#~=-]+)?)(\n +)([A-Za-z0-9_./@%&?#~=-]+[A-Za-z0-9_/@%&?#~=-])>",
//                         "<\g<1><a href=\"\g<1>\g<5>\">\g<1></a>\g<4><a href=\"\g<1>\g<5>\">\g<5></a>>", data)
//         data = re.sub("(?im)(&lt;)((http|https|ftp)://([:A-Za-z0-9_./@%&?#~=-]+)?)(\n +)([A-Za-z0-9_./@%&;?#~=-]+[A-Za-z0-9_/@%&;?#~=-])(&gt;)",
//                         "\g<1><a href=\"\g<2>\g<6>\">\g<2></a>\g<5><a href=\"\g<2>\g<6>\">\g<6></a>\g<7>", data)
//         # link crossing two lines, enclosed in "<" ... ">"
//         data = re.sub("(?im)<((http|https|ftp)://([:A-Za-z0-9_./@%&?#~=-]+)?)(\n +)([A-Za-z0-9_./@%&?#~=-]+[A-Za-z0-9_/@%&?#~=-])(\n +)([A-Za-z0-9_./@%&?#~=-]+[A-Za-z0-9_/@%&?#~=-])>",
//                         "<\g<1><a href=\"\g<1>\g<5>\g<7>\">\g<1></a>\g<4><a href=\"\g<1>\g<5>\g<7>\">\g<5></a>\g<6><a href=\"\g<1>\g<5>\g<7>\">\g<7></a>>", data)
//         data = re.sub("(?im)(&lt;)((http|https|ftp)://([:A-Za-z0-9_./@%&?#~=-]+)?)(\n +)([A-Za-z0-9_./@%&?#~=-]+[A-Za-z0-9_/@%&?#~=-])(\n +)([A-Za-z0-9_./@%&;?#~=-]+[A-Za-z0-9_/@%&;?#~=-])(&gt;)",
//                         "\g<1><a href=\"\g<2>\g<6>\g<8>\">\g<2></a>\g<5><a href=\"\g<2>\g<6>\g<8>\">\g<6></a>\g<7><a href=\"\g<2>\g<6>\g<8>\">\g<8></a>\g<9>", data)
//         # link on a single line
//         data = re.sub("(?im)(\s|^|[^=]\"|&lt;|\()((http|https|ftp)://[:A-Za-z0-9_./@%&?#~=-]+[A-Za-z0-9_/@%&?#~=-])([.,)\"\s]|&gt;|$)",
//                         "\g<1><a href=\"\g<2>\">\g<2></a>\g<4>", data)
// #         # Special case for licensing boilerplate
// #         data = data.replace('<a href="http://trustee.ietf.org/">http://trustee.ietf.org/</a>\n   license-info',
// #                             '<a href="http://trustee.ietf.org/licence-info">http://trustee.ietf.org/</a>\n   <a href="http://trustee.ietf.org/licence-info">licence-info</a>')
        text = text.replace(/(\s|^|[^=]\"|\()((http|https|ftp):\/\/([:A-Za-z0-9_.\/@%&?#~=-]+)?)(\n +)([A-Za-z0-9_.\/@%&?#~=-]+[.\/][A-Za-z0-9_.\/@%&?#~=-]+[A-Za-z0-9_\/@%&?#~=-])([.,)\"\s]|$)/img,
        '$1<a href=\"$2$6\">$2</a>$5<a href=\"$2$6\">$6</a>$7');
        text = text.replace(/(&lt;)((http|https|ftp):\/\/([:A-Za-z0-9_.\/@%&?#~=-]+)?)(\n +)([A-Za-z0-9_.\/@%&?#~=-]+[A-Za-z0-9_\/@%&?#~=-])(&gt;)/img,
        '$1<a href=\"$2$6\">$2</a>$5<a href=\"$2$6\">$6</a>$7');
        text = text.replace(/(\s|^|[^=]\"|\()((http|https|ftp):\/\/([:A-Za-z0-9_.\/@%&?#~=-]+)?[-\/])(\n +)([A-Za-z0-9_.\/@%&?#~=-]+[A-Za-z0-9_\/@%&?#~=-])([.,)\"\s]|$)/img,
        '$1<a href=\"$2$6\">$2</a>$5<a href=\"$2$6\">$6</a>$7');
        text = text.replace(/(&lt;)((http|https|ftp):\/\/([:A-Za-z0-9_.\/@%&?#~=-]+)?)(\n +)([A-Za-z0-9_.\/@%&?#~=-]+[A-Za-z0-9_\/@%&?#~=-])(&gt;)/img,
        '$1<a href=\"$2$6\">$2</a>$5<a href=\"$2$6\">$6</a>$7');
        text = text.replace(/<((http|https|ftp):\/\/([:A-Za-z0-9_.\/@%&?#~=-]+)?)(\n +)([A-Za-z0-9_.\/@%&?#~=-]+[A-Za-z0-9_\/@%&?#~=-])>/img,
        '<$1<a href=\"$1$5\">$1</a>$4<a href=\"$1$5\">$5</a>>');
        text = text.replace(/(&lt;)((http|https|ftp):\/\/([:A-Za-z0-9_.\/@%&?#~=-]+)?)(\n +)([A-Za-z0-9_.\/@%&;?#~=-]+[A-Za-z0-9_\/@%&;?#~=-])(&gt;)/img,
        '$1<a href=\"$2$6\">$2</a>$5<a href=\"$2$6\">$6</a>$7');
        () => {};
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

function pressEnter() {
    return new Promise((resolve) => {
        process.stdin.once('readable', () => {
            while (process.stdin.read() !== null);
            resolve();
        });
    });
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
