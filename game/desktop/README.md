# R02-T03-a 桌面可点击原型

所有场景均为演示数据，未接入真实规则或 AI。默认单人入口演示两人流程；六人、观战和两类结果在右上角「开发预览」。三排十一列，数字键 1–0 选中，Enter 提交；灰牌旁的问号可读原因。

## 本地运行

在本目录使用 Node 24.12.0 / npm 11.6.2：

```sh
npm ci
npm start
```

依赖保留交接包的精确起点：Electron 44.3.0、React 19.3.0、TypeScript 7.0.2、esbuild 0.28.2、Forge 7.11.2、Playwright-core 1.63.0。当前锁文件的开发工具依赖审计未通过，详见本包结果目录的 dependency-audit.json；不运行 Forge 打包/发布，不自行变更规划者指定大版本。

```sh
npm test       # 类型检查、构建、9 项状态/保存/键位测试
npm run smoke  # 真实 Electron 窗口、键鼠与两种内容视口，截图写入本包结果目录
```

smoke 仅使用自己创建的临时档案目录和窗口，测试结束恢复权限、删除临时目录。其 `DEIDEI_TEST_DATA_DIR` 由本机启动环境指定，renderer 不接收路径。普通运行在 Electron 的 OS userData 下保存 local-profile/profile.json；本程序限制同一目录的一份应用实例。昵称和内置头像可编辑，音乐/音效音量真实保存但没有音源。对局不续存。

## 数据与安全边界

- `types.ts` 对应 CONTRACT-R02 的 DesktopView/Option 和受限预加载接口；`FixturePort.startSolo/submit/getView/leave` 提供相同视图结构，后续由 WorkerPort 替换。
- `fixture.ts` 中的初始、中局、提交失败与结果都是作者给定的脚本；资格通过静态表指定，没有规则计算、随机策略或旧模型。`catalog.json` 是供本地手册消费的条目和条款文本数据，来源为附件经典规则 1.0.1 与 PLAYER-GUIDE；不是新规则规范。
- 安全设计参考 [Electron 官方安全建议](https://www.electronjs.org/docs/latest/tutorial/security)。`main.cjs` 只开放固定 IPC 和三个只读 app:// 资源，核对 sender/frame、参数字段与大小。renderer 开启沙箱和隔离，不含 Node、文件路径或对手预选。
- `profile.cjs` 由主进程生成身份，校验昵称、头像和设置；同目录临时文件替换，失败保留原档案。损坏文件须明确确认后备份并重建。测试不触及正式档案。

## 来源和范围

代码基线：3a81daf0f42416ccb73a5a69748655145e6f2f0c。依赖清单/锁来自 135b938fcfe0486895adfeea37fab73ee5f881dd 的 experiments/r01-t02-b；仅修改局部项目身份和脚本。主进程资源白名单、安全预加载和原子替换方式参考并重写该固定版本的 main.cjs/profile.cjs/preload.cjs/build.cjs；未复制 bridge、worker 或旧引擎。署名仍归 DeiDei contributors；本任务不新增许可证。

手绘纸色、18/9/6 分类和 6/3/2 列来自 UI-R02 与两张 P07 参考。占位 SVG 为本任务绘制；未复制角色图或系统字体文件。1920×1080 证据为 Electron renderer 的自动开发视口，非该尺寸物理显示器。

本包不包含真实玩法、物理断网验收、Windows 实机、分发包、签名或部署。详见 `../../docs/results/R02-T03-a/REPORT.md`。
