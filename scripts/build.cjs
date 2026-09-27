const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
for (const name of ['index.html', 'cloud.js', 'supabase-config.js']) {
  fs.copyFileSync(path.join(root, name), path.join(root, 'dist', name));
}
fs.writeFileSync(path.join(root, 'dist', '.nojekyll'), '');
console.log('Built dist: game and public cloud configuration.');
