# 参与 DeiDei

欢迎随手做一些有趣的东西。你可以自由 fork 和尝试，没有先认领、先立项或按时交付的要求。来源与许可说明见 [CREDITS.md](CREDITS.md)。

## 一次贡献怎样完成

1. Fork `Kalopsiazza/DeiDei`，从上游最新 `main` 建立功能分支。
2. 阅读 `AGENTS.md` 和相关说明，完成一项能单独检查的改动。
3. 运行 `python scripts/check.py`，再实际验证本次功能。
4. 向 `Kalopsiazza/DeiDei:main` 发起 PR，使用自动出现的模板。
5. 根据审核意见继续向同一分支提交；合入后，新任务从最新 `main` 另开分支。

可以一直在 GitHub 网页和 AI 编码工具里操作。命令行示例（将 YOUR_ACCOUNT 换成自己的账号）：

```sh
git clone https://github.com/YOUR_ACCOUNT/DeiDei.git
cd DeiDei
git remote add upstream https://github.com/Kalopsiazza/DeiDei.git
git fetch upstream
git switch -c feat/your-idea upstream/main
# 开发、验证，然后只暂存本次需要的文件
git add <本次改动的文件>
git commit -m "feat: 描述这次功能"
git push -u origin feat/your-idea
```

在自己的 GitHub 分支页面选择 Compare & pull request，确认目标是上游 `main`。`feat/`、`fix/`、`docs/`、`chore/` 只是建议；分支名简短可辨即可。一个分支只处理一个 PR，不反复复用已合入分支。

## 什么样的 PR 适合进入主仓库

一次只做一件能说明白的事。小功能不用另写 PRD；PR 里写清目的、范围、验收方式即可。界面展示截图或短视频，规则变化展示具体对局，模型替换展示来源和评测。提交者负责确认 AI 的改动和实际验证结果。

不要把全项目格式调整、模型更换、规则改动和界面翻新放进同一 PR。大型工作可以先开草稿 PR，把最小可运行版本先交出来；无需等全部想法实现。

大方向不要求提前批准，但接纳由维护者决定。重复功能、维护负担较大、无法验证或偏离玩法的改动可能退回或关闭，已有投入不意味着一定合入。退回时尽量说明原因，实验仍可保留在自己的 fork。

有 Issue 时用 `Refs #编号`；确实完成修复才写 `Closes #编号`。没有相关 Issue 就直接说明目的，不为走流程另建 Issue。

## 检查与文档

运行 `python scripts/check.py`。当前只有标准库检查，不需要重训模型。不能运行时写明原因，不能把“AI 判断没问题”写成测试通过。

测试报错应解释和修复；不要删除测试、添加跳过、改成预期失败来隐藏新问题。现有 `expectedFailure` 仅用于 [#1](https://github.com/Kalopsiazza/DeiDei/issues/1)，修复时去掉标记并保留测试。

行为、运行方式或依赖发生变化时，更新相关说明。只修错字或排版无需写设计文档。较大功能在 `docs/` 添加短说明：选择了什么、为何这样做、如何运行、如何验证、暂未包含什么。不要提交私人聊天全文、临时 AI 草稿、密钥、个人路径、虚拟环境或训练缓存。

## 主干与发布

`main` 是正式共享版本。Teddy 保留合入权，其他同学通过 fork 贡献；未经邀请无需获得主仓库写入权限。维护者自己的工作也尽量通过 PR 留痕。

每个 PR 默认采用 Squash and merge，主干保留一条有意义的提交，细节留在 PR。合入前检查最新上游变化、实际 CI 结果和未处理意见；不要由贡献者 AI 自行合入。

`CHANGELOG.md` 由维护者在合入或发布时整理，普通贡献者不用每次编辑，减少同时改同一文件。代码历史保留 PR 编号；正式可分享版本再创建版本标签和发布说明。当前不要求每日记录、工时或里程碑。
