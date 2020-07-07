# dianbo-rfc-render

A replacement to [Rfcmarkup Tool](https://tools.ietf.org/tools/rfcmarkup/), because its code is kind of confused and the output result has several mistakes.

## Useage
```
./bin/render.js -i /path/to/rfc2616.txt
```
This will generate rfc2616.html in the same folder.

## Debug
```
./bin/render.js -i /path/to/rfc2616.txt -d
```
With -d option, each rendered markup element will be wrapped with a colored span element, which helps you figure out the matched text.

## Validation

**Version 0.0.2**: RFC2616