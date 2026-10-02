# R04 前端阶段交接｜2026-10-02

本次交付把 2026-09-29 至 2026-10-02 的本地前端迭代汇入一个阶段草稿 PR，供 ChatGPT Chat 模式 6-Pro 读取完整源码、安排下一轮整合与真实功能接入。它不是正式发布或全面视觉验收，本轮没有展开重构。

## 固定阅读版本

- 仓库：`Kalopsiazza/DeiDei`
- 分支：`work/r04-t01-b-frontend-live`
- PR 基础分支：`integration/r04-ui`，核对时基线为 `7ec4e246f057545bcd5ffdb929ca1d43b50f1c45`。
- 整理前本地 HEAD：`07f64840a7e640822a6745098b23ab467e3506c5`，比远端同名分支多 30 个提交；这些提交完整保留，并补交尚未提交的相关源码、运行素材、内容数据和必要证据。
- **本交付的完整最终 HEAD SHA 固定在草稿 PR 正文和最终交接提示词中**。先取得那个 SHA，再按 `ref=<SHA>` 读取完整文件；本文件不把整理前 HEAD 当成交付 HEAD。
- 变更清单：[CHANGED-FILES.txt](CHANGED-FILES.txt)，相对于上述 PR 基线，包含状态和全部文件名。完整源码树在该 SHA，阅读不能局限于这个变更清单。

GitHub 搜索可能只索引默认分支。默认 main `889162fc90000919004f498b27cffbd5fa4cbe45` 明显早于本次前端，不能用搜索不到文件推断没有实现；不能只读旧 main、PR 摘要或 diff。通过 GitHub 插件按提交 SHA 读取完整文件；若工具不能指定 ref，应明确报告这一限制，不能基于旧源码制定实施任务。

## 已覆盖的阶段成果

| 范围 | 当前实际落地 | 主要源码 |
| --- | --- | --- |
| 主菜单与设置 | 原创分层大厅、人物与氛围；前端热更新；设置分类、表单、本机档案保存与退出确认 | `game/desktop/renderer.tsx`、`style.css`、`dev.cjs`、`profile.cjs` |
| 欢迎与开场 | 本地 1920×1080 / 6.584 秒视频；静音自动播、声音开关、跳过、重播、失败回退、减少动态；翻牌建档、再次启动身份入口、连续进大厅 | `WelcomeEntrance.tsx`、`welcome.css`、`main.cjs`、`ui-assets.cjs`、`assets/menu/` |
| 单人准备与实战 | 准备页训练对手居中；真实 Python 规则牌局与随机合法对手；选牌、提交、揭晓、2—6 席展示、暂停/冻结、局势回顾、胜负结算及返回演出 | `renderer.tsx`、`BattleStage.tsx`、`worker-port.cjs`、`game/runtime/deidei_runtime/solo.py` |
| 图鉴与规则内容 | 33 招式、10 主题/28 条款、21 术语、10 预设问题、36 示例；检索/分类、持续档案、层叠列表、核心生成的场景播放、关联跳转 | `ManualArchive.tsx`、`fixture.ts`、`manual-content/content.json`、`check_content.py` |
| 真实本地教程 | 攒→防→bi 跟随场，再开独立练习场；真实核心结算、错误选择/重试、提示、退出；普通单人保持随机对手 | `TutorialCoach.tsx`、`game/runtime/deidei_runtime/tutorial.py`、`worker.py`、`tests/test_tutorial.py` |
| 好友联机前端 | L01 前厅、创建/加入、六席大厅、2/6 人入场、共享正式擂台、观战/淘汰、结果/下一场、断线及离房状态；与大厅持续背景和镜头交接 | `online/OnlineRoom.tsx`、`online/model.ts`、`online/client.cjs`、`online/decode.cjs`、`BattleStage.tsx`、`style.css` |
| UI 基础 | 已有 `DESIGN.md`、CSS 变量与共享动作/卡面；33 张透明招式图；本地协议精确资源白名单 | `DESIGN.md`、`style.css`、`ui-assets.cjs`、`assets/moves/` |

单人 AI 强度与回合时间在 `renderer.tsx` 是局部界面状态，`startSolo` 目前仅传档案 ID，未将这两项传给 runtime；不能称为已接通的策略/倒计时。设置音量会保存，普通游戏音乐/音效仍未接上；欢迎视频声音开关是单独的原生媒体行为。当前 ProfileStore 只支持一个本机档案，多身份选择没有实现。

## 其他对话的实产物与权威入口

两个同名“查看前端分支最新 PR”对话均已完成并处于 idle，检查期间没有继续修改本阶段源码。已逐项核对产物：欢迎景深与连续交接的修正进入 `welcome.css` / `smoke-entry.cjs`；联机连续镜头进入 `OnlineRoom.tsx` / `renderer.tsx` / `style.css`。最后的按钮与弹窗检查是只读调查，仍有不统一问题，不能写成已修好。

建议阅读顺序：

1. 本交接、`game/desktop/README.md`、`WORK_START_HERE.md`、`docs/production/STATUS.md`。后两者和历史 NOTES 的状态是当时快照，本交接更新本阶段交付事实；#30/#31 仍是单独技术线，不自动包含其修正或验收。
2. `game/desktop/DESIGN.md`、`docs/prd/R04-ONLINE-CONTINUITY-PRD.md`。旧 `R04-ONLINE-UI-PRD.md` 的业务关系保留，独立中庭视觉方案已被连续镜头方案替代。
3. 完整 `renderer.tsx`、`style.css`、`welcome.css`，再看 `BattleStage.tsx`、`OnlineRoom.tsx`、`ManualArchive.tsx`、`WelcomeEntrance.tsx`、`TutorialCoach.tsx`。
4. `main.cjs` → `preload.cjs` → `worker-port.cjs` / `online/client.cjs`，及 `types.ts`、`online/model.ts` / `decode.cjs`、runtime `worker.py` / `solo.py` / `tutorial.py`。沿数据流核对真功能、fixture 和当前 UI 预览边界。
5. `game/core/README.md`、核心公开接口和 `game/server/README.md` / `deidei_server/protocol.py`。界面复用核心，不重新发明结算；服务端判定、多客户端隐私与重连约束继续保留。
6. 验证脚本、下面的证据和 `docs/results/R04-T01-b/NOTES.md`。`ai-feasibility.md` 仅是复盘/规则问答调查，没有配置密钥或实际 AI 接入。

## 本轮补验

环境：macOS / Apple Silicon，本地 Electron 44.3.0。桌面和 core/runtime 使用现有依赖；服务端测试使用忽略目录中的临时 Python 3.12.11 环境，按现有 `game/server/requirements.lock` 的哈希安装 `websockets==17.0.1`，没有新增或变更项目依赖。

| 命令/检查 | 结果与边界 |
| --- | --- |
| `npm --prefix game/desktop test` | PASS，含类型与构建，61/61，无失败、跳过或 todo；含在线解码、隐私和状态适配测试 |
| `python3 scripts/check.py` | PASS，59 项，保留已有 1 项预期失败；不覆盖 GUI、模型推理或真实联网 |
| `PYTHONPATH=game/core:game/runtime python3 -m unittest discover -s game/runtime/tests -v` | PASS，26/26，含真实教程及普通单人合同 |
| `PYTHONPATH=game/core python3 -m unittest discover -s game/core/tests -v` | PASS，174/174 |
| `PYTHONPATH=game/core:game/server <临时环境python> -m unittest discover -s game/server/tests -v` | PASS，67/67；本机回环 socket + 合成时钟/会话，含实际核心和 5 秒揭晓，不是跨设备真人验收 |
| `python3 docs/results/R04-T01-b/manual-content/check_content.py` | PASS，33 牌、36 示例/43 实际结算回合、47 攻防/36 费用状态，7 份源摘要未变 |
| `node game/desktop/smoke-r04-battle.cjs` | PASS，真实 Electron 单人开场/终场、回顾、暂停/冻结、资源、身份及 2/6 人揭晓座位、至少 3 秒本地揭晓 |
| `node game/desktop/smoke-entry.cjs` | 第一次 FAIL：第 98 行 `hall character arrives while card is still docking`；不改代码/断言，单独重跑 PASS 52 项。保留失败，根因未确定，不能宣称动画稳定性问题已解决 |
| `git diff --check` | PASS，提交前复核 |

`DEIDEI_ONLINE_SMOKE_OUTPUT=.local-outputs/stage-20261002/online node game/desktop/tests-online/smoke.cjs` 本轮 PASS 13 组，生成 48 张实际 Electron 截图；仅 scripted fake socket / MOCK，另含普通 main 无服务提示与真实离线 worker 检查。未创建新测试框架，也未删除、减弱或 skip 断言。原检查/GUI证据在重跑前已复制到忽略的本地产物目录，保留原未提交内容。

### 沿用的专项记录

- `manual-ui/checks.json`：298 项，33 牌、进出、键盘、场景/规则/关联、三尺寸、减少动态；本轮重新核对内容与构建，未再次跑这套 298 项 GUI。
- `tutorial/checks.json`、`tutorial/ledger.json`：80 项、9 个真实核心回合，含跟随/独立场、错误选择/纠正/重试和三尺寸；本轮 runtime 教程单测与欢迎进入真实教程复测通过，未重新跑整套 80 项 GUI。
- `prepare-layout/check.cjs` / `layout.json`：同日实测 1000×650、1366×768、原生全屏 2304×1536，居中/边界/无溢出/按钮选择通过；不能据此宣称 4K 物理像素或各 DPI/宽高比已验收。
- `online-continuity/online-smoke.json`：MOCK，scripted fake socket，截图来自真实 Electron，不能改写成真实联网。
- 上传选择性截图供复核；JSON 中的全量历史截图清单不表示全部图片都纳入 Git。其余诊断/失败图保留本地。

### 未运行与阻塞

真实跨设备房间、公网/TLS/异地重连、Windows、macOS/Windows 安装包、模型推理、真实新玩家教程验收未运行；本轮是本地源码阶段交付，缺少对应服务/设备/发行验收范围。GitHub 现有 CI 只自动触发 main 的 PR/push，不会因为本 PR 面向 `integration/r04-ui` 而自动运行；不把缺失 CI 显示当通过。

大窗口帧率/显存/持续动画性能没有完整基准；另一对话的 2304×1400 采样未完成。新窗口媒体播放/重播通过，但旧窗口间歇卡顿的根因未确定；旧主进程未刷新白名单导致的立即回标题问题已有重启验证，二者不能混为已解决。

阶段草稿 PR 可以交付给规划；上述事项阻塞正式安装包/跨设备/性能验收，不阻塞保存这轮完整源码。欢迎 smoke 的一次失败须保留为稳定性排查项。

## 主要问题与技术债，交给 6-Pro 统筹

1. **布局/DPI/媒体没有统一规则。** 固定 px、封顶 clamp、vw/vh、图片/视频 cover 并存，不同层的尺寸与裁切独立计算；换 4K/全屏后构图漂移仍需整体方案。准备页居中是局部修正。规划需明确逻辑内容区、物理像素/DPR、参考构图、缩放/锚点、宽高比和安全区，以及视频最后一帧与 UI 背景共用的边界，再分批迁移。
2. **共享类名不等于统一视觉。** 旧联机 hover 规则仍覆盖新动作，创建主按钮/返回会出现异色；弹窗按页面有不同 skin；通用 hover 可覆盖 primary/危险动作语义，pressed/focus/disabled 不全一致。已有 `DESIGN.md` 和变量不能当作全面落地。先盘点现有规则/组件和实际 computed style，整理最小 tokens、按钮/表单/弹窗状态，避免继续追加覆盖补丁。
3. **组织与耦合。** `renderer.tsx` 约 39 KB 集中页面、状态、导航、异步 IPC、教程、动画与弹窗；`OnlineRoom.tsx` 约 27 KB；`style.css` 约 227 KB 且密集长行、历轮追加层叠。即使物理行数不夸张，也存在单行大段 JSX/CSS 和职责交错。已有 BattleStage/ManualArchive/WelcomeEntrance/TutorialCoach 是可复用边界；拆分应按职责/状态所有权及共享程度，不按行数机械切块。
4. **真功能与 UI 预览边界。** 单人 AI 强度/时间未下传、普通音源未接、AI 问答/复盘未做、单档案限制；MOCK 房间不可当真实服务。先列接口/错误/加载/离线状态与已有后端能力，再规划真实接入；避免先固化一套假数据布局。
5. **打包陈旧。** 静态对照 `game/packaging/build.py` 的 STAGE_FILES，未包含新增 `welcome.css`、欢迎视频/牌背、`battle-table-v1.webp`、`battle-arena-approach-v1.webp`。桌面 `test-packaging.cjs` 通过验证的是资源边界等检查，不是完整发行打包成功。真实打包前需校正清单、输入锁定和对应安装测试。
6. **性能待测。** 背景 blur/filter、多层 transform、持续粒子/灯光、视频生命周期、动画及 runtime 查询的开销需测量后定位；不先全面 memo/cache 或重写。包括冷启动、连续开场/重播、页面往返、2/6 人揭晓、大窗口与减少动态，分别记录帧时间、CPU/GPU/内存及泄漏趋势。
7. **清理与回归依据。** 旧中庭素材仍在历史提交/资源白名单，新主流程使用持久大厅；弃用方案/原型和历史状态说明应区分。清理先确认引用、构建/打包/测试用途；保留规则、网络边界、核心案例与已有署名，不靠删测试或批量格式化掩盖问题。

建议下一轮形成少量有依赖顺序、明确输入/输出/验收和影响文件的任务包：阶段盘点与回归基线 → 最小 UI 规范与布局底座 → 分批组件/状态/CSS 整合 → 后端真实接入及测量驱动的性能处理 → 后续视觉大迭代。顺序可由源码审计调整；本轮只列待规划范围，不实施这些任务。

## 提交范围与保留项

纳入：现有 30 个前端提交、所有本轮产品源码/运行资产（含视频）、图鉴 JSON 与校验器、教程 PRD/核心账目、连续联机 PRD、结果说明、代表性截图、本交接和精确变更清单。已有核心规则、招式编号、DD 编码、模型与直接依赖不改。既有迭代含本地揭晓 3 秒/联机 5 秒的时间行为调整，runtime/server 测试已补验。

未上传：依赖/venv、build/dist、临时测试环境与日志、私人路径登记、用户原始下载视频、未被产品引用的 3D 实验构建/脚本/大批导出及失败诊断图。相关本地原件没有删除或覆盖；素材说明仅保留必要来源记录和视频生成包，已去掉用户绝对主目录路径。

工作区继续保留供后续 Codex 执行，不归档；不自动合并、部署、发 tag/release。使用 VEW，Kimi 未调用。
