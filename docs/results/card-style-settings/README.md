# 卡牌风格正式接入｜2026-10-06

用户授权：将已批准的全牌组美术正式接入 UI，设置中可以切回原版，设置页面遵循现有设计规范。

工作区 `.worktrees/card-art-redraw`，分支 `codex/card-art-redraw-20261005`，本轮起点 `e43b0c68d607bc7862711593e0a2c50beda68e0f`。已调查 DESIGN 的视觉、字体、表单、焦点、短窗口与设置规范，以及实际档案／IPC 保存链路。另一前端对话仍在 `.worktrees/video-settings` 修改共享控件；本任务未改该树或重启其窗口。

## 实现与验收目标

- 设置增加“卡牌”，用攻击／防御／技能三张相同招式对照两个可点击 radio 选项。复用牌桌卡框和真实素材；保留键盘箭头、焦点轮廓、保存中禁用与错误反馈。短窗口缩小展示，保存按钮不参与内容滚动。
- `CardArt.tsx` 的一个偏好上下文覆盖本地／联机共用牌桌、资源、历史、结算、图鉴、关联牌和新手入口。原版恢复的是 Git 起点 `91e24616dbef5daf3c575d5aed115c991693ce12` 的 33 枚原图标，逐文件与原字节匹配；原卡框和标题重新可见。
- 新旧美术分开存放。构建与 app:// 白名单只增加 33 个明确旧图标路径；不放开目录访问。不新增运行时依赖、不改规则、模型、网络协议或 Electron 权限。
- 档案 v3 增加 `cardStyle: illustrated | classic`。严格读取 v1／v2 并在内存保留原版，v1 延续高质量迁移，v2 保留全部画面值；不改写原文件。首次显式保存采用既有原子 rename，身份、头像和其他设置保留。新建／确认恢复默认均衡＋绘画牌面。v3 需要本版本读取，不保证旧 v2 二进制能读取新格式。
- 风格不影响高质量／均衡／流畅的组合识别。关闭放弃恢复保存值，失败留在设置页并保留草稿，允许重试；系统减少动态与透明度继续优先。

## 实际检查

从 `game/desktop` 运行，证据位于主仓库忽略目录 `.local-outputs/card-style-settings/`：

```sh
npm run build
node --test test.cjs test-graphics.cjs test-live.cjs test-navigation.cjs test-packaging.cjs tests-online/test-*.cjs
node smoke-card-style.cjs /Users/zengchongtai/develop/DeiDei/.local-outputs/card-style-settings/runtime-4
node smoke-card-art.cjs /Users/zengchongtai/develop/DeiDei/.local-outputs/card-style-settings/art-regression
```

类型／构建与桌面 94 项检查通过，包括严格 v1／v2／v3 读取、非法枚举／未知字段、稳定身份、保存／重启、写入和 rename 失败保留字节、原子临时文件清理、白名单与实际发行目录 staging。新版牌面真实 Electron 回归 79 项通过：33 招式、强化／休整、图鉴示例、完整结算与真实单人 worker 回合。

风格专项检查使用独立合成 v2 档案，前半为普通 main、实际保存及多次进程重启，后半仅在测试启动器控制 settings.apply 的延迟／失败，然后仍调用真实保存器；不改变产品代码的保存行为。原生内容区 1366×768、1000×650、1366×900 连续调整，记录本机 DPR，无尺寸／DPR模拟。`runtime-1` 保留最初设置对比区偏高与横向滚动证据，`runtime-2` 50 项通过并核验修正后的阅读区；`runtime-3` 增补两种风格的六人好友房 MOCK，58 项通过；最终 `runtime-4` 60 项通过，另核验原版强化名称与新版强化标记。窗口截图来自实际 Electron；MOCK 不代表真实跨设备房间验收。所有测试窗口正常退出，无强制终止或 renderer 错误。早期现有测试夹具缺少新字段导致 INVALID_INPUT，已补齐有效夹具并保留边界断言。

根 Python 全量、900 秒网络长跑、不同设备／DPR和新安装包未运行：本轮改动限于卡牌显示及本机设置，已完成档案兼容／故障与桌面受影响检查。未合并 main、发布或部署。

工作区与忽略证据保留，未归档；阶段提交另登记在主仓库 `开发入口.md`。独立本地预览使用 `preview-profile/` 合成档案，不写用户现有 userData；预览窗口的保存仍调用产品主进程。使用 VEW，Kimi 未调用。
