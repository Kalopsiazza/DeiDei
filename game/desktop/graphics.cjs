const presets = Object.freeze({
  high: Object.freeze({ ambientMotion: 'full', glass: 'full', decoration: 'full' }),
  balanced: Object.freeze({ ambientMotion: 'reduced', glass: 'light', decoration: 'simple' }),
  smooth: Object.freeze({ ambientMotion: 'off', glass: 'off', decoration: 'simple' }),
});
function graphicsForPreset(id) {
  if (!Object.hasOwn(presets, id)) throw new Error('INVALID_GRAPHICS');
  return { ...presets[id] };
}
function validateGraphics(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join() !== 'ambientMotion,decoration,glass'
    || !['full', 'reduced', 'off'].includes(value.ambientMotion)
    || !['full', 'light', 'off'].includes(value.glass)
    || !['full', 'simple'].includes(value.decoration)) throw new Error('INVALID_GRAPHICS');
  return { ambientMotion: value.ambientMotion, glass: value.glass, decoration: value.decoration };
}
function sameGraphics(a, b) {
  return a.ambientMotion === b.ambientMotion && a.glass === b.glass && a.decoration === b.decoration;
}
function matchGraphicsPreset(value) {
  return Object.keys(presets).find(id => sameGraphics(value, presets[id])) || 'custom';
}
module.exports = { graphicsForPreset, validateGraphics, sameGraphics, matchGraphicsPreset };
