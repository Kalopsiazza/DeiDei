# R04-T01-b 迭代记录

## 2026-09-29

- 工作区：`.worktrees/r04-t01-b`，分支 `work/r04-t01-b-frontend-live`。
- 增加 `npm --prefix game/desktop run dev`：沿用现有 esbuild，前端源码保存后重新构建并刷新 Electron；退出窗口后结束监听。
- 使用 Python 3.13.7 启动真实 Electron，保存 `style.css` 后窗口重新加载；结束开发命令后未发现残留监听或 Electron 进程。
- `main.cjs`、preload、worker、规则与网络代码的修改仍需重新启动应用，不在开发刷新范围内。
- 已通过 `npm run typecheck`、`npm run build`、`node --check dev.cjs`、`node --check main.cjs` 与 `git diff --check`。
- 已建立 `game/desktop/DESIGN.md`：采用 C，菜单 / 结算页使用原创人物，牌桌使用抽象卡牌语言；主菜单采用红黑战术海报、卡片切片入口与少量烟熏信息层。
- 用户附图只作为色彩、硬边构图和氛围参考；不复制角色或原图构图。Minecraft 只作为毛玻璃层级与可读性参考，未把无法从官方材料确认的具体界面细节写成事实。
- 已生成并接入三层原创位图：环境 WebP、透明人物 PNG、透明氛围 PNG；菜单不再使用临时人物 SVG。资源经 `app://desktop` 精确白名单加载，构建与打包清单固定列出三张图片。
- 背景动态仅用 CSS 完成慢速景深、光晕和粒子漂移；`prefers-reduced-motion` 下全部停用。主入口改为带斜切轮廓、编号和状态层级的卡片式按钮，保留原生 `button`、禁用态和键盘焦点。
- 已在真实 Electron 的 1000×650、1366×768、1920×1080 内容区检查主菜单；五个入口均完整可见。当前 1366×768 热更新会话保留运行，供 Teddy 直接查看。
- 本轮通过 `npm run typecheck`、`npm run build`、`node --test test-navigation.cjs test-packaging.cjs`（9/9）、完整 `npm test`（55/55）与 `git diff --check`。
- 后续视觉微调移除右侧整块斜切蒙版与菜单总底板，只保留各按钮自身的切角；入口按钮间距增加，并用额外留白明确分开两个对局入口与三个功能入口。
- 第三轮视觉细化移除主菜单通用顶栏和左下档案卡，将标题改为 `DeiDei`、副标题改为 `攒一拍，再出招。`，并把开发预览入口移至导航底栏；其他页面顶栏和原有跳转不变。
- 右侧导航加入终端式中英文微标、冰青刻度、细网格和按钮右侧斜纹；悬停高光改为文字下方的局部扫光，避免整颗按钮提亮导致文字失焦。角色增加轻微上移、缩放与轮廓光悬停反馈。
- 已在真实 Electron 热更新窗口复核主菜单、人物悬停、键盘焦点及开发预览弹窗的打开 / 返回；完整 `npm test` 再次通过（55/55），`python3 scripts/check.py` 通过（59 项、1 项已知预期失败），`git diff --check` 通过。
