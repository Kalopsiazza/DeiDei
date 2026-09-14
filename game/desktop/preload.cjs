const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  profile: { read: () => ipcRenderer.invoke('profile.read'), create: p => ipcRenderer.invoke('profile.create', p), update: p => ipcRenderer.invoke('profile.update', p), recover: p => ipcRenderer.invoke('profile.recover', p) },
  settings: { apply: p => ipcRenderer.invoke('settings.apply', p) },
  port: { startSolo: profile_id => ipcRenderer.invoke('port.startSolo', { profile_id }), submit: (view_id, entry_id) => ipcRenderer.invoke('port.submit', { view_id, entry_id }), getView: () => ipcRenderer.invoke('port.getView'), leave: () => ipcRenderer.invoke('port.leave') },
  preview: scene => ipcRenderer.invoke('fixture.preview', { scene }),
  online: {
    openLobby: () => ipcRenderer.invoke('online.openLobby'),
    create: p => ipcRenderer.invoke('online.create', p),
    join: p => ipcRenderer.invoke('online.join', p),
    ready: p => ipcRenderer.invoke('online.ready', p),
    start: p => ipcRenderer.invoke('online.start', p),
    changeRole: p => ipcRenderer.invoke('online.changeRole', p),
    submit: p => ipcRenderer.invoke('online.submit', p),
    returnLobby: p => ipcRenderer.invoke('online.returnLobby', p),
    leave: () => ipcRenderer.invoke('online.leave'),
    read: () => ipcRenderer.invoke('online.read'),
    onChange: listener => {
      const handle = (_event, state) => listener(state);
      ipcRenderer.on('online.change', handle);
      return () => ipcRenderer.removeListener('online.change', handle);
    }
  },
  manual: () => ipcRenderer.invoke('manual.read'),
  quit: () => ipcRenderer.invoke('app.quit')
});
