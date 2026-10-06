const os=require('node:os');
const crypto=require('node:crypto');
const {validateGraphics,graphicsForPreset,matchGraphicsPreset,sameGraphics}=require('../graphics.cjs');
const token=()=>crypto.randomBytes(16).toString('hex');
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join()===keys;
const bucket=(value,limits,names)=>value===null?'unknown':names[limits.findIndex(limit=>value<=limit)]||names.at(-1);
function effective(graphics,system){const value=validateGraphics(graphics);if(system.reducedMotion)value.ambientMotion='off';if(system.reducedTransparency)value.glass='off';return value;}
class HardwareService {
 constructor({app,nativeTheme,systemPreferences,readContext,onShown=async()=>{},onPerformance=async()=>{},now=Date.now,osApi=os,queryTimeout=1500}) {
  this.app=app;this.theme=nativeTheme;this.systemPreferences=systemPreferences;this.readContext=readContext;this.onShown=onShown;this.onPerformance=onPerformance;this.now=now;this.os=osApi;this.queryTimeout=queryTimeout;
  this.observations=new Map();this.samples=new Map();this.ready=this.detect();this.savedGraphics=graphicsForPreset('balanced');
 }
 system(){let motion=false;try{motion=this.systemPreferences?.getAnimationSettings()?.prefersReducedMotion===true;}catch{}return {reducedMotion:motion,reducedTransparency:this.theme?.prefersReducedTransparency===true};}
 async detect(){
  let memoryGiB=null,parallelism=null,compositing='unknown';
  try{const memory=this.os.totalmem();if(Number.isFinite(memory)&&memory>0)memoryGiB=Math.round(memory/1073741824*10)/10;}catch{}
  try{const cores=this.os.availableParallelism();if(Number.isSafeInteger(cores)&&cores>0)parallelism=cores;}catch{}
  let timer;
  try {
   // Basic GPU query establishes readiness; the returned GPU model/driver object is discarded.
   await Promise.race([this.app.getGPUInfo('basic'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('GPU_QUERY_TIMEOUT')),this.queryTimeout);})]);
   const status=this.app.getGPUFeatureStatus()?.gpu_compositing;
   if(['enabled','enabled_force','enabled_force_on','enabled_on','enabled_readback'].includes(status))compositing='hardware';
   else if(['disabled_software','unavailable_software'].includes(status))compositing='software';
  }catch{}finally{clearTimeout(timer);}
  return this.hardware={os:{darwin:'macos',win32:'windows',linux:'linux'}[this.os.platform()]||'other',memoryGiB,parallelism,compositing};
 }
 context(){const value=this.readContext();if(!exact(value,'displayId,dpr,focused,height,minimized,visible,width')||!Number.isFinite(value.width)||value.width<1||value.width>16384||!Number.isFinite(value.height)||value.height<1||value.height>16384||!Number.isFinite(value.dpr)||value.dpr<=0||value.dpr>8||!['string','number'].includes(typeof value.displayId)||['focused','visible','minimized'].some(k=>typeof value[k]!=='boolean'))throw Error('SAMPLE_CONTEXT_INVALID');return structuredClone(value);}
 async recommendation(preset,reasons,source='hardware'){
  const value={token:token(),preset,graphics:graphicsForPreset(preset),reasons,expiresAt:this.now()+30*60000,source};
  this.observations.set(value.token,{...value,displayId:this.context().displayId,dpr:this.context().dpr,adopted:false,shown:false});
  while(this.observations.size>128)this.observations.delete(this.observations.keys().next().value);
  return value;
 }
 async read(savedGraphics){
  await this.ready;this.savedGraphics=validateGraphics(savedGraphics);const h=this.hardware;
  const smooth=h.compositing==='software'||(h.memoryGiB!==null&&h.memoryGiB<=4);
  const reasons=smooth?[h.compositing==='software'?'当前使用软件合成，建议减轻效果。':'内存不超过 4GiB，建议流畅画面。']:['先从均衡画面开始；核心数和大内存不能代替实际短测。'];
  if(h.compositing==='unknown'||h.memoryGiB===null)reasons.push('本机信息不完整，建议仅供参考。');
  if(matchGraphicsPreset(savedGraphics)==='custom')reasons.push('你已保存自定义组合，建议不会自动覆盖它。');
  return {hardware:structuredClone(h),system:this.system(),recommendation:await this.recommendation(smooth?'smooth':'balanced',reasons),algorithmVersion:'graphics-v1'};
 }
 async presentRecommendation(value){const item=this.observations.get(value);if(!item||item.shown||item.expiresAt<this.now()||item.displayId!==this.context().displayId||item.dpr!==this.context().dpr)return null;item.shown=true;try{await this.onShown(value,item.graphics);}catch{}return null;}
 validateAdoption(value,graphics){const item=this.observations.get(value);if(!item||!item.shown||item.adopted||item.expiresAt<this.now()||(item.displayId!==this.context().displayId||item.dpr!==this.context().dpr))return false;return sameGraphics(item.graphics,validateGraphics(graphics));}
 markAdopted(value){const item=this.observations.get(value);if(item)item.adopted=true;}
 async beginSample(graphics){
  await this.ready;const context=this.context();if(!context.focused||!context.visible||context.minimized)throw Error('SAMPLE_NOT_VISIBLE');
  const system=this.system();const ticket={token:token(),context,system,effectiveGraphics:effective(graphics,system),savedGraphics:validateGraphics(this.savedGraphics),startedAt:this.now()};
  this.samples.clear();this.samples.set(ticket.token,ticket);return structuredClone(ticket);
 }
 cancelSample(value){this.samples.delete(value);return null;}
 invalidateSamples(){this.samples.clear();}
 checkContext(){const context=this.context(),system=this.system();for(const [key,ticket] of this.samples)if(JSON.stringify(context)!==JSON.stringify(ticket.context)||JSON.stringify(system)!==JSON.stringify(ticket.system))this.samples.delete(key);}
 async finishSample(value,summary){
  const ticket=this.samples.get(value);this.samples.delete(value);if(!ticket)throw Error('SAMPLE_EXPIRED');
  const context=this.context(),system=this.system();
  if(JSON.stringify(context)!==JSON.stringify(ticket.context)||JSON.stringify(system)!==JSON.stringify(ticket.system)||this.now()-ticket.startedAt<9000||this.now()-ticket.startedAt>20000)throw Error('SAMPLE_CONTEXT_CHANGED');
  if(!exact(summary,'count,histogram,longIntervals,p95')||!Number.isSafeInteger(summary.count)||summary.count<240||summary.count>4096||!Number.isFinite(summary.p95)||summary.p95<=0||summary.p95>10000||!Number.isSafeInteger(summary.longIntervals)||summary.longIntervals<0||summary.longIntervals>summary.count||!Array.isArray(summary.histogram)||summary.histogram.length!==4||summary.histogram.some(v=>!Number.isSafeInteger(v)||v<0)||summary.histogram.reduce((a,b)=>a+b,0)!==summary.count||summary.histogram[3]!==summary.longIntervals)throw Error('SAMPLE_SUMMARY_INVALID');
  const ratio=summary.longIntervals/summary.count,h=this.hardware,wasHigh=sameGraphics(ticket.effectiveGraphics,graphicsForPreset('high'));
  const high=wasHigh&&h.compositing==='hardware'&&h.memoryGiB!==null&&h.memoryGiB>4&&summary.p95<=20&&ratio<=.01;
  let preset=high?'high':h.compositing==='software'||(h.memoryGiB!==null&&h.memoryGiB<=4)?'smooth':'balanced';
  const reasons=high?['本场景实际高质量效果短测满足参考阈值，可以保留高质量。']:['仅描述当前场景的 rAF 回调间隔，不是屏幕呈现 FPS。'];
  if(!wasHigh)reasons.push('本次没有测到完整高质量效果，不能外推高质量表现。');
  const report={os:h.os,memory:bucket(h.memoryGiB,[4,8,16],['le4','le8','le16','gt16']),parallelism:bucket(h.parallelism,[2,4,8],['le2','le4','le8','gt8']),compositing:h.compositing,pixel_load:bucket(context.width*context.height*context.dpr**2,[1e6,3e6,8e6],['le1m','le3m','le8m','gt8m']),saved_graphics:ticket.savedGraphics,effective_graphics:ticket.effectiveGraphics,preset:matchGraphicsPreset(ticket.effectiveGraphics),reduced_motion:system.reducedMotion,reduced_transparency:system.reducedTransparency,p95:bucket(summary.p95,[20,33,50],['le20','le33','le50','gt50']),long_interval_ratio:bucket(ratio,[.01,.05],['le1pct','le5pct','gt5pct']),algorithm_version:'graphics-v1',samples:summary.count};
  try{await this.onPerformance(report);}catch{}
  return {hardware:structuredClone(h),system,recommendation:await this.recommendation(preset,reasons,'sample'),algorithmVersion:'graphics-v1',sample:{valid:true,count:summary.count,p95:summary.p95,longIntervalRatio:ratio,histogram:[...summary.histogram],width:context.width,height:context.height,dpr:context.dpr,effectiveGraphics:ticket.effectiveGraphics}};
 }
}
module.exports={HardwareService,effective};
