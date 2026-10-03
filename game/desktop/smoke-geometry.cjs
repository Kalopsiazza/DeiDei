// Actual geometry checks shared by the issue #35 public-control drivers.
const assert=require('node:assert/strict');

async function checkBattle(page,report,label,{cards=0,seats=0,names=[],minHistory=1}={}){
 const value=await page.evaluate(({cards,seats})=>{
  const box=n=>{const r=n.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const viewport={left:0,top:0,right:innerWidth,bottom:innerHeight};
  const inside=(r,b)=>r.left>=b.left-1&&r.top>=b.top-1&&r.right<=b.right+1&&r.bottom<=b.bottom+1;
  const positive=r=>r.width>0&&r.height>0;
  const text=n=>{
   if(!n)return {text:'',ok:false,rects:[]};
   const walker=document.createTreeWalker(n,NodeFilter.SHOW_TEXT),rects=[];let node;
   while((node=walker.nextNode()))if(node.textContent.trim()){
    const range=document.createRange();range.selectNodeContents(node);
    const bounds=[viewport];
    for(let a=node.parentElement;a;a=a.parentElement){const s=getComputedStyle(a),b=box(a);if(s.overflowX!=='visible'||s.overflowY!=='visible')bounds.push({left:s.overflowX==='visible'?-Infinity:b.left,right:s.overflowX==='visible'?Infinity:b.right,top:s.overflowY==='visible'?-Infinity:b.top,bottom:s.overflowY==='visible'?Infinity:b.bottom});}
    const button=n.closest('.card-pick');
    rects.push(...[...range.getClientRects()].map(r=>{const value={left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};const hits=!button||[r.left+Math.min(2,r.width/2),r.right-Math.min(2,r.width/2)].every(x=>{const hit=document.elementFromPoint(x,r.top+r.height/2);return hit&&(hit===button||button.contains(hit));});return {...value,visible:positive(value)&&bounds.every(b=>inside(value,b))&&hits};}));
   }
   // Inspect actual Range line boxes, not only scrollWidth (which misses clamped rows).
   return {text:n.textContent.trim(),font:getComputedStyle(n).fontSize,rects,ok:!!n.textContent.trim()&&rects.length>0&&rects.every(r=>r.visible)};
  };
  const table=document.querySelector('.battle-table'),arena=document.querySelector('.battle-arena');
  const deck=cards?[...document.querySelectorAll('.battle-cards .card')].map(n=>{
   const button=n.querySelector('.card-pick'),name=n.querySelector('.card-name'),copy=n.querySelector('.card-pick strong'),b=box(button),s=getComputedStyle(button);
   return {entry:n.dataset.entry,aria:button.getAttribute('aria-label'),name:name?.textContent,tags:[...n.querySelectorAll('.card-tags em')].map(t=>t.textContent),box:b,copy:text(copy),ok:positive(b)&&inside(b,viewport)&&s.visibility==='visible'&&Number(s.opacity)>0};
  }):[];
  const roster=seats?[...document.querySelectorAll('.arena-seat')].map((n,index)=>{
   const profile=n.querySelector('.seat-profile'),nickname=n.querySelector('.seat-profile strong');
   const parts=[['profile',profile],['avatar',profile?.querySelector('.avatar')],...[...n.querySelectorAll('.move-card[data-turn]')].map(c=>['history-'+c.dataset.turn,c])].map(([kind,node])=>node?{index,kind,box:box(node)}:{index,kind,missing:true});
   return {name:nickname?.textContent.trim(),copy:text(nickname),history:[...n.querySelectorAll('.move-card[data-turn]')].map(c=>({turn:c.dataset.turn,name:c.querySelector('strong')?.textContent})),parts};
  }):[];
  const parts=roster.flatMap(p=>p.parts),overlaps=[];
  for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){const a=parts[i],b=parts[j];if(a.index===b.index||a.missing||b.missing)continue;if(Math.min(a.box.right,b.box.right)-Math.max(a.box.left,b.box.left)>4&&Math.min(a.box.bottom,b.box.bottom)-Math.max(a.box.top,b.box.top)>4)overlaps.push([a.index,a.kind,b.index,b.kind]);}
  return {phase:table?.dataset.phase,ready:table?.dataset.ready,viewport,dpr:devicePixelRatio,arena:arena?box(arena):null,deck,roster,overlaps,partsInside:!!arena&&parts.every(p=>!p.missing&&positive(p.box)&&inside(p.box,box(arena))&&inside(p.box,viewport))};
 },{cards,seats});
 (report.battleGeometry||= []).push({label,...value}); // Write evidence before assertions.
 assert.equal(value.ready,'true',label+' arena ready');
 if(cards){assert.equal(value.phase,'selecting',label+' names inspected in selecting');assert.equal(value.deck.length,cards,label+' card count');assert.equal(new Set(value.deck.map(c=>c.entry)).size,cards,label+' unique entries');assert.ok(value.deck.every(c=>c.name?.trim()&&c.aria&&c.ok&&c.copy.ok),label+' all card text line boxes fully visible');}
 if(seats){assert.equal(value.phase,'revealed',label+' seat geometry inspected in revealed');assert.equal(value.roster.length,seats,label+' participant seats');assert.deepEqual(value.roster.map(s=>s.name).sort(),[...names].sort(),label+' exact roster identities');assert.ok(value.roster.every(s=>s.copy.ok&&s.history.length>=minHistory),label+' identity copy and history present');assert.ok(value.partsInside,label+' identity/avatar/all history bounded by arena and viewport');assert.deepEqual(value.overlaps,[],label+' different participants do not overlap');}
 return value;
}

async function armCommitFlight(page){
 await page.evaluate(()=>{
  if(window.__r04CommitFlight)window.__r04CommitFlight.active=false;
  const s=window.__r04CommitFlight={active:true,frames:[],roFrames:[],roEpoch:0};
  const box=n=>{const r=n.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,cx:r.left+r.width/2,cy:r.top+r.height/2};};
  function sample(t,source){
   if(!s.active)return;
   const arena=document.querySelector('.battle-arena'),flight=document.querySelector('.commit-flight'),target=document.querySelector('.self-seat .move-target');
   if(flight&&target){const animation=flight.getAnimations().find(a=>a.animationName==='card-commit'),timing=animation?.effect?.getComputedTiming(),f=box(flight),goal=box(target);
    (source==='raf-before-ro'?s.frames:s.roFrames).push({t,source,roEpoch:s.roEpoch,arena:box(arena),phase:document.querySelector('.battle-table')?.dataset.phase,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,progress:timing?.progress,currentTime:animation?.currentTime,duration:timing?.duration,playState:animation?.playState,flight:f,target:goal,dx:f.cx-goal.cx,dy:f.cy-goal.cy});
   }
  }
  // Registered after BattleStage's observer; preserve pre-RO RAF diagnostics separately.
  s.observer=new ResizeObserver(()=>{s.roEpoch++;sample(performance.now(),'ro-after-product');});
  for(const n of document.querySelectorAll('.battle-arena,.self-seat .move-target'))s.observer.observe(n);
  function frame(t){
   if(!s.active)return;sample(t,'raf-before-ro');
   requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
 });
}

function settledCommitFlight(expectedViewport){
 const frames=window.__r04CommitFlight.frames.slice(-3),last=frames.at(-1),viewport=[innerWidth,innerHeight];
 if(document.querySelector('.battle-table')?.dataset.phase!=='submitting'||!document.querySelector('.commit-flight')||expectedViewport&&viewport.join()!==expectedViewport.join())return false;
 return frames.length===3&&frames.every(f=>f.progress===1&&f.phase==='submitting'&&f.viewport.join()===viewport.join()&&f.roEpoch===last.roEpoch&&['cx','cy','width','height'].every(k=>Math.abs(f.target[k]-last.target[k])<.25&&Math.abs(f.arena[k]-last.arena[k])<.25));
}

async function finishCommitFlight(page,report,label,{required=true,expectedViewport}={}){
 let missing=false;
 const current=await page.evaluate(()=>({viewport:[innerWidth,innerHeight],phase:document.querySelector('.battle-table')?.dataset.phase,hasFlight:!!document.querySelector('.commit-flight'),epoch:window.__r04CommitFlight.roEpoch,lastFrameAge:performance.now()-(window.__r04CommitFlight.frames.at(-1)?.t??performance.now())}));
 // RAF precedes ResizeObserver delivery. Wait for stable target geometry, never for a correct answer.
 try{await page.waitForFunction(settledCommitFlight,expectedViewport??null,{timeout:5000});}catch(e){if(e.name!=='TimeoutError')throw e;missing=true;}
 const {frames,roFrames}=await page.evaluate(()=>{const s=window.__r04CommitFlight;s.active=false;s.observer.disconnect();return {frames:s.frames,roFrames:s.roFrames};});
 const final=frames.filter(f=>f.progress===1&&f.phase==='submitting'),last=final.slice(-3);
 (report.commitGeometry||= []).push({label,current,expectedViewport,source:'actual CSSAnimation; current submitting flight at intended endpoint; stability asserted independently of accuracy; pre-RO RAF and after-product RO separate',missingFinal:missing,frames,roFrames,finalSamples:final.length});
 if(!required&&missing)return {missingFinal:true,frames};
 assert.ok(!missing,label+' completed flight target settles within bounded observation');
 assert.ok(last.length===3,label+' three actual completed animation frames required');
 assert.ok(last.every(f=>f.target.width>0&&f.target.height>0&&f.flight.width>0&&f.flight.height>0&&Math.abs(f.dx)<=2&&Math.abs(f.dy)<=2),label+' final rendered center hits self move-target within 2 CSS px');
 return {frames,finalSamples:final.length};
}

module.exports={checkBattle,armCommitFlight,finishCommitFlight};

if(require.main===module&&process.argv.includes('--self-check')){
 const vm=require('node:vm'),box={cx:10,cy:20,width:30,height:40},frame={progress:1,phase:'submitting',viewport:[1366,768],roEpoch:1,target:box,arena:box};
 const run=({phase='submitting',flight=true,expected=[1366,768],viewport=[1366,768],frames=[frame,frame,frame]}={})=>vm.runInNewContext('('+settledCommitFlight.toString()+')(expected)',{expected,innerWidth:viewport[0],innerHeight:viewport[1],window:{__r04CommitFlight:{frames}},document:{querySelector:s=>s==='.battle-table'?{dataset:{phase}}:flight?{}:null}});
 assert.ok(run());assert.equal(run({phase:'revealed'}),false);assert.equal(run({flight:false}),false);assert.equal(run({expected:[1920,1080]}),false);assert.equal(run({viewport:[1920,1080]}),false);assert.equal(run({frames:[frame,{...frame,roEpoch:2},frame]}),false);
 console.log('PASS current phase/flight/endpoint and stable geometry guards; stale history cannot pass');
}
