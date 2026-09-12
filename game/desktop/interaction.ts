import type { Option } from './types';
export const groups = ['attack','defense','skill'] as const;
export function orderedOptions(options: Option[]): Option[] {
  return groups.flatMap(group=>options.filter(o=>o.ui_group===group).sort((a,b)=>Number(b.available)-Number(a.available)||a.doc_id.localeCompare(b.doc_id)));
}
export function shortcutEntry(options: Option[], key: string, blocked: boolean): string|null {
  if (blocked || !/^[0-9]$/.test(key)) return null;
  return orderedOptions(options).filter(o=>o.available)[key==='0'?9:Number(key)-1]?.entry_id || null;
}
