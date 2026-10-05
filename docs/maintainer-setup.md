# 维护者的一次性 GitHub 配置

## 当前交付状态

2026-09-08 已使用现有 GitHub CLI 登录完成管理设置，并通过 GitHub API 回读及脚本 `verify()` 验证。执行账号为仓库所有者 `Kalopsiazza`，仓库 API 返回 `permissions.admin=true`。协作文件已通过 [PR #2](https://github.com/Kalopsiazza/DeiDei/pull/2) 合入。

执行前 main 为 `c42c07221f1b813b83feeba3036e4b6cfaab4134`，`protected=false`，包含父级的 ruleset 查询返回 `[]`，没有覆盖已有规则。该提交的 [core-tests](https://github.com/Kalopsiazza/DeiDei/actions/runs/34236600505/job/102095799568) 已完成且为 `success`，来源为 GitHub Actions（App ID `15368`）。

实际回读结果：

| 设置 | 已验证的值 |
| --- | --- |
| 合入方式 | squash 开启；merge commit、rebase 关闭 |
| 自动合入 / 合入后删除功能分支 | 关闭 / 开启 |
| main 更新方式 | 必须通过 PR；批准人数为 0 |
| 必需检查 | `core-tests`，绑定 GitHub Actions App `15368` |
| 分支必须跟上最新 main | `strict=true` |
| 管理员也受规则约束 | `enforce_admins.enabled=true` |
| 线性历史 / 处理审核对话 | 均开启 |
| 强制推送 / 删除 main | 均禁止 |
| 过期批准失效 | 开启 |
| Code Owner / 最后一次推送另人批准 | 均不要求 |

执行记录：

1. `gh auth status`：已有登录可用；未索取或公开令牌。
2. `python3 scripts/configure_github.py`：退出 0，仅预览，无写入。
3. `python3 scripts/configure_github.py --apply`：退出 1。仓库合入设置 PATCH 成功，分支保护 PUT 返回 HTTP 422；错误指向同时包含 `contexts: []` 与 `checks` 的 `required_status_checks`。此时回读 main 仍未保护，ruleset 仍为空。
4. 补救操作没有修改仓库脚本：通过临时 Python 命令复用脚本的 API 和 payload 函数，再次核对 main SHA、无已有保护/有效 ruleset 及最新检查成功，仅从请求中移除空 `contexts`，保留 `strict` 和带 App ID 的 `checks`，重新 PUT 成功。[GitHub API 文档](https://docs.github.com/en/rest/branches/branch-protection#update-branch-protection) 建议使用 `checks` 进行更细粒度控制。
5. 重新 GET 仓库设置及 main 保护，调用 `verify(repo, protection, 15368)` 通过；上表来自实际回读，不是预期配置。main SHA 未因管理设置操作改变。

文档提交前运行 `python3 scripts/check.py`：9 个 Python 文件语法检查通过，32 项测试中 31 项通过、1 项为既有 #1 的预期失败；`git diff --check` 通过。

管理目标均已完成。原脚本的首次配置请求兼容性问题仍未修改；此文档 PR 不夹带脚本修复。当前 main 已有保护，再运行原脚本会在预检停止，应保留规则并回读核查，不应移除保护来重跑。

普通同学仍通过 fork 和 PR 贡献，由 Teddy 检查并合入。本次未增删协作者、修改许可证或游戏/模型/依赖，也未验证 GUI、模型推理和联机（不属于管理设置任务）。本记录通过独立文档 PR 提交，合入由维护者处理。未调用 Kimi。

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
