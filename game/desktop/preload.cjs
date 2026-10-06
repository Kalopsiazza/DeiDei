const { contextBridge, ipcRenderer } = require('electron');
const subscribe=(channel,listener)=>{const handle=(_event,value)=>listener(value);ipcRenderer.on(channel,handle);return()=>ipcRenderer.removeListener(channel,handle);};
contextBridge.exposeInMainWorld('desktop', {
  profile: { read: () => ipcRenderer.invoke('profile.read'), create: p => ipcRenderer.invoke('profile.create', p), update: p => ipcRenderer.invoke('profile.update', p), recover: p => ipcRenderer.invoke('profile.recover', p) },
  settings: { apply: p => ipcRenderer.invoke('settings.apply', p),windowState:()=>ipcRenderer.invoke('settings.windowState'),onWindowChange:listener=>subscribe('settings.windowChange',listener) },
  rules:{read:()=>ipcRenderer.invoke('rules.read'),compile:rules_request=>ipcRenderer.invoke('rules.compile',{rules_request}),importPack:()=>ipcRenderer.invoke('rules.importPack'),deletePack:pack_ref=>ipcRenderer.invoke('rules.deletePack',{pack_ref}),savePreset:(name,rules_request)=>ipcRenderer.invoke('rules.savePreset',{name,rules_request}),deletePreset:id=>ipcRenderer.invoke('rules.deletePreset',{id})},
  privacy:{read:()=>ipcRenderer.invoke('privacy.read'),preview:()=>ipcRenderer.invoke('privacy.preview'),stop:()=>ipcRenderer.invoke('privacy.stop'),clearLocal:()=>ipcRenderer.invoke('privacy.clearLocal'),deleteUploaded:()=>ipcRenderer.invoke('privacy.deleteUploaded'),setScope:(scope,value,expectedRevision,expectedStateToken)=>ipcRenderer.invoke('privacy.setScope',{scope,value,expectedRevision,expectedStateToken}),setLocalRecording:value=>ipcRenderer.invoke('privacy.setLocalRecording',{value})},
  updates:{read:()=>ipcRenderer.invoke('updates.read'),check:()=>ipcRenderer.invoke('updates.check'),download:()=>ipcRenderer.invoke('updates.download'),cancelDownload:()=>ipcRenderer.invoke('updates.cancelDownload'),install:mode=>ipcRenderer.invoke('updates.install',{mode}),cancelInstallPlan:()=>ipcRenderer.invoke('updates.cancelInstallPlan'),setPreferences:p=>ipcRenderer.invoke('updates.setPreferences',p),onChange:listener=>subscribe('updates.change',listener)},
  hardware:{read:()=>ipcRenderer.invoke('hardware.read'),presentRecommendation:token=>ipcRenderer.invoke('hardware.presentRecommendation',{token}),beginSample:graphics=>ipcRenderer.invoke('hardware.beginSample',{graphics}),finishSample:(token,summary)=>ipcRenderer.invoke('hardware.finishSample',{token,summary}),cancelSample:token=>ipcRenderer.invoke('hardware.cancelSample',{token})},
  lifecycle:{reportContext:p=>ipcRenderer.invoke('lifecycle.reportContext',p),replyRestart:p=>ipcRenderer.invoke('lifecycle.replyRestart',p),onPrepareRestart:listener=>subscribe('lifecycle.prepareRestart',listener)},
  port: { prepareSolo:opponent_id=>ipcRenderer.invoke('port.prepareSolo',{opponent_id}),soloStatus:()=>ipcRenderer.invoke('port.soloStatus'),cancelSoloPrepare:()=>ipcRenderer.invoke('port.cancelSoloPrepare'),startSolo: (profile_id,rules_request,opponent_id='random-legal-v1') => ipcRenderer.invoke('port.startSolo',{profile_id,rules_request,opponent_id}), startTutorial: profile_id => ipcRenderer.invoke('port.startTutorial', { profile_id }), tutorialNext: view_id => ipcRenderer.invoke('port.tutorialNext', { view_id }), submit: (view_id, entry_id) => ipcRenderer.invoke('port.submit', { view_id, entry_id }), getView: () => ipcRenderer.invoke('port.getView'), leave: () => ipcRenderer.invoke('port.leave') },
  preview: scene => ipcRenderer.invoke('fixture.preview', { scene }),
  online: {
    openLobby: () => ipcRenderer.invoke('online.openLobby'),
    create: p => ipcRenderer.invoke('online.create', p),
    join: p => ipcRenderer.invoke('online.join', p),
    ready: p => ipcRenderer.invoke('online.ready', p),
    start: p => ipcRenderer.invoke('online.start', p),
    setRules: p => ipcRenderer.invoke('online.setRules', p),
    setTurnLimit: p => ipcRenderer.invoke('online.setTurnLimit', p),
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
