# 全牌组美术重绘 · 2026-10-05

用户批准细节版 bi-v2 后，重绘全部 33 个招式图标与完整牌面。攻击 18 张红色、防御 9 张蓝色、技能 6 张绿色；纹理、铜金边框和星纹沿用已接受的小样。

工作区：`/Users/zengchongtai/develop/DeiDei/.worktrees/card-art-redraw`，分支 `codex/card-art-redraw-20261005`，起点 `91e24616dbef5daf3c575d5aed115c991693ce12`。起点来自本机 origin/main；本轮远端读取遇到 SSL 错误，未宣称重新核实了最新远端。另一前端对话的 video-settings 工作区与窗口保留。

## 成品与源图

- 本机输出根目录：`/Users/zengchongtai/develop/DeiDei/.local-outputs/card-art-redraw/`。
- `exports/png/`：33 张完整 1080×1440 RGBA PNG；`exports/manifest.json` 保存准确名称、分类、编号、标题换行、字体和三类成品 SHA-256。
- `game/desktop/assets/cards/`：同样 33 张完整 WebP，游戏实际加载；`assets/moves/`：33 枚 512×512 透明 PNG；`assets/card-templates/`：3 张排版用卡框，不进入运行白名单。
- `DeiDei-card-art-33.zip`：全部成品、36 张最终模型源图及提示词映射。ZIP CRC、三组各 33 个文件和逐文件 SHA-256 已核验，结果见输出根目录 `bundle-check.json`。
- 全牌组与缩小检查图：`exports/deck-overview.jpg`、`icons-size-review.png`；原始生成路径、参考和最终提示词保存于 `generation.json`，前版源图保留。BigBi 做过一次扩大主体的针对性重绘。

模型只负责美术，不负责文字。`scripts/export_card_art.py` 从现有 catalog 精确排入名称、分类和 E 编号，检查字体缺字、标题边界、透明外缘、尺寸、清单与哈希。字体使用 macOS supplied Songti SC Bold，不分发字体文件，不改变字体许可。

费用、属性和玩法说明仍由现有界面根据真实状态显示。相同招式家族共享母形；在 28px，炸药／雷电／赠送等版本同时依靠既有文字标签区分。完整牌面保留更丰富的材质，主体先保证轮廓和明暗区清楚。

## 接入范围

`BattleStage.tsx` 与 `ManualArchive.tsx` 改为在选中展示、席位记录、选牌历史、终场、图鉴详情和示例中加载完整牌面；密集手牌、资源与关系按钮继续使用同一套透明图标和可访问文字。原生文字保留在可访问树，重复的固定名称视觉隐藏。强化削根据本人实时资格显示标记；休整覆盖静态标题；未揭晓继续显示既有牌背。

`styles/card-art.css` 覆盖旧牌框和塑料高光，并让终场容器随完整图片增长，防止裁掉名称。它在 graphics、preferences 之前导入，系统偏好继续生效。构建与本地白名单仅加入明确的 33 个 WebP 路径；未知路径与目录穿越仍拒绝。规则、模型、档案格式、网络、权限与依赖版本未改。

## 验证

实际运行：

```sh
npm --prefix game/desktop run build
node --test game/desktop/test-packaging.cjs game/desktop/test.cjs game/desktop/test-navigation.cjs
node game/desktop/smoke-card-art.cjs /Users/zengchongtai/develop/DeiDei/.local-outputs/card-art-redraw/runtime-6
```

完整生成／重排使用已安装的 Pillow；未新增产品依赖：

```sh
/Users/zengchongtai/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/export_card_art.py \
  --art-root /Users/zengchongtai/develop/DeiDei/.local-outputs/card-art-redraw \
  --exports /Users/zengchongtai/develop/DeiDei/.local-outputs/card-art-redraw/exports \
  --font /System/Library/Fonts/Supplemental/Songti.ttc
```

只核验已导出的全部成品：

```sh
/Users/zengchongtai/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/export_card_art.py \
  --check --exports /Users/zengchongtai/develop/DeiDei/.local-outputs/card-art-redraw/exports
```

- 构建／类型检查、Node 25 项、33 张准确文字及 PNG／WebP／图标检查通过。
- Electron 79 项通过，普通 main、新建临时合成档案，全部 66 个图片实际从 app:// 本地协议解码；33 张图鉴逐一选择，三个类别选牌、提交、揭晓、示例、强化与休整、终场和真实单人 worker 回合完成。退出正常，无强制终止或 renderer 错误。
- 原生内容连续调整至 1366×768、1180×720、1000×650，图鉴另测 1366×900；记录本机 DPR，不用虚拟尺寸冒充原生尺寸。終场两尺寸检测完整牌面位于容器内。系统减少动态／透明度作定点模拟检查，未改变保存设置。
- 本轮为纯美术和显示接入，未运行根 Python 全量、联机长测、跨设备／不同 DPR／新安装包验收，也未将固定预览说成真实规则对局。真实单人回合另外标记在截图中。
- 历史证据 `runtime-1` 至 `runtime-5` 保留：早期图片读取竞态已在驱动等待加载后修正；原终场高度裁切已修复；随机对手可在第一拍结束对局，驱动现在核验下一拍历史或真实终场，不修改胜负规则。

最终状态：本地阶段快照保存，工作区与输出保留待用户视觉反馈，未归档、推送、合并、发布或部署。已使用 VEW 与 imagegen；Kimi 未调用。继续修改到上方 card-art-redraw 工作区。
