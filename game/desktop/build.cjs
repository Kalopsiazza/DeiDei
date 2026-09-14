const fs = require('node:fs');
const esbuild = require('esbuild');
fs.mkdirSync('build/ui', { recursive: true });
for (const name of ['index.html', 'style.css']) fs.copyFileSync(name, `build/ui/${name}`);
esbuild.buildSync({ entryPoints: ['renderer.tsx'], bundle: true, outfile: 'build/ui/renderer.js', platform: 'browser', minify: true });
esbuild.buildSync({ entryPoints: ['fixture.ts'], bundle: true, outfile: 'build/fixture.cjs', platform: 'node', format: 'cjs' });
esbuild.buildSync({ entryPoints: ['interaction.ts'], bundle: true, outfile: 'build/interaction.cjs', platform: 'node', format: 'cjs' });

esbuild.buildSync({ entryPoints: ['view-loop.ts'], bundle: true, outfile: 'build/view-loop.cjs', platform: 'node', format: 'cjs' });

esbuild.buildSync({ entryPoints: ['online/model.ts'], bundle: true, outfile: 'build/online-model.cjs', platform: 'node', format: 'cjs' });
