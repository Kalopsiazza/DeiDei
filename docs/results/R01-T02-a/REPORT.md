# R01-T02-a｜技术框架实机验证

执行状态：**PARTIAL**。macOS 本机实验可运行；Windows 实机、物理断网与签名分发未验收。可审查技术实验及 Mac 证据，不能据此批准正式游戏架构或双平台交付。

输入 `plan/r01-v1`：`aeabaf681197eb110da919e310ad1f4833433bba`。PRD-R01 / ARC-R01 均 1.0。
分支 `work/r01-t02-a-tech`；被测代码 `6187c2366f3be282db0d6bad73dd025c27224a87`。
结果目标分支 `docs/design-discussion-20260911`；未 push、未创建 PR、未合入。任务包描述交付目标，不单独作为外部写入授权。

## 实测矩阵

| 验收 | macOS M2 ARM64 | Windows |
|---|---|---|
| TECH-01 真实窗口 | PASS：原生窗口，Playwright 与 CUA 两类观察，见截图 | NOT_RUN，无实机 |
| TECH-02 无开发服务分发包 | PASS：app:// 本地资源，包内 Python，无 Vite 服务 | NOT_RUN |
| TECH-03 物理断网首次启动／无系统运行时 | NOT_RUN：限制 PATH + 包内 worker 已测；系统仍装有运行时、网络仍连接，不算该项通过 | NOT_RUN |
| TECH-04 退出回收 | PASS：10/10 自动启动与关闭，逐次检查 worker PID 消失；另有 CUA 关闭后进程检查 | NOT_RUN |
| TECH-05 中文空格路径 | PASS：`out/中文 空格路径/` 普通包启动，Health／案例／错误／重启／退出 | NOT_RUN |
| TECH-06 双平台记录 | PARTIAL：Mac build、launch 完成；offline、Teddy manual 未测 | build/launch/offline/manual 均 NOT_RUN |
| TECH-07 故障可见 | PARTIAL：非法字段窗口可见；协议错误、缺 worker、200ms 注入超时、异常退出、损坏／无权限档案在组件检查通过；真实 10 秒超时窗口与权限错误窗口未人工测 | NOT_RUN |
| TECH-08 依赖可复现 | PASS_MAC_LOCKED：npm exact+lock、Python freeze，构建成功；尚未另取全新机器重建 | 提供带 hash 依赖清单，未执行 |

Mac：MacBook Air Mac14,2，Apple M2（8 核），16 GB，macOS 27.0 build 26A5425a。未验证其他 macOS 版本／Intel Mac。无 Windows 环境，未尝试用跨编译或 CI 替代实机。

## 完成范围与检查

只新增 `experiments/r01-t02-a/**` 与 `docs/results/R01-T02-a/**`。根依赖、原规则、GUI、rl_ai.py、模型、原 CI／测试、PRD／架构／计划保持不变。没实现正式菜单、联机、多人判定或动画。SVG 是自写固定素材测试图，不是正式美术。

- Python JSONL：四固定案例、id 配对、seed 重复性、未知操作、布尔 seed、表达式字符串、非法 JSON、64 KiB 超限后恢复、EOF 不完整、health、shutdown 通过（源码与打包 worker 两条路径）。
- Node 原生测试 2 项通过，含多个负例；档案损坏时不覆盖原文件、临时写入替换，目录无权限返回失败。仅临时测试数据。
- React/TS 检查与 Forge package 成功。真实窗口十次检查素材、六席位、规则与 AI、档案跨次保持、昵称纯文本、沙箱配置。CSP、固定资源白名单、IPC sender/参数校验与外部窗口／导航拒绝已实现；未做完整渗透测试。
- 原 `python3 scripts/check.py`：32 tests，1 个已知 expectedFailure，整体退出 0；没有改动既有失败标记。
- 初次包发生资源加载错误，已定位并修复；见 initial-failure.json。后续重跑的 desktop-smoke.json 对应最终代码。

## 性能（观察值，不是承诺）

分发 ZIP：136,881,083 bytes；app 实际文件逻辑大小（不重复数 symlink）：320,277,535 bytes（305.4 MiB）。

10 次进程新启动到标题出现：首次 4.00s，中位数 1.16s，范围 1.07—4.00s。
测量包含 Playwright 调试握手；没有清除 OS 文件缓存，也没做重启后的磁盘冷读，不能把它称为严格冷启动基准。

Health 后 Electron 各进程 workingSetSize 加总 439.0—500.8 MiB；worker RSS 24.4—24.9 MiB。加总可能重复计算共享内存，不是整机增量或峰值。测量时机器还运行其他用户应用。

独立包内 worker 的 100 次 Easy JSONL 往返：中位数 0.063ms，范围 0.052—0.898ms；不含 UI 点击时间。脚本单进程顺序 seed=0..99，计时包含 IPC 与序列化，见 worker-performance.json。窗口按钮端到端时间另在 desktop-smoke.json，二者口径不同。

## 旧模型独立检查

真正加载 `sb3_contrib.ppo_mask.ppo_mask.MaskablePPO`，device=cpu，原 latest.zip SHA-256 `9b2dc0d0eaf09c38d0ec448f52b145d2a5455a53b22771ff919867d57689f97c`。直接 model.predict 调用四状态均返回合法招式，**没有把 fallback 作为成功**。加载模块及模型合计 1.98s；单次 predict 0.152—11.502ms；进程峰值 RSS 300.3 MiB。

这只证明本机 CPU 加载和四个原始预测可用，不证明策略强度、完整专家人工修正分布或专家分发包可用。加载过程确实导入 gui_deidei 与 tkinter，反向依赖仍在；未修改原模块。模型大依赖仅在隔离环境，未进入轻量包。没有加载 opponent_pool.pkl。

## 依赖、签名及风险

Electron 44.3.0、Forge 7.11.2、React 19.3.0、TypeScript 7.0.2、esbuild 0.28.2、Playwright Core 1.63.0；Node 24.12.0、npm 11.6.2；Python 3.11.15、PyInstaller 6.22.2。模型依赖完整记录在 requirements-model-macos-arm64.txt。

选择版本时读取 npm registry 与 [Electron stable releases](https://releases.electronjs.org/?channel=stable)，打包配置依据 [Forge 配置](https://www.electronforge.io/config/configuration)。本次没有改选型。

npm audit 全树 23 项（1 critical、19 high、3 low），均在构建／开发依赖树；`--omit=dev` 为 0。这是实测审计快照，不表示整体安全通过。没有盲目 `audit fix --force` 或更换 Forge；后续包需决定构建依赖修复路线，详见两份 audit JSON。

应用只有 Electron 链接器 ad-hoc 签名；无 TeamIdentifier、无 Developer ID 签名、公证和完整分发验收。没有关闭系统安全保护。另机 Gatekeeper/SmartScreen 体验未知。

## 交付和下一步

源码与 Mac ZIP 的 SHA-256／本地位置见 manifest.json。包未上传，未生成 Actions artifact 或 release；本地保留到用户清理，无远程保存期承诺。Windows 构建与免环境测试步骤见 RUNBOOK.md；源码 ZIP 不是 Windows 运行包。

需要 Teddy 提供 Windows 实机及两端人工／物理离线结果；ChatGPT 可审本次源码、失败修复、Mac 证据、性能与依赖告警，再决定是否发 b 包。没有自行改 PRD 或宣称 ACCEPTED。

已做范围与输入校验、自审和实际检查。未调用 Kimi（暂停使用）。
