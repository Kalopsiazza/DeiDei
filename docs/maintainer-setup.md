# 维护者的一次性 GitHub 配置

## 当前交付状态

协作文件、PR 模板、Issue 表单与 CI 放在仓库内。**本次准备无法通过当前连接修改 GitHub 管理设置，分支保护尚未由本次操作启用。** 不应把建议设置当作已经生效。首次执行后请在独立 PR 更新本段，并附实际回读结果。

普通同学只需 fork 和提 PR，无需执行本页命令。未启用保护期间，继续由 Teddy 手动检查 CI 并合入，不给临时贡献者主仓库写入权。本次没有增删任何现有协作者权限。

## 已准备好的配置

在有 GitHub CLI、Python 3.11、网络和仓库管理权限的环境中，拉取最新 `main` 后执行：

```sh
gh auth status
python3 scripts/configure_github.py
python3 scripts/configure_github.py --apply
```

首个 Python 命令只读取和预览；`--apply` 才修改设置。脚本仅针对 `Kalopsiazza/DeiDei`，不会发布版本、添加协作者、修改许可证或写入游戏代码。不要把令牌粘贴进聊天或仓库，使用环境中已有的 GitHub 登录。

目标设置：只允许 squash 合入；关闭自动合入，合入后删除功能分支；`main` 通过 PR 更新，要求 `core-tests` 成功且分支跟上最新主干，禁止强制更新和删除主干，启用线性历史并要求处理审核对话。这些规则也作用于管理员。

当前只有一名维护者，批准人数设为 0，不要求 Code Owner 或其他人批准最后一次推送。仍由 Teddy 手动检查并合入，避免自己的 PR 需要等待另一位不存在的维护者。以后增加固定维护者时再调整。

脚本会先确认当前 main 的实际 GitHub Actions 检查成功，再绑定其 App ID；遇到已有分支保护或有效 ruleset 会停止，避免替换已有管理规则。若某一步失败，它会报告已执行到哪里，不自动撤销可能有效的保护。再次操作前先回读当前设置。

## 可直接交给 Work 的任务

> 请在已登录 GitHub 且具有管理权限的环境里，读取 Kalopsiazza/DeiDei 最新 main 的 AGENTS.md 和 docs/maintainer-setup.md。协作文件已经提交，不要重做或改动游戏。检查当前权限、已有保护规则与 main 的 core-tests 结果；执行 python3 scripts/configure_github.py 预览，再执行 --apply。遇到已有规则时保留原设置并逐项核查，不覆盖更严格的要求。完成后回读验证，在单独文档 PR 中记录结果并按仓库流程合入。不要索取或公开令牌，不添加协作者，不改许可证。无法执行的项目请明确列出，不宣称已完成。

## 管理说明来源

- [GitHub 分支保护 REST 文档](https://docs.github.com/en/rest/branches/branch-protection#update-branch-protection)
- [GitHub 仓库设置 REST 文档](https://docs.github.com/en/rest/repos/repos#update-a-repository)
- [GitHub Actions 触发事件](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)

CI 使用只读权限，不持久保存 checkout 凭据，不使用 `pull_request_target` 执行贡献者代码，也不加载部署凭据。首次外部贡献若需要批准工作流，应先检查工作流改动，再批准运行；审核贡献时也检查测试与工作流是否被不当删改。
