export type GraphicsPreset = 'high' | 'balanced' | 'smooth';
export type GraphicsSettings = {
  ambientMotion: 'full' | 'reduced' | 'off';
  glass: 'full' | 'light' | 'off';
  decoration: 'full' | 'simple';
};
export function graphicsForPreset(id: GraphicsPreset): GraphicsSettings;
export function validateGraphics(value: unknown): GraphicsSettings;
export function sameGraphics(a: GraphicsSettings, b: GraphicsSettings): boolean;
export function matchGraphicsPreset(value: GraphicsSettings): GraphicsPreset | 'custom';
