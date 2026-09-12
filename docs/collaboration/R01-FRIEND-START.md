# 叠叠｜同学协作入口

计划 FRIEND-R01 1.0 · 2026-09-12 · 编写：ChatGPT

欢迎参与。叠叠来自高中课间游戏，现在准备做成 Windows/macOS 本地应用。你不需要接管整套项目，也没有固定交期。先领取一项；有空多做，暂时停下就留下实际进展。主线不会等待你的 PR。

## 这次只有一个主任务、一个选做任务

| 工作包 | 做什么 | 当前状态 |
| --- | --- | --- |
| [R01-T04-a](../tasks/R01/R01-T04-a.md) | Windows 运行包实机复测，保留成功与失败证据 | ISSUED，优先领取 |
| [R01-T05-a](../tasks/R01/R01-T05-a.md) | 独立 PNG 美术素材预检工具，后期制作素材时使用 | OPTIONAL_ISSUED，自愿选择；未选择前不运行 |

任务04使用已经生成的技术实验包，它只调用旧规则和简单 AI，不能把它当成新版成品。任务05不接入游戏，也不等待正式美术；用自己生成的小样本测试就能完成。两项都不属于第二轮继续开发的前置条件。

## 给你的 AI

你是执行者。ChatGPT 已写本次 [PRD](../prd/R01-friend-prd.md)、[程序与验证设计](../architecture/R01-friend-design.md)和工作包。请先读这些，再做所领取的一项。不要从讨论文件直接开发游戏，不替 ChatGPT 修改规则、PRD、整体技术安排或任务内容。

DeepSeek、Codex 或其他模型都遵守相同要求：按实际可用工具工作，记录真正运行的命令和输出。没有桌面操作能力时，由同学实际点击并报告；不能根据截图猜“按钮已验证”。没有多 agent 能力也能顺序完成。有多 agent 时可分环境检查与结果检查，但只允许一个执行者操作同一个窗口和写同一组文件。

人来处理 GitHub 登录授权、软件安装确认、断网/恢复网络、系统安全提示和画面体验判断。AI 不擅自改防火墙、关闭防护、导出令牌或破坏私人数据。禁止把全屏私人聊天、设备序列号、账户邮箱和令牌上传公开仓库。

## Git 起点：规划和受测程序分别固定

- 任务文件快照：`plan/r01-friend-v1`。开始时读取实际完整 SHA，记录为 `plan_sha`；这是只读快照，不往里面推送。
- 任务04的受测运行代码：`135b938fcfe0486895adfeea37fab73ee5f881dd`。包、源码复测和记录都写明这个 SHA，不追随“最新代码”。
- 任务05从规划快照建立自己的分支，仅写指定工具与结果目录。
- 每个结果 PR 的目标：`Kalopsiazza/DeiDei:docs/design-discussion-20260911`，不直接提交 main，不自行合入。

## 从自己的 fork 提交

先确认当前目录没有未提交工作；下面命令仅用于新建协作目录。仓库当前是公开仓库，自己 fork 即可，不需要 Teddy 的账号或写权限。首次登录由同学本人完成。已有 fork 时复用它，不重复创建。

PowerShell 示例，先把 `YOUR_GITHUB_LOGIN` 换成自己的 GitHub 用户名；AI 可通过已授权的 GitHub 工具查询本人登录名，不要求提供密钥。

```powershell
$Login = 'YOUR_GITHUB_LOGIN'
$Task = 'R01-T04-a'                  # 选做工具时改为 R01-T05-a
$Branch = 'work/r01-t04-a-windows'   # 选做工具时改为 work/r01-t05-a-assets
# 尚无 fork 时执行，已有则省去本行。
gh repo fork Kalopsiazza/DeiDei --clone=false
# 只在新目录 clone，不覆盖原来的工作目录。
git clone "https://github.com/$Login/DeiDei.git" DeiDei-friend
Set-Location DeiDei-friend
git remote add upstream https://github.com/Kalopsiazza/DeiDei.git
git fetch upstream plan/r01-friend-v1
git switch -c $Branch FETCH_HEAD
git rev-parse HEAD
```

任何命令失败先停止检查，不能在错误目录继续。不自动 rebase、不 force push、不删除原工作。第二项另建分支与工作目录，不把两个任务的改动混在同一 PR。

提交前检查 `git diff --name-only`、`git diff --cached --name-only` 与工作包允许路径。不要用 `git add .` 把运行包、临时档案或私人日志一并提交。任务04通常只提交其结果目录；任务05还提交自己的工具目录。

```powershell
# 按实际领取的包逐项暂存：
git add docs/results/R01-T04-a
# 任务05则使用：git add tools/asset-preflight docs/results/R01-T05-a
git diff --cached --check
git diff --cached --stat
git commit -m "[$Task] 提交协作结果与验证记录"
git push -u origin $Branch
gh pr create --repo Kalopsiazza/DeiDei --base docs/design-discussion-20260911 --head "${Login}:$Branch" --title "[$Task] Windows独立复测｜提交验收" --body-file "docs/results/$Task/PR-BODY.md"
```

任务05标题换为 `[R01-T05-a] 美术素材预检工具｜提交验收`。PR 创建后读取其链接、base/head 和提交 SHA，确认目标正确。没有 gh 时可用 GitHub 网页 Compare across forks，或者已授权的 GitHub 工具，仍明确自己的 fork 分支与上述目标。

GitHub 需要同步上游时，把具体提示交回 Teddy/ChatGPT，不覆盖别人的文件。没有权限、网络失败或暂时做不完，可以提交 PARTIAL 报告；只有实际创建成功才报告 PR 已提交。

## 结果最少包含什么

`docs/results/<工作包ID>/REPORT.md`、`TEST-MATRIX.md`、`manifest.json`、`PR-BODY.md` 和少量脱敏证据。报告写实际完成、没有完成、机器 OS/CPU 类别、执行工具、命令/退出码、最小复现与文件清单。manifest 写 plan_sha、tested_code_sha、包或样本 SHA-256、证据相对路径与 hash。

每一项标 PASS / FAIL / NOT_RUN / BLOCKED；整体标 SUBMITTED 或 PARTIAL。发现问题可以停在报告，不强迫修游戏。不要用“全部正常”代替逐项记录；不要把 CI、自动操作、同学手动操作互相替代。最终验收由 ChatGPT 读取实际文件和代码完成，Teddy 决定接纳和合入。

没有硬性 ddl。不做重复规则审稿，不承担主规则引擎、联机房间或正式动画系统。以后有意继续参加，再单独商量下一项。

参考：GitHub CLI 的 [运行产物下载](https://cli.github.com/manual/gh_run_download)与[跨分支 PR 创建](https://cli.github.com/manual/gh_pr_create)，2026-09-12 核对。
