# 控件迭代与只读调查｜2026-10-05

工作区 `.worktrees/video-settings`，分支 `codex/video-settings-20261004`，起点 `4c8b4656d26fecbe5964a2ac18b51a723f456b14`。本轮保留此前图鉴效果、动态高度及紧密堆叠的未提交改动。返回按钮、菜单焦点、设置滚动布局只调查，未修改。

## 返回按钮有几种，为什么没有统一

按 CSS 与使用场景统计，**回主菜单有四类**；加上图鉴内部返回是五类。并非五个统一组件。

| 类别 | 使用位置 | 当前表现与来源 |
| --- | --- | --- |
| `.settings-back` | 单人准备、设置、图鉴、好友前厅／房间 | 玻璃矩形、左箭头；基础在 `styles/stage.css`，各页继续覆盖 |
| `.welcome-tools button` | 欢迎开发预览结束 | 紧凑工具按钮，`welcome.css` 独立定义 |
| `.tutorial-coach button` | 新手实战完成 | 教学面板矩形动作按钮，`styles/tutorial.css` 独立定义 |
| `.result-actions button` | 对局结算返回 | 切角动作按钮，带 EXIT 副标，结算样式独立定义 |
| `.archive-related-back` | 图鉴关联页回到上一张 | 无背景文字返回，`styles/archive.css` 独立定义 |

同一个 `.settings-back` 也不等于同样外观。此次实测：单人 190×46、好友前厅 135.7×46、图鉴 150×48、设置 160×46 CSS px。图鉴的 `.archive-screen button` 广泛覆盖背景、边框、阴影和内边距；单人另设最小宽度；设置随布局缩窄。均衡画面档下，设置／图鉴玻璃关闭，好友／单人仍有 12px 玻璃，来自画面样式的页面作用域差异。

确认原因：没有共享 BackButton，只有页面各自的 button／class；DESIGN 的 L3 工具动作指导没有规定返回按钮固定几何和统一调用方式；页面级覆盖与画面配置作用域进一步制造差异。L3 的“无扫光”指导与 `.settings-back` 的扫描装饰也存在既有冲突。本轮不修。

## 首次主菜单单人按钮蓝框

`renderer.tsx:107` 在欢迎进入主页后主动对第一个 `.menu-option` 调用 focus，它正是单人对局。`styles/stage.css` 的 `:focus-visible` 给它冰青内描边，因此视觉上像已选择。

隔离档案分别复现鼠标进入与键盘 Enter 进入：两者均聚焦第一个按钮；键盘路径 `focus-visible=true`、冰青内描边出现；鼠标路径为 false。按钮没有 `aria-pressed`，也没有已选择模式状态。**这是焦点提示，不是选择了单人模式。** 本轮保留既有键盘行为与样式。

## 设置画面选项的小高度滚动

原生 Electron 最小内容高度为 650px。本次请求 540px 被系统夹回 650px，不能称为 540px 原生验收。在实际 1366×650 内容区，document 高度约 667px，外层发生溢出；1366×768 时仍有少量外层溢出，见 JSON 实测。

`styles/stage.css` 的 `.settings-layout` 只有 min-height:100vh，没有固定可用高度；右侧 `.settings-content` overflow:hidden，而 fieldset／tab-panel 没有独立滚动和可收缩高度。网格按内容自然撑高，整页最终产生滚动条。`styles/preferences.css` 另有高度不超过 600px 的外层自动滚动规则，但没有在原生 650px 下触发，不能归因给该规则。

**右侧内容独立滚动和柔和边缘可实现。** 后续可让页面使用 100dvh 高度预算，网格内容行 minmax(0,1fr)，右侧框架 min-height:0；标题和保存操作固定，只让中间选项区 overflow-y:auto。将渐隐 mask 放在选项内容包装层，滚动条放在外侧，复用全站滚动条；上下边缘根据滚动位置显示渐隐。这样左侧导航、标题、保存按钮仍在原位。本轮仅方案判断，没有修改布局／增加 mask。

## 本轮实现与反馈修正

- 时长共用 TurnTimeSelector：细轨道、移动光晕、320ms 位置过渡，无下方说明。单人保留不限时，未接通秒数禁用；创建房间与前厅／对局中的房主未来时限弹窗按服务 capabilities 显示真实选项。
- 单人／创建房间规则入口共用 RuleButton，恢复原轻薄结构，与时长行同高 54px；按确认答案只保留入口壳，aria-disabled 与提示说明界面待加入，未建立规则页／协议字段。
- 好友房间号和密码复用 TextInput；checkbox 透明底、选中 2px 边框和实心方形光点，无勾号；加入身份、欢迎水平和头像状态保留原生语义并统一反馈。
- Select 使用 Electron 原生 customizable select，统一带图标选项、方形选中标记、打开／关闭过渡和焦点。关闭态补当前图标、层次渐变和细线；弹出菜单深色不透明，避免背后文字干扰。保留原生键盘、顶层弹出、Escape 与 disabled。
- 用户否定第一版粗轨道／球形滑块和重规则框后，按上述轻薄方案重做；未新增依赖，不改玩法、模型、档案／网络格式。

## 验证与边界

`npm --prefix game/desktop run build`（类型＋构建）通过；定向 `node --test game/desktop/test-graphics.cjs game/desktop/test-navigation.cjs game/desktop/tests-online/test-v11.cjs` 20 项通过。新增 `DEIDEI_SMOKE_OUTPUT=/path/to/output node game/desktop/smoke-ui-controls.cjs` 可复跑：实际 Electron 30 项通过、renderer error 0，包括时长逐帧插值、原生键盘、禁用项、共享输入、前厅／对局两处未来时限、原有房主 revision 提交、下拉打开／选项／Escape、自定义识别、系统减少动态、选择框状态和实际尺寸。

证据在主仓库忽略目录 `.local-outputs/frontend-round2/ui-controls-revision-1/`，九张截图、checks.json、cleanup.json。用临时合成档案和现有 MOCK 房间传输，正常退出并清理自己的档案；不代表真实服务／跨设备联机或发行包验收。历史 smoke 失败记录另目录保留（定位／采样等待／窗口焦点修正），不删产品断言；一次旧脚本退出挂起仅终止自己的测试进程，开发监听未终止。未重跑完整 Python／全部 Node／性能基准。Kimi 未调用。


## 返回、首次焦点与设置滚动落实｜2026-10-05

用户后续明确授权三项修改。返回按钮统一复用 `.ui-back`：当前图鉴的冰青箭头、半透明玻璃底、细边框与悬停扫光；宽度沿用各页面布局。覆盖单人、好友、图鉴及关联返回、设置、欢迎预览、教程完成和结算；画面档位与系统减少透明／动态偏好继续生效。移除欢迎进入主菜单后主动 focus 首个单人按钮的 effect；Tab 键盘焦点仍保留。

设置页以 100dvh 分配高度，标题、左侧分类与保存区固定，只让原 fieldset 原生独立滚动。复用 controls.css 全站滚动条及既有自动显隐；滚动位置／ResizeObserver 更新上下24px渐隐，右侧12px轨道单独保留不透明以便拖动；分类切换复位。无新依赖，保存与 disabled 逻辑沿用。

`npm --prefix game/desktop run build`、`node --test game/desktop/test-navigation.cjs`（5项）与 diff／脚本语法检查通过。可复跑 `DEIDEI_SMOKE_OUTPUT=/path/to/output node game/desktop/smoke-settings-scroll.cjs`：实际 Electron 29项通过；原控件专项 smoke-ui-controls.cjs 更新首次焦点断言后31项通过，均 renderer error 0、正常退出／清理自建临时档案。1366×650／768／900 与1000×650实际原生尺寸往返检查无整页溢出；验证滚轮／End／滑块拖动、边缘方向、自动显隐、顶层下拉、保存回读、7处返回样式一致及真实六步教程完成。好友链路为 MOCK，不代表真人跨设备联机。

证据保留主仓库忽略目录 `.local-outputs/frontend-round2/settings-scroll-3/` 与 `ui-controls-return-scroll/`。额外 mask 检查首次失败是 Chromium 两层 maskComposite 返回 `add, add`；改检查为逐层断言后通过，未修改产品掩盖失败，旧证据保留。未重跑完整 Python／Node／发行包／性能基准；工作区保留未归档／提交／推送，Kimi 未调用。
