#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var dir = __dirname;
var svgPath = path.join(dir, 'icon.svg');
var outPath = path.join(dir, 'icon-128.png');

try {
  var sharp = require('sharp');
} catch (e) {
  console.error('Run: npm install sharp (in project root or store-assets)');
  process.exit(1);
}

var svg = fs.readFileSync(svgPath);

sharp(Buffer.from(svg))
  .png()
  .resize(128, 128)
  .toFile(outPath)
  .then(function () { console.log('Written:', outPath); })
  .catch(function (err) {
    console.error(err);
    process.exit(1);
  });
