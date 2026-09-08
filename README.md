# DeiDei · 叠叠

把高中课间的拍手游戏，继续做成朋友之间能玩的游戏。

目前是 Python 桌面原型：已有招式与回合计算、Tkinter 界面、简单 AI、近似博弈 AI，以及加载已有模型的强化学习 AI。网页界面和联机尚未实现；没有排期、认领要求或固定分工。

## 想参与？从这里开始

**可以直接 fork、自由尝试，无需事先申请。准备贡献时，再向本仓库 `main` 提交 PR。** 主仓库由 Teddy（[@Kalopsiazza](https://github.com/Kalopsiazza)）维护，提交不代表一定接纳。

先读 [贡献说明](CONTRIBUTING.md)。让 AI 写代码时，直接把下面这段交给它：

> 在我自己的 fork 中开发。先阅读根目录 AGENTS.md、CONTRIBUTING.md、docs/development.md 和本次涉及的规则说明；读取最新上游 main 后新建一个功能分支。我要做的内容是：【填写自己的想法】。一次只处理这项工作，不顺手改变玩法、模型或无关代码。完成后运行 python scripts/check.py；涉及界面时实际打开验证并提供截图；如环境无法验证，明确说明。按照仓库 PR 模板整理结果，向 Kalopsiazza/DeiDei 的 main 发起 PR，或给出可直接创建 PR 的分支和说明。不要自行合入上游 main。

小修复可直接提交；较大的界面、联机或规则提案，推荐先开草稿 PR。没有 Issue 也可以提交。原创改动与已有成果的许可状态见 [来源与署名](CREDITS.md)。

## 运行现有桌面游戏

建议使用 Python 3.11；原始程序标注 Python 3.10+，其他版本需自行验证。先下载或 clone 本仓库，再在项目目录执行。

macOS / Linux：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements_rl.txt
.venv/bin/python -m tkinter
.venv/bin/python gui_deidei.py
```

Windows PowerShell：

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements_rl.txt
.\.venv\Scripts\python.exe -m tkinter
.\.venv\Scripts\python.exe gui_deidei.py
```

`-m tkinter` 应打开一个小窗口，检查后关闭再启动游戏。找不到 Tkinter 时，请安装带 Tcl/Tk 支持的 Python；Linux 通常需额外安装系统的 Tk 包。安装依赖需要网络。依赖文件目前给出版本下限，尚未完成跨系统环境复现。

macOS 的 `DeiDei启动.command` 依赖你已经建立的 `.venv`；仓库不包含任何人的虚拟环境。Windows 还保留原有 `.bat` 启动方式，上述命令更便于查看具体报错。专家 AI 使用 `rl_checkpoints/latest.zip`；请阅读 [模型说明](docs/model-card.md)。

仅检查规则代码时，无需安装机器学习依赖：

```sh
python scripts/check.py
```

macOS 上未设置 `python` 命令时，换成 `python3`。此检查不代表桌面试玩、模型推理或联机已经通过验证。

## 当前方向

欢迎改善可读性、操作反馈、招式说明、测试、回放、界面与朋友联机。先让朋友能方便打开、看懂并完成一局；暂不要求账号、排行榜、付费服务器或整套产品计划。较大的新技术选型请随 PR 写明理由和启动方法。

现有回合规则与 AI 模型要继续可用。改变规则与换界面请分成不同 PR；有关历史玩法的疑问由维护者确认，AI 不自行猜定。

## 项目入口

- [AGENTS.md](AGENTS.md)：给编码 AI 的工作要求。
- [贡献说明](CONTRIBUTING.md) / [开发说明](docs/development.md)：从分支到 PR。
- [规则与样例](docs/game-rules.md) / [已知问题](docs/known-issues.md)：当前实现及待确认事项。
- [模型说明](docs/model-card.md) / [来源与署名](CREDITS.md)：已有成果与许可状态。
- [更新记录](CHANGELOG.md) / [维护者配置](docs/maintainer-setup.md)：正式版本记录和 GitHub 设置。

自动检查由 `.github/workflows/ci.yml` 定义。GitHub 分支保护属于另行配置的管理设置，文档与工作流文件本身不会启用保护；执行情况见维护者配置说明。
