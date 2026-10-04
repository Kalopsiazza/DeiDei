# 二轮调查：图鉴景深、滚动条与二级菜单动效

2026-10-04。基于 PR #36 当前 head e78edb3 的二轮工作区；以下保留当时的只读调查。随后用户授权的全站滚动条已实施，见 `NOTES.md` 的“全站滚动条与阶段提交”；本报告的旧皮肤表与建议是调查时状态。景深、边缘虚化和进出动画仍未修改。

## 图鉴效果为何消失

已确认由 `1b2b7a1`（2026-10-04，`fix(desktop): fit battle controls and reduce archive rendering cost`）的性能优化主动移除，不是浏览器漏加载。其 archive.css 差异明确删除：

- 列表的纵向与横向两层 mask 和 mask-composite：上下、左右边缘自然渐隐消失。
- 卡片按深度叠加的 brightness／saturate／blur：逐层变暗、降饱和与景深虚化消失。
- 背景和人物的 3px blur、人物阴影、档案底板 backdrop-filter。
- 图鉴背景 transform／filter 插值，改为仅 transition-property:opacity；四项环境循环暂停。

当前普通 main 实测：DPR2，减少动态与减少透明度均为 false；卡牌列表 mask-image=none，卡面 filter=none。卡片收窄、重叠、rotateX 与透明度仍保留。因此“立体几何还在，景深和边缘虚化不在”是现状。

## 滚动条能否统一

可以。现有原生滚动容器足够，无需新滚动库。当前没有全站统一滚动条组件或 token：

| 区域 | 当前定义 |
| --- | --- |
| 图鉴卡牌列表 | thin，青色 #8ceaf34b，透明轨道 |
| 图鉴图标列表 | thin，scrollbar-color=auto（实测） |
| 图鉴详情 | thin，#8ceaf35b，透明轨道 |
| 横向场景条 | thin，#8ceaf344，透明轨道 |
| 图鉴规则弹窗 | thin，#8ceaf359，透明轨道 |
| 局势时间轴／玩家列表 | thin，青色；另有 WebKit 5px、渐变滑块、圆角定义 |

卡牌切换创建的是正常的可滚动列表，不是多余溢出：实测 clientHeight454／scrollHeight5190，无横向溢出。该列表滚动条声明在性能改动之前就存在；失去边缘 mask 后视觉更暴露，但不能把它误报为本轮新加的滚动条。图标模式和卡牌模式的颜色确实不一致。

建议统一为原生 thin、低透明青色滑块、透明深色轨道，并统一悬停／键盘状态。渐隐应作用于列表内容，滚动条保留在清晰区域；避免用 mask 同时裁掉交互控件。本次未实施。

## 主页到二级菜单：数量与实际行为

统计口径：主菜单的四个页面入口（单人准备、联机前厅、经典规则手册、设置），不把环境循环、按钮悬停、弹窗或一个镜头中的多个 CSS 属性重复计为独立页面动画。“退出游戏”属于确认弹窗，不是二级页面。

**四条进入路线都有前景入场，按视觉组数为5组（准备1、联机左右2、图鉴1、设置1）；三条有连续背景镜头，一条图鉴镜头直接跳到目标。四条返回路线各有1组主页菜单入场，联机额外1组玻璃揭幕；但成功的二级内容退场为 0/4。** 图鉴有退场定义和等待，但当前被样式覆盖。

| 路线 | 进入 | 二级内容离开 | 回到主页 |
| --- | --- | --- | --- |
| 单人准备 | 背景950ms；prepare-ui-in 660ms＋延迟120ms | 直接卸载，实测首个主页帧约59ms | 镜头950ms回退；menu-rail-in 550ms＋延迟50ms |
| 好友联机前厅 | 背景950ms；左文案550ms；右操作550ms＋延迟120ms | 离开接口完成后直接卸载，MOCK实测约29ms | 镜头950ms；玻璃揭幕1100ms；菜单600ms |
| 经典规则手册 | 背景立即就位，仅人物／氛围透明度渐变；archive-enter 580ms＋延迟120ms | **不执行淡出**：等待380ms后卸载，实测主页帧约395ms | 世界层立即复位；人物透明度与之后的氛围回退仍有片段；菜单600ms |
| 设置（无未保存修改） | 背景950ms；settings-ui-in 580ms＋延迟240ms | 直接卸载，实测约44ms | 镜头950ms回退；菜单600ms |

表中29／44／59／395ms是这次逐帧采样的观察值，不是固定产品时长；接口与调度可能改变首帧时间。联机测的是本机 MOCK 前厅返回，不代表真实房间断线／结束路径。设置有未保存修改时会先走既有确认弹窗。

### 图鉴进出缺失的具体原因

1. `styles/archive.css:10` 限制 scene-plane 只动画 opacity，所以进入及离开时 world 的 transform／filter 直接变为终点。`styles/archive.css:180` 还用 display:none 隐藏大厅标题，其淡出／回归也无法连续。
2. `archive-screen` 的 archive-enter 带 `both`，完成后仍以动画优先级维持 opacity:1、transform:identity；data-leaving=true 的 opacity:0 与下沉／缩小规则未能接管。
3. 普通 main 逐帧证据：返回后43／177／344ms均为 leaving=true、opacity=1、transform=identity，只有 finished 的 archive-enter，没有 opacity／transform 退场 transition；世界层已为 transform:none。395ms页面换为menu。

因此入场前景没有消失，背景推进消失；退场前景确实失效。这一点不能仅靠读到CSS声明就宣称动画存在。

## 有没有标准

有文档标准，落地不完整且文档互相冲突：

- `DESIGN.md:195` 要求页面进入500—950ms、多层transform／opacity；230行要求图鉴进入推进、返回拉回、逐层景深和四边自然渐隐。
- 同文件88行的性能补充却要求取消图鉴镜头插值、逐层滤镜与双重mask，没有同步改写原页面验收。
- 通用表没有“普通二级页面退出”的统一时长／顺序；终局返回另有600—800ms标准，不能当成所有页面返回标准。
- 时长分散写在stage／prepare／online／archive CSS，卸载由不同回调／timer控制，未形成统一的进出契约。
- 减少动态偏好会主动停用上述多项效果；这次设备该偏好为false，不能用偏好解释此次缺失。

建议下一轮先明确共同顺序“内容退场 → 镜头回退与主页入场”，约220—350ms内容退场、500—950ms镜头；图鉴恢复轻量的内容渐隐和景深后，用普通main、1920×1080／DPR2、同输入滚轮对照复验性能。应修复冲突、保留视觉要求，而不是仅把文档删到匹配缺失效果。本次只报告，未执行修复。

## 证据和边界

主仓库忽略目录 `.local-outputs/frontend-round2/navigation-audit/`：`audit.json` 逐帧记录、`manual-cards.png`／`manual-icons.png`、五尺寸水平选择页截图。脚本 `.local-outputs/frontend-round2/audit-navigation.cjs` 启动普通main、使用临时本机档案，最终清理自建临时目录；用户档案未改。观察范围为上述四条直接入口及返回，不是游戏所有内部场景的完整验收。

使用 VEW，自查；Kimi未调用。
