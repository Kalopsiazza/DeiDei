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
