import type {SampleTicket,SampleSummary} from './types';
// Raw intervals live only for this sample and are discarded on finish or cancellation.
export function sampleScene(ticket:SampleTicket,onProgress:(remaining:number)=>void,signal:AbortSignal):Promise<SampleSummary>{
 return new Promise((resolve,reject)=>{
  let frame=0,start=0,last=0;let intervals:number[]=[];
  const motion=matchMedia('(prefers-reduced-motion: reduce)'),transparency=matchMedia('(prefers-reduced-transparency: reduce)');
  const valid=()=>document.visibilityState==='visible'&&document.hasFocus()&&window.innerWidth===ticket.context.width&&window.innerHeight===ticket.context.height&&window.devicePixelRatio===ticket.context.dpr;
  const clean=()=>{cancelAnimationFrame(frame);window.removeEventListener('blur',invalid);window.removeEventListener('resize',invalid);document.removeEventListener('visibilitychange',invalid);motion.removeEventListener('change',invalid);transparency.removeEventListener('change',invalid);signal.removeEventListener('abort',cancel);};
  const invalid=()=>{clean();intervals=[];reject(new Error('SAMPLE_CONTEXT_CHANGED'));};
  const cancel=()=>{clean();intervals=[];reject(new Error('SAMPLE_CANCELLED'));};
  window.addEventListener('blur',invalid);window.addEventListener('resize',invalid);document.addEventListener('visibilitychange',invalid);motion.addEventListener('change',invalid);transparency.addEventListener('change',invalid);signal.addEventListener('abort',cancel,{once:true});
  const tick=(time:number)=>{
   if(signal.aborted){cancel();return;}if(!valid()){invalid();return;}
   if(!start)start=time;
   const elapsed=time-start;onProgress(Math.max(0,Math.ceil((10000-elapsed)/1000)));
   if(elapsed>=2000&&last&&intervals.length<4096)intervals.push(time-last);last=time;
   if(elapsed>=10000){
    clean();const count=intervals.length;
    if(count<240){intervals=[];reject(new Error('SAMPLE_TOO_FEW'));return;}
    const sorted=[...intervals].sort((a,b)=>a-b),p95=sorted[Math.ceil(count*.95)-1];
    const histogram:[number,number,number,number]=[0,0,0,0];for(const value of intervals)histogram[value<=20?0:value<=33?1:value<=50?2:3]++;
    intervals=[];resolve({count,p95,longIntervals:histogram[3],histogram});return;
   }
   frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
 });
}
