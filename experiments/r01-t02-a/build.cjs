const fs = require('node:fs');
fs.mkdirSync('build/ui', { recursive: true });
for (const name of ['index.html', 'style.css', 'card.svg']) fs.copyFileSync(name, `build/ui/${name}`);
require('esbuild').buildSync({ entryPoints: ['renderer.tsx'], bundle: true, outfile: 'build/ui/renderer.js', platform: 'browser', minify: true });
