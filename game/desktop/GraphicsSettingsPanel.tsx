import React from 'react';
import { graphicsForPreset, matchGraphicsPreset, validateGraphics } from './graphics.cjs';
import type { GraphicsPreset, GraphicsSettings } from './graphics.cjs';

export function GraphicsSettingsPanel({value,onChange,disabled}:{value:GraphicsSettings;onChange:(next:GraphicsSettings)=>void;disabled:boolean}) {
 const preset=matchGraphicsPreset(value);
 return <div className="graphics-panel">
  <p>调整后即时预览，保存后在下次启动保留。</p>
  <label><span>画面预设</span><select aria-label="画面预设" value={preset} disabled={disabled} onChange={e=>onChange(graphicsForPreset(e.currentTarget.value as GraphicsPreset))}>
   <option value="high">高质量</option><option value="balanced">均衡</option><option value="smooth">流畅</option>{preset==='custom'&&<option value="custom" disabled>自定义</option>}
  </select><small>手动调整细项后，会自动识别当前组合。</small></label>
  {([
   ['ambientMotion','动态效果',[['full','完整'],['reduced','减少'],['off','静止']],'环境与装饰循环；页面切换和操作反馈继续保留。'],
   ['glass','玻璃效果',[['full','完整'],['light','轻量'],['off','关闭']],'调整界面毛玻璃，关闭后使用更实的深色底。'],
   ['decoration','装饰效果',[['full','完整'],['simple','简化']],'调整光晕与阴影，保留文字、选中和焦点提示。']
  ] as const).map(([key,label,options,note])=><label key={key}><span>{label}</span><select aria-label={label} value={value[key]} disabled={disabled} onChange={e=>onChange(validateGraphics({...value,[key]:e.currentTarget.value}))}>{options.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select><small>{note}</small></label>)}
  <p className="graphics-system-status" role="status"><span className="graphics-system-motion">系统“减少动态”正在生效。</span><span className="graphics-system-transparency">系统“减少透明度”正在生效。</span></p>
 </div>;
}
