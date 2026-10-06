const {randomUUID}=require('node:crypto');
// One app/window owns one installation plan. No persisted installation permission.
class ShutdownCoordinator {
 constructor({updates,privacy,canPrepare,sendPrepare,cleanup,backup,onGate=()=>{}}){Object.assign(this,{updates,privacy,canPrepare,sendPrepare,cleanup,backup,onGate});this.context=null;this.revision=0;this.pending=null;this.running=false;this.handedOff=false;updates.onChange(()=>this.pump());}
 report(context){this.context=structuredClone(context);if(!this.clean()&&(this.pending||this.running))this.invalidate(false);this.privacy.setIdle(['menu','settings'].includes(context.page)&&!context.transitioning);this.pump();}
 clean(){const c=this.context;return !!c&&c.page==='menu'&&!c.experienceDirty&&!c.ruleEditing&&!c.modal&&!c.transitioning&&this.canPrepare();}
 invalidate(cancelPlan=true){if(this.handedOff)return;this.revision++;clearTimeout(this.timer);this.pending=null;if(!this.running)this.onGate(false);this.privacy.restartSuspended(false);if(cancelPlan&&this.updates.read().installPlan){try{this.updates.cancelInstallPlan();}catch{}}}
 pump(){const update=this.updates.read();if(this.handedOff||this.running||this.pending||update.status!=='ready'||!update.installPlan||!this.clean())return;const request={nonce:randomUUID(),generation:update.generation,revision:this.revision};this.pending=request;this.timer=setTimeout(()=>{if(this.pending===request)this.invalidate(true);},5000);this.sendPrepare({nonce:request.nonce,generation:request.generation});}
 async reply({nonce,generation,ready}){
  const request=this.pending;if(!request||request.nonce!==nonce||request.generation!==generation||request.revision!==this.revision)throw Error('RESTART_STALE');
  clearTimeout(this.timer);this.pending=null;if(!ready||!this.clean()){this.invalidate(true);return;}
  this.running=true;this.onGate(true);this.privacy.restartSuspended(true);
  const current=()=>!this.handedOff&&request.revision===this.revision&&this.updates.read().generation===generation&&!!this.updates.read().installPlan&&this.clean();
  try{
   await this.privacy.persistenceBarrier();if(this.privacy.read().warning?.includes('NOT_SAVED')||!current())throw Error('RESTART_CANCELLED');
   await this.backup();if(!current())throw Error('RESTART_CANCELLED');
   await this.cleanup();if(!current())throw Error('RESTART_CANCELLED');
   await this.updates.verifyReady(generation);if(!current())throw Error('RESTART_CANCELLED');
   // No await separates the final token check, permission consumption and native handoff.
   if(!current())throw Error('RESTART_CANCELLED');this.handedOff=true;this.updates.handoffInstall(generation);
  }catch(error){if(this.handedOff){this.handedOff=false;this.invalidate(true);}else this.invalidate(true);throw error;}
  finally{this.running=false;if(!this.handedOff){this.onGate(false);this.privacy.restartSuspended(false);}}
 }
 close(){clearTimeout(this.timer);this.pending=null;this.revision++;}
}
module.exports={ShutdownCoordinator};
