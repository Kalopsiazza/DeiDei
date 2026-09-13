const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('experiment', {
  health: () => ipcRenderer.invoke('health'),
  profileRead: () => ipcRenderer.invoke('profileRead'),
  profileWrite: p => ipcRenderer.invoke('profileWrite', p),
  runCase: id => ipcRenderer.invoke('runCase', id),
  chooseEasy: seed => ipcRenderer.invoke('chooseEasy', seed),
  shutdown: () => ipcRenderer.invoke('shutdown')
});
