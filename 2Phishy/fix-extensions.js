// fix-extensions.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'image-display-app', 'public', 'abadia', 'src');

function needsJs(spec) {
  return (spec.startsWith('./') || spec.startsWith('../')) && !path.extname(spec);
}

function fixFile(file) {
  let s = fs.readFileSync(file, 'utf8');
  // import ... from '...';  export ... from '...';  import('...')
  s = s.replace(
    /(from\s+['"]|import\s*\(\s*['"])(\.{1,2}\/[^'"]+?)(['"]\s*\)?)/g,
    (_, p, spec, q) => (needsJs(spec) ? `${p}${spec}.js${q}` : `${p}${spec}${q}`)
  );
  fs.writeFileSync(file, s, 'utf8');
}

(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile() && p.endsWith('.js')) fixFile(p);
  }
})(ROOT);

console.log('Done: appended .js to missing relative imports.');