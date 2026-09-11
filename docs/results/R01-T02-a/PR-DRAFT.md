# [R01-T02-a] 技术框架实机验证｜部分完成待条件

目标：`docs/design-discussion-20260911`。本文件只是草稿，未创建远程 PR。

## 这次想解决什么

验证冻结架构的 Electron + React/TypeScript + Python 子进程能否在桌面分发包运行，并提供实际证据供后续选型验收。

## 改了什么，哪些没有涉及

仅增加独立实验与结果目录：固定协议、四双人案例、带种子 Easy、测试档案、PyInstaller/Forge 打包与检查。没有改变原玩法、旧 GUI、模型、根依赖、原 CI 或计划文档。

## 怎样验证

- `python3 scripts/check.py`：32 tests，1 个既有 expectedFailure，退出 0。
- 源码／包内 worker 协议检查、Node 负例、TS 检查、Mac package 通过。
- M2 macOS 真实窗口 10 次自动启停、中文空格路径 CUA 操作、档案／素材／固定案例／错误提示和子进程回收有记录。
- 既有 MaskablePPO 在 CPU 上直接预测四个固定状态通过，无 fallback；不表示完整专家策略或强度验收。
- 详见 REPORT、manifest、RUNBOOK 和真实截图。

## 对现有内容的影响

- 游戏规则 / 招式编号 / 状态编码：无。
- 已有模型：只读复用；隔离安装开发检查依赖。
- 新依赖：仅实验局部 exact npm / Python 清单，无根依赖改动。
- 文档：仅本包结果，未修改 PRD／架构／计划。

## 已知问题

PARTIAL：Windows 实机、真正断网首启、无系统运行时测试、Teddy 人工验收和签名安装体验未完成。构建依赖 npm audit 23 项（含 critical），运行依赖审计 0；不宣称安全验收。Mac 包和源代码 ZIP 仅本地保存，校验值见 manifest，未上传 artifact。

## 提交者确认

- [x] 我检查过本次改动，确认 AI 没有混入无关内容。
- [x] 我如实记录了实际验证结果，没有通过删测试或跳过检查隐藏问题。
- [x] 我没有提交密钥、个人资料或无分享权限的材料。

未调用 Kimi。
