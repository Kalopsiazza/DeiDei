# 二轮欢迎页：输入与文字动作调查

2026-10-04，活动工作区 `.worktrees/frontend-round2`，分支 `codex/frontend-round2-20261004`，起点 PR #36 `e78edb305f9b785b89bb3aa3e2e592c2dc64fd5b`。工作区保留、未归档；本轮末按用户授权进行阶段提交和推送，最终 SHA 由 Git 提交及交付回传确认。

## 调查结论

| 原入口 | 原实现与问题 | 本轮结果 |
| --- | --- | --- |
| 图鉴搜索 | `ManualArchive.tsx` 原生 input 加 `.archive-search-field`；`styles/archive.css` 独立定义正常／悬停／焦点渐变，之前没有共享输入组件 | 提取到 `SharedUI.TextInput`、`styles/controls.css`，保留搜索图标、清空和原配色 |
| 欢迎昵称 | `SharedUI.Identity` 返回裸 input，`welcome.css` 独立定义另一套边框、21px 字号和 focus 高光 | 使用同一 TextInput；去掉旧欢迎输入皮肤 |
| 设置昵称 | 同一个 Identity，原先落入 `styles/stage.css` 的设置专用皮肤 | 随 Identity 使用共享输入 |
| 联机文字输入 | `OnlineRoom.tsx` 原生 input 配部署／房号专用规则 | 属于待按标准归一的既有消费者；本次两页改动未扩展联机流程 |
| 重新读取 | `renderer.tsx` 独立原生 button；仅默认态为透明。`foundation.css` 的 `button:hover:not(:disabled)` 特异性高于 `.welcome-card-front .welcome-reload`，造成浅色底 | 纯文字样式覆盖正常／悬停／按下／键盘焦点／禁用，零边框零背景，点击区贴合文字 |

## 已实施

两页删除“你的第一张牌”；建档页移除常驻“1—20 个字，仅保存在这台电脑。”。昵称校验仍由原本机档案接口执行，提示缩为“昵称须为 1—20 个字，不能包含控制字符。”，就近放在输入框下方，无提示底色／边框。其他读取或保存错误仍可见。

下一页先实现大指引／小字跳过；随后按用户指定的第二种方向改为“从哪开始？”及新手／熟悉／高手三档单选，默认新手。仅新手进入原真实教程，其余直接进入牌厅。复用现有正式招式图标，选中轻抬／亮边，支持方向键；未新增依赖或生成资产。水平不写档案、不改变对手难度。

## 验证

检查记录与真实截图在主仓库忽略目录 `.local-outputs/frontend-round2/`，由 `smoke-entry.cjs` 复测共享输入、文字动作、校验位置、原真实教程、图鉴清空、设置昵称、三尺寸预览及返回／档案保持。前三次运行分别停在测试未使用真实键盘触发 focus-visible、返回按钮可访问名称含装饰箭头、新增设置检查留下昵称分类影响旧声音检查；保留失败记录，修正测试操作／定位，不放宽行为断言。

使用 VEW；Kimi 未调用。

最终结果：`npm --prefix game/desktop run build` exit0；`smoke-entry.cjs` 63 项通过，renderer error 0；`node --test test.cjs test-navigation.cjs` 15 项通过；五尺寸欢迎表单检查通过（1000×400 仅保留所需纵向滚动）。原生体验窗口已热更新，档案与退出保护不变。

## 水平选择与只读调查补充

当前水平选择版：`smoke-entry.cjs` 65 项通过、renderer error0；普通main五尺寸通过，高手直接入厅保持FixturePort（不启动教程）；原生单选方向键／新手真实教程／熟悉返厅／预览不写档案均通过。`npm --prefix game/desktop run build`通过，Node15项通过，`python scripts/check.py`检查67个Python文件、59项测试通过（保留原Issue #1的1项预期失败）。

首轮单选点击被视觉span拦截，已把原生radio覆盖完整选项范围，键盘焦点仍映射到可见牌面。其余失败为测试状态／时序：共享输入采样未等待焦点过渡结束、同名入厅动作需定位准备卡、固定400ms取样撞上CSS入场延迟；现按样式过渡完成和仍在dock阶段的实际可见状态检查，未放宽行为断言。所有失败及最终证据保留在`.local-outputs/frontend-round2/levels*`。

图鉴与二级导航调查详见`NAVIGATION-AUDIT.md`。发现图鉴退场被入场both填充覆盖，但本次未修改；滚动条与镜头亦仅报告。活动路径保留，未归档／未提交／未推送。Kimi未调用。

## 全站滚动条与阶段提交

随后用户指定先完成滚动条并提交、推送本地最新前端，视频设置另行推进，进出动画先不动。

统一皮肤集中在 `styles/controls.css`：透明轨道、直角 6px 冰青滑块／12px 原生拖动区域；清理图鉴两模式、详情、横向场景条、规则弹窗、旧手册及局势区域的分散皮肤。`renderer.tsx` 一个捕获 scroll 监听显示正在滚动的容器，停止800ms后清理；悬停、键盘焦点和拖动同样显示。无溢出时原生容器不产生滚动条，显隐不挤动内容，保留原生滚动、拖动和键盘操作。无新增依赖。

可运行检查：`DEIDEI_PYTHON=/path/to/python3 node game/desktop/smoke-scrollbars.cjs`。普通 main、隔离临时档案，在1366×768／1920×1080实际验证图鉴两模式、详情与横向滚动、规则弹窗、无溢出、自动隐藏、键盘与原生滑块拖动、减少动态和局势两栏，共55项通过，renderer error0。最终截图／JSON保留在主仓库忽略目录 `.local-outputs/frontend-round2/scrollbars-5/`，不上传临时档案或日志。首次选择器未在实际Electron呈现悬停颜色，改为容器CSS变量后复测通过；测试前置状态及定位修正后保留旧失败记录。

阶段差异只含此前已授权的欢迎／共享输入修改、上述滚动条与相关说明／检查。未恢复图鉴景深／边缘虚化，未修改页面进出动画、视频选项、规则、模型、联网或档案格式；这些保留为后续任务。使用VEW，Kimi未调用。

阶段提交前复验：`npm --prefix game/desktop test` 包含类型检查／构建与86项Node检查，全部通过；`smoke-entry.cjs` 65项通过，renderer error0（`.local-outputs/frontend-round2/stage-entry/`）；`python scripts/check.py` 语法67文件、59项测试完成，仅既有Issue #1预期失败1项；`git diff --check`通过。没有执行跨设备、Windows、新发行包或完整性能验收。

## 图鉴全效果恢复

2026-10-04，继续 `.worktrees/video-settings`／`codex/video-settings-20261004`，起点`4c8b4656d26fecbe5964a2ac18b51a723f456b14`。Teddy指定图鉴恢复以前全效果，作为最高等级动效。对照`1b2b7a1`父版本恢复背景3px失焦、人物阴影、950ms共享舞台镜头、四项环境循环、逐层brightness／saturate／blur、双向渐隐与22px档案玻璃；mask放在原sticky内容层，保留统一原生滚动条。既有选中／悬停扫光、内容入场与示例播放继续保留。较低动态继续暂停该页背景循环／镜头插值，简化装饰取消逐层滤镜／mask，玻璃为6px／关闭；复用原三项配置，不新增存档字段。

退场入场填充改为backwards，并在离开时取消入场动画。实际高档渲染繁忙时，旧380ms计时还会在淡出开始前卸载；`ManualArchive.tsx`改为监听自身opacity的transitionend再卸载，1200ms兜底、减少动态立即返回。背景先向与主页相同的目标回退，卸载前景后继续原镜头；不改其他页面进退。

`npm --prefix game/desktop run build`、`node --test game/desktop/test-graphics.cjs game/desktop/test-navigation.cjs`（11项）及diff／脚本语法检查通过。新增可运行`smoke-archive-effects.cjs`：普通main、临时合成档案，最高／均衡／流畅、进退逐帧、原生八次滚轮／拖动／键盘、图标切换／弹窗、1000×650／1366×768／1920×1080内容区调整与系统两偏好，41项通过、renderer error0。截图和JSON在主仓库忽略目录`.local-outputs/frontend-round2/archive-effects-6/`；旧失败保留，修正采样起点／滚动等待后重测，未删行为断言。未触碰用户正式档案，无新依赖。

本轮最高档1920／DPR2短滚动采样确有长帧：列表rAF间隔p95约266ms、最大317ms，详情p95约200ms、最大317ms；document焦点为true。存在另一个热更新窗口，未做单进程安静环境、三档同输入完整性能对照；rAF不是实际呈现FPS，不归因GPU，也不宣称最高档性能验收。按用户要求保留全效果，低档可减负；后续性能优化不能再次直接取消最高档视觉规范。本次改动保留在本地，未提交／推送；Kimi未调用。


## 图鉴高窗口堆叠适配

2026-10-04，继续video-settings工作区本地迭代。普通main复现：1366×768→1366×1330，列表实际高度454→1016px，但旧740px裁剪仅显示五张、最下方约566px，留下约450px空白。`ManualArchive.tsx`保留ResizeObserver与148px逻辑滚动步长，将显示范围跟随实际高度、曲线拐点移至底部；矮窗口保留原曲线，高窗口先保留阅读间距、底部再叠压。景深、渐隐、共享滚动条与其他页面进退不改；没有依赖／存档变化。列表末尾、单个搜索结果仍按实际内容自然留白，不拉伸卡面或补假卡。

专项扩展既有`smoke-archive-effects.cjs`，检查1000×650、1366×768→900→1100→1330及反向缩回、1920×1080、E28处第六张末牌、单条／空搜索。两次失败记录显示混合键盘／原生滚轮步骤后的浏览位置发生变化，当前详情仍为bi；本次高度验收检查每次拉伸后的堆叠覆盖范围和当前档案选择，末牌步骤另外等待实际平滑定位到达。未把这些记录当作滚动位置保持的验收证据。一次截图因前台转到开发窗口而超时，重测前显式聚焦自建测试窗。原始失败证据均保留，不修改产品以掩盖采样问题。

最终`npm --prefix game/desktop run build`（类型／构建）、Node定向11项、图鉴专项60项及diff／脚本语法检查通过，renderer error0。成功JSON与截图在主仓库`.local-outputs/frontend-round2/archive-height-4/`，之前失败证据保留；未重跑Python／完整Node套件、发行包或性能基准。本地预览已重新载入并打开图鉴；工作区继续保留，未归档／提交／推送，Kimi未调用。


## 图鉴卡牌间距收紧｜2026-10-05

上一轮高窗口上段直接用148px逻辑滚动步距排版，超过卡面88–128px高度，产生20–60px空隙。本次`ManualArchive.tsx`将正向显示位置缩到80px步距、底部继续曲线压叠，可见范围增至容器高度三倍；148px逻辑滚动步距与选择定位保留。最高档原效果与统一滚动条保留；DESIGN补充任意高度下相邻卡面保持叠盖的要求。

类型检查、热更新构建、脚本语法与diff检查通过，普通main专项78项通过，renderer error0。九次内容尺寸检查的实际卡面最大正间隙均为0px；1366×1330模拟高窗口可见21张（含底部逐渐压叠／渐隐的后牌）。当前屏幕会限制原生窗口，脚本记录每次请求／实际原生尺寸，超屏尺寸用既有CDP模拟且显式记录，未宣称这些尺寸为物理窗口验收。截图／JSON在主仓库`.local-outputs/frontend-round2/archive-tight-2/`，初次原生尺寸受限的失败证据在`archive-tight/`保留。未重跑完整套件／性能基准；开发监听已重开并在原生窗口打开图鉴。工作区、HEAD与既有未提交内容保留，未提交／推送／归档；Kimi未调用。


## 共享控件反馈修正与只读调查｜2026-10-05

继续 video-settings 工作区本地迭代。最新用户反馈要求恢复轻薄规则入口、沿轨道移动的光晕、透明选择框与实心方形选中标记；下拉补图标与材质细节。改动 SharedUI、controls.css、GraphicsSettingsPanel、OnlineRoom 和 renderer；好友文本输入统一，三个联机时间入口共用服务能力驱动的时长控件。规则仅入口壳，选择页留待下一轮。不修改返回按钮、菜单自动焦点和设置滚动布局。调查细节及验证边界见 CONTROLS-AUDIT.md。

最终类型／构建通过，定向 Node 20 项通过，实际 Electron 控件专项 30 项通过，renderer error 0；原生 1000×650、1366×650／768 与往返调整记录，九张截图及正常退出证据在主仓库忽略目录 .local-outputs/frontend-round2/ui-controls-revision-1/。Impeccable fresh finish review disposition: ship，限本轮控件；历史设置外层溢出只调查。MOCK 联机不代表真实跨设备验收。开发热更新窗口已打开新控件；工作区保留未归档，未提交／推送，Kimi 未调用。


## 返回、首次焦点与设置滚动落实｜2026-10-05

用户后续明确授权三项修改。返回按钮统一复用 `.ui-back`：当前图鉴的冰青箭头、半透明玻璃底、细边框与悬停扫光；宽度沿用各页面布局。覆盖单人、好友、图鉴及关联返回、设置、欢迎预览、教程完成和结算；画面档位与系统减少透明／动态偏好继续生效。移除欢迎进入主菜单后主动 focus 首个单人按钮的 effect；Tab 键盘焦点仍保留。

设置页以 100dvh 分配高度，标题、左侧分类与保存区固定，只让原 fieldset 原生独立滚动。复用 controls.css 全站滚动条及既有自动显隐；滚动位置／ResizeObserver 更新上下24px渐隐，右侧12px轨道单独保留不透明以便拖动；分类切换复位。无新依赖，保存与 disabled 逻辑沿用。

`npm --prefix game/desktop run build`、`node --test game/desktop/test-navigation.cjs`（5项）与 diff／脚本语法检查通过。可复跑 `DEIDEI_SMOKE_OUTPUT=/path/to/output node game/desktop/smoke-settings-scroll.cjs`：实际 Electron 29项通过；原控件专项 smoke-ui-controls.cjs 更新首次焦点断言后31项通过，均 renderer error 0、正常退出／清理自建临时档案。1366×650／768／900 与1000×650实际原生尺寸往返检查无整页溢出；验证滚轮／End／滑块拖动、边缘方向、自动显隐、顶层下拉、保存回读、7处返回样式一致及真实六步教程完成。好友链路为 MOCK，不代表真人跨设备联机。

证据保留主仓库忽略目录 `.local-outputs/frontend-round2/settings-scroll-3/` 与 `ui-controls-return-scroll/`。额外 mask 检查首次失败是 Chromium 两层 maskComposite 返回 `add, add`；改检查为逐层断言后通过，未修改产品掩盖失败，旧证据保留。未重跑完整 Python／Node／发行包／性能基准；工作区保留未归档／提交／推送，Kimi 未调用。


## 文字输入焦点统一｜2026-10-05

全站六处文字输入已复用 TextInput，但 stage.css 两条旧设置／联机输入规则在 focus-visible 时覆盖共享样式，额外绘制2px冰青 outline、阴影和独立镜片；图鉴不命中这些规则。实际 Electron 修前在设置昵称聚焦时复现。删除这两条旧规则，去掉共享容器额外2px外圈；保留图鉴薄边提亮、底边高光及内光，DESIGN表单规范同步。无需新组件／依赖；文字、密码、搜索功能与校验保持。

类型／构建、diff／脚本语法检查通过。新增可复跑 `DEIDEI_SMOKE_OUTPUT=/path/to/output node game/desktop/smoke-input-focus.cjs`，临时自建档案／既有MOCK联机。修前设置焦点断言失败，证据保留 input-focus-before；修后72项通过、renderer error0、正常退出清理，证据主仓库忽略 .local-outputs/frontend-round2/input-focus-after/。覆盖欢迎／设置昵称、搜索、创建密码、加入房间号／密码的默认／悬停／鼠标及键盘焦点，各状态表面与图鉴逐项相等；保留清空、长度限制、密码遮挡与减少动态／透明偏好。未重跑完整Node／Python／发行包／跨设备测试；热更新供本地继续体验，工作区保留未提交／推送／归档，Kimi未调用。


## 返回按钮尺寸与玻璃反馈修正｜2026-10-05

用户澄清“宽度无需统一”指不同字数可以不同宽，同字数必须同宽。上一轮只比表面属性，留下单人190px最小宽度、图鉴150px与设置网格拉伸；均衡档又取消按钮独立模糊，但设置底层仍有模糊，形成视觉差异。本次10处返回调用统一 SharedUI.BackButton：75px＋每字符15px，固定48px高、共享字形／箭头／间距，页面仅控制位置；清除单人与图鉴旧最小宽度。五字符“返回主菜单”及混排“回到 bi”均150px；“返回联机前厅”165px，长欢迎返回225px。full统一12px／135%，light统一6px／110%，off与系统减少透明为不透明背景、悬停也保持不透明。DESIGN同步规范。

类型＋构建、导航Node5、Electron专项62项通过，renderer error0，正常退出并清理自建档案；实际尺寸与玻璃／字形比对、完整六步教程、欢迎／结算／图鉴／单人／好友前厅／创建／加入／设置返回、矮窗口及设置滚动回归。证据主仓库忽略 .local-outputs/frontend-round2/return-uniform-5/；前四批保留。初次自然宽度被“回到 bi”反例击中后改共享组件；第三批几何严格等号遇48.0000038px浮点，改为CSS高度48px＋原生几何0.01px误差；第四批确认当前Playwright未实现 reducedTransparency参数，最终用既有CDP媒体模拟并明确断言matchMedia生效，补验均衡档的系统偏好。早期仅流畅档底板检查不作为减少透明偏好生效证据。MOCK房间不代表真人跨设备；未做全套Python／Node／发行包／性能验收。本地热更新、工作区保留未提交／推送／归档，Kimi未调用。


## 好友房返回玻璃背景修正｜2026-10-05

实际像素检查确认图鉴与联机前厅均有12px模糊，房间按钮也模糊正常，但房间暗角与导航黑渐变叠加导致透光显著偏低（同一黑白探针关闭模糊时图鉴相邻像素差24.94，房间仅3.96）。删除导航额外暗底，房间暗角在导航区域透明、其下32px渐入；导航高度随既有紧凑断点92／72px变化，保留房间其他区域暗角、共享BackButton与玻璃档位。

`npm --prefix game/desktop run build`通过；新增可复跑`node game/desktop/smoke-return-glass.cjs`，图鉴／前厅及房间1366×650／900实际背景采样7项通过，renderer error0，自建MOCK Electron正常退出。修后房间探针透光差24.67，模糊后0.04；截图／数据在主仓库忽略`.local-outputs/frontend-round2/return-glass-final/`，修前及测试探针层级错误记录保留。未重跑Python／联机服务／发行包；热更新、本地保留未归档／提交／推送，Kimi未调用。


## 联机返回残留实现修正／撤回暗罩改动｜2026-10-06

实际分层调查分别打开 video-settings 与 card-art-redraw：卡牌分支旧 settings-back 在均衡档仍自带12px／135%模糊、三段渐变和内外阴影，图鉴却无模糊；旧 graphics.css 降级过滤遗漏 online。视频分支已使用 ui-back，其均衡6px，与卡牌运行版本不能混报。按用户授权，在卡牌树 controls.css 给既有返回类同步当前共享表面：普通／悬停薄边深底、无额外阴影，全站 full12px／light6px／off无模糊，系统减少透明优先；不改卡牌、布局、档案或网络。video-settings 的 online.css 撤回上一轮导航暗底／暗角 mask 修改，文件恢复与HEAD逐字节一致。

两树均类型／构建通过；`node game/desktop/smoke-return-glass.cjs [目标desktop目录]` 各74项实际Electron检查通过（共148），三档图鉴、前厅、创建／加入、房间650／900高的默认／悬停状态对照，无文字／伪元素／祖先第二模糊，系统减少透明及真实像素探针通过。两树36组表面状态跨树比较完全相同、renderer error0、自建MOCK正常退出。旧探针的“房间背后不能暗”断言对应误改页面暗罩，撤销后改为导航内隔离组件探针并增加状态／层级断言；旧失败证据不删除。

证据主仓库忽略 `.local-outputs/frontend-round2/return-correction-video/`、`return-correction-cards/`；分层原件 back-layer-audit。活动预览仅替换style.css链接，不重载页面／档案，live-preview-refresh.json记录成功。规范补充工作区／档位／组件层级的验收，禁止通过改背景代替统一控件。两工作区保留未归档／提交／推送，Kimi未调用。
