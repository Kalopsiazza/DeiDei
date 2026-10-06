const {test}=require('node:test');const assert=require('node:assert/strict');
const {HardwareService}=require('./service.cjs');const {graphicsForPreset}=require('../graphics.cjs');
const context=()=>({width:1366,height:768,dpr:2,displayId:1,focused:true,visible:true,minimized:false});
function service(options={}){let now=0;const osApi={totalmem:()=>16*1073741824,availableParallelism:()=>12,platform:()=> 'darwin',...options.osApi};const app={getGPUInfo:async()=>({secretGPUName:'Never forward'}),getGPUFeatureStatus:()=>({gpu_compositing:'enabled'}),...options.app};return {h:new HardwareService({app,nativeTheme:{prefersReducedTransparency:false},systemPreferences:{getAnimationSettings:()=>({prefersReducedMotion:false})},readContext:context,now:()=>now,...options,osApi}),clock:value=>{now=value;}};}
test('hardware whitelist and conservative baseline: unknown, software, low RAM, high cores and custom',async()=>{
 const baseline=service();const r=await baseline.h.read(graphicsForPreset('high'));assert.equal(r.recommendation.preset,'balanced');assert.equal(r.hardware.parallelism,12);assert.ok(!JSON.stringify(r).includes('Never forward'));
 const low=service({osApi:{totalmem:()=>4*1073741824}});assert.equal((await low.h.read(graphicsForPreset('balanced'))).recommendation.preset,'smooth');
 const software=service({app:{getGPUInfo:async()=>({}),getGPUFeatureStatus:()=>({gpu_compositing:'disabled_software'})}});assert.equal((await software.h.read(graphicsForPreset('high'))).recommendation.preset,'smooth');
 const unknown=service({app:{getGPUInfo:async()=>{throw Error('query failed');}}});const u=await unknown.h.read({ambientMotion:'full',glass:'off',decoration:'full'});assert.equal(u.hardware.compositing,'unknown');assert.ok(u.recommendation.reasons.some(v=>v.includes('自定义')));
 const timeout=service({queryTimeout:2,app:{getGPUInfo:()=>new Promise(()=>{})}});assert.equal((await timeout.h.read(graphicsForPreset('balanced'))).hardware.compositing,'unknown');
});
test('only valid actual high scene can recommend high; successful samples produce closed aggregate',async()=>{
 let report;const s=service({onPerformance:async value=>{report=value;}});await s.h.read(graphicsForPreset('high'));const ticket=await s.h.beginSample(graphicsForPreset('high'));s.clock(10000);const result=await s.h.finishSample(ticket.token,{count:480,p95:18,longIntervals:0,histogram:[480,0,0,0]});assert.equal(result.recommendation.preset,'high');assert.equal(report.preset,'high');assert.equal(report.pixel_load,'le8m');assert.ok(!Object.hasOwn(report,'displayId'));
 const balanced=await s.h.beginSample(graphicsForPreset('balanced'));s.clock(20000);const lower=await s.h.finishSample(balanced.token,{count:480,p95:18,longIntervals:0,histogram:[480,0,0,0]});assert.equal(lower.recommendation.preset,'balanced');
 await s.h.presentRecommendation(result.recommendation.token);assert.equal(s.h.validateAdoption(result.recommendation.token,graphicsForPreset('high')),true);s.h.markAdopted(result.recommendation.token);assert.equal(s.h.validateAdoption(result.recommendation.token,graphicsForPreset('high')),false);
});
test('sample cancel, visibility/resize/display/system invalidation and bounds',async()=>{
 let ctx=context();const s=service({readContext:()=>ctx});await s.h.read(graphicsForPreset('balanced'));let ticket=await s.h.beginSample(graphicsForPreset('high'));s.clock(10000);ctx={...ctx,width:1000};await assert.rejects(s.h.finishSample(ticket.token,{count:480,p95:18,longIntervals:0,histogram:[480,0,0,0]}),/CONTEXT_CHANGED/);
 ctx=context();ticket=await s.h.beginSample(graphicsForPreset('high'));s.h.cancelSample(ticket.token);await assert.rejects(s.h.finishSample(ticket.token,{count:480,p95:18,longIntervals:0,histogram:[480,0,0,0]}),/EXPIRED/);
 ctx={...context(),focused:false};await assert.rejects(s.h.beginSample(graphicsForPreset('high')),/NOT_VISIBLE/);
 ctx=context();ticket=await s.h.beginSample(graphicsForPreset('high'));s.clock(20000);await assert.rejects(s.h.finishSample(ticket.token,{count:4097,p95:18,longIntervals:0,histogram:[4097,0,0,0]}),/SUMMARY_INVALID/);
});
