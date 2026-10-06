import {useState,type Dispatch,type SetStateAction} from 'react';
import type {Profile,Settings} from './types';
import {graphicsForPreset,sameGraphics} from './graphics.cjs';
export function useSettingsDraft(profile:Profile|null){
 const [nickname,setNickname]=useState(''),[avatar,setAvatar]=useState('leaf');
 const [settings,setValue]=useState<Settings>({music:60,effects:70,fullscreen:false,graphics:graphicsForPreset('balanced'),cardStyle:'illustrated'});
 const [recommendationToken,setRecommendationToken]=useState<string|null>(null);
 const setSettings:Dispatch<SetStateAction<Settings>>=next=>setValue(current=>{const value=typeof next==='function'?next(current):next;if(!sameGraphics(value.graphics,current.graphics))setRecommendationToken(null);return value;});
 const open=(saved:Profile)=>{setNickname(saved.nickname);setAvatar(saved.avatar_id);setValue({...saved.settings,graphics:{...saved.settings.graphics}});setRecommendationToken(null);};
 const applyRecommendation=(graphics:Settings['graphics'],token:string)=>{setValue(current=>({...current,graphics:{...graphics}}));setRecommendationToken(token);};
 const dirty=Boolean(profile&&(nickname!==profile.nickname||avatar!==profile.avatar_id||settings.music!==profile.settings.music||settings.effects!==profile.settings.effects||settings.fullscreen!==profile.settings.fullscreen||settings.cardStyle!==profile.settings.cardStyle||!sameGraphics(settings.graphics,profile.settings.graphics)));
 return {nickname,setNickname,avatar,setAvatar,settings,setSettings,open,dirty,recommendationToken,applyRecommendation};
}
