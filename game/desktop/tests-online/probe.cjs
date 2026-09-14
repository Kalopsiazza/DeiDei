const { app } = require('electron');
app.whenReady().then(() => {
  console.log(JSON.stringify({electron:process.versions.electron,node:process.versions.node,platform:process.platform,arch:process.arch,WebSocket:typeof globalThis.WebSocket}));
  app.exit(typeof globalThis.WebSocket === 'function' ? 0 : 1);
});
