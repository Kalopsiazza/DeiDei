import type {Reply,GraphicsSettings,GraphicsPreset} from '../types';
export type Hardware={os:'macos'|'windows'|'linux'|'other';memoryGiB:number|null;parallelism:number|null;compositing:'unknown'|'hardware'|'software'};
export type SystemEffects={reducedMotion:boolean;reducedTransparency:boolean};
export type Recommendation={token:string;preset:GraphicsPreset;graphics:GraphicsSettings;reasons:string[];expiresAt:number;source:'hardware'|'sample'};
export type HardwareState={hardware:Hardware;system:SystemEffects;recommendation:Recommendation;algorithmVersion:'graphics-v1'};
export type SampleTicket={token:string;context:{width:number;height:number;dpr:number;displayId:string|number;focused:boolean;visible:boolean;minimized:boolean};system:SystemEffects;effectiveGraphics:GraphicsSettings;savedGraphics:GraphicsSettings;startedAt:number};
export type SampleSummary={count:number;p95:number;longIntervals:number;histogram:[number,number,number,number]};
export type SampleResult=HardwareState&{sample:{valid:true;count:number;p95:number;longIntervalRatio:number;histogram:[number,number,number,number];width:number;height:number;dpr:number;effectiveGraphics:GraphicsSettings}};
export type HardwareBridge={presentRecommendation(token:string):Promise<Reply<null>>;read():Promise<Reply<HardwareState>>;beginSample(graphics:GraphicsSettings):Promise<Reply<SampleTicket>>;finishSample(token:string,summary:SampleSummary):Promise<Reply<SampleResult>>;cancelSample(token:string):Promise<Reply<null>>};
