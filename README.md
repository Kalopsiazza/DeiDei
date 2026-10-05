# DeiDei · 叠叠

把高中课间的拍手游戏，继续做成朋友之间能玩的游戏。

当前是 React/Electron 桌面游戏：本机 Python worker 调用独立 classic-1.0.1 的 33 招核心；好友房已有 rooms-1.1 客户端与独立判定服务。单人对手为「临时随机对手」`random-legal-v1`，没有使用旧机器学习模型。

2026-10-06：前端统一起点接入新版牌面／原版切换、画面设置与图鉴后续迭代，所有返回入口使用共享组件。后续从最新 main 继续开发；实际验证见 [整合记录](docs/results/frontend-main-20261006/README.md)。本次不是正式版本发布。

## 从源码运行

需要 Python 3.11+、Node 24.12.0 / npm（沿用现有 lock）。从仓库根目录：

```sh
npm --prefix game/desktop ci
DEIDEI_PYTHON=/absolute/path/to/python3 npm --prefix game/desktop start
# 连续前端试改
DEIDEI_PYTHON=/absolute/path/to/python3 npm --prefix game/desktop run dev
```

worker 只用标准库，不安装机器学习依赖。Windows 命令、操作、热更新边界和沙箱说明见 [桌面 README](game/desktop/README.md)。正式启动未配置地址时提示联机服务未配置；dev 无地址时明确显示 MOCK 脚本化 socket，不代表真实联网。

真实回环服务需独立环境与锁定服务依赖：

```sh
python3 -m venv game/server/.venv
game/server/.venv/bin/python -m pip install --require-hashes -r game/server/requirements.lock
PYTHONPATH=game/core:game/server game/server/.venv/bin/python -m deidei_server --port 8765
# 另一终端
DEIDEI_ROOM_URL=ws://127.0.0.1:8765/rooms-v1 DEIDEI_PYTHON=/absolute/path/to/python3 npm --prefix game/desktop start
```

以上 PYTHONPATH 写法适用于 macOS/Linux；Windows 使用分号，完整服务说明见 [server](game/server/README.md)。公网、证书、跨设备和系统信任需另行验收。

## 检查与贡献

```sh
python3 scripts/check.py
npm --prefix game/desktop test
```

Python 入口保留语法检查，分别在独立进程运行根 tests 递归发现、新 core、新 runtime、独立规则样本及旧 AI 保全。零用例或子检查失败均失败；session 未覆盖项目保持原输出。`core-tests` CI 在同一 job 中执行两条命令，桌面 test 已含类型检查与构建。窗口、网络长测、安装包及模型不在每次 CI 中。

贡献可直接 fork，从最新 main 建独立分支，一次 PR 一项事情；详见 [贡献说明](CONTRIBUTING.md)、[AGENTS](AGENTS.md) 和 [开发说明](docs/development.md)。维护者授权的本次整合按现有 main 保护规则走 PR 与 squash，不变更仓库设置。

## 规则、旧 AI 与当前边界

现版规则权威入口为 [docs/rules/v1](docs/rules/v1/)，规则概览见 [game-rules](docs/game-rules.md)，界面规范见 [DESIGN](game/desktop/DESIGN.md)。旧 AI 原代码、依赖、模型和两份旧测试完整保留于 [legacy/rl](legacy/rl/README.md)，可执行 `python3 legacy/rl/check.py` 独立做字节及旧规则检查。旧 Tkinter 产品与启动脚本已经退出。

旧环境为 31 动作、双人 156 维截断观测，不能直接替代现版 33 招核心。仓库没有完整训练入口、训练记录或可复查评测；本轮没有加载或训练模型，见 [模型说明](docs/model-card.md) 和 [来源署名](CREDITS.md)。

单人难度／时限尚未下传；跨设备、跨 DPI、Windows 和新安装包未验；欢迎历史长帧、完整页面进出及写盘后 setFullScreen 异常仍保留；图鉴景深／退场与高窗口适配已纳入本次前端整合。当前状态见 [WORK_START_HERE](WORK_START_HERE.md)、[已知问题](docs/known-issues.md) 与 [本轮报告](docs/results/frontend-main-20261006/README.md)。
