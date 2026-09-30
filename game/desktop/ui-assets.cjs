const MOVE_ASSETS=['Charge','Bi','Def','Three','ThreeDef','BigBi','Reflect','SelfBi','Cloud','Bomb','Xiao','Pragon','PragonDef','Volvo','VolvoDef','RotateThree','XiaoBei','FlipVolvo','Shell','Absorb','NieXiang','NieXiangDef','JuYan','TianLiJun','ZhangXinWei','LiQiang','BombPragon','BombVolvo','BombFlipVolvo','FreeThree','FreeRotateThree','ZengYi','ZengRewardBigBi'];
const UI_ASSETS=Object.freeze({
  'index.html':'text/html; charset=utf-8',
  'renderer.js':'text/javascript',
  'style.css':'text/css',
  'assets/menu/menu-environment.webp':'image/webp',
  'assets/menu/menu-character.png':'image/png',
  'assets/menu/menu-atmosphere.png':'image/png',
  'assets/battle/battle-table-v1.webp':'image/webp',
  ...Object.fromEntries(MOVE_ASSETS.map(name=>[`assets/moves/${name}.png`,'image/png'])),
});

const resolveUiAsset=name=>Object.hasOwn(UI_ASSETS,name)
  ? {relativePath:name,contentType:UI_ASSETS[name]}
  : null;

module.exports={UI_ASSETS,resolveUiAsset};
