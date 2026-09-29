const UI_ASSETS=Object.freeze({
  'index.html':'text/html; charset=utf-8',
  'renderer.js':'text/javascript',
  'style.css':'text/css',
  'assets/menu/menu-environment.webp':'image/webp',
  'assets/menu/menu-character.png':'image/png',
  'assets/menu/menu-atmosphere.png':'image/png',
});

const resolveUiAsset=name=>Object.hasOwn(UI_ASSETS,name)
  ? {relativePath:name,contentType:UI_ASSETS[name]}
  : null;

module.exports={UI_ASSETS,resolveUiAsset};
