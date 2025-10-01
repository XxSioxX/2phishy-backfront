// add-phaser-imports.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'image-display-app', 'public', 'abadia', 'src');

function processFile(p) {
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes('Phaser') && !/from\s+['"]phaser['"]/.test(s)) {
    s = `import * as Phaser from 'phaser';\n` + s;
    fs.writeFileSync(p, s, 'utf8');
    console.log('Added import:', path.relative(ROOT, p));
  }
}

(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile() && p.endsWith('.js')) processFile(p);
  }
})(ROOT);

console.log('Done.');