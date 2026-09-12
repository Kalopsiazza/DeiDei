const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  profile: { read: () => ipcRenderer.invoke('profile.read'), create: p => ipcRenderer.invoke('profile.create', p), update: p => ipcRenderer.invoke('profile.update', p), recover: p => ipcRenderer.invoke('profile.recover', p) },
  settings: { apply: p => ipcRenderer.invoke('settings.apply', p) },
  port: { startSolo: profile_id => ipcRenderer.invoke('port.startSolo', { profile_id }), submit: (view_id, entry_id) => ipcRenderer.invoke('port.submit', { view_id, entry_id }), getView: () => ipcRenderer.invoke('port.getView'), leave: () => ipcRenderer.invoke('port.leave') },
  preview: scene => ipcRenderer.invoke('fixture.preview', { scene }),
  manual: () => ipcRenderer.invoke('manual.read'),
  quit: () => ipcRenderer.invoke('app.quit')
});
