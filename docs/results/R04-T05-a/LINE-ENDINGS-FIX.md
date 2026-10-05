# PR #40 换行保全修正

2026-10-05，接续已审阅 head `04d971499f3d638c7c21d67ae9e00134071dfc80`。根 `.gitattributes` 仅为八项旧 AI 材料逐项设置 `-text`，禁止 Git 提交／检出时转换其换行。八项原字节、`PRESERVE.json` 和 checker 的大小／Git blob／SHA-256 严格比较均未修改；没有全仓库整理或全局 Git 配置变更。

## 实际检查

每个临时检出使用独立 Git 仓库、索引和本地配置；通过 `git clone --shared --no-checkout <主仓库> <临时目录>` 只读共享对象，`git sparse-checkout set --cone legacy/rl` 限定检出范围。在首次检出前分别设置 `git config core.autocrlf false`／`true`，再 `git checkout --detach <受测提交>`。受测树为审阅 head 加本次 `.gitattributes`；最终提交仅另含本记录，其八项材料、清单、checker 和属性与受测树一致。临时目录位于主仓库 `.worktrees/r04-main-integration-checks/`，检查后删除；日志留在忽略的 `.local-outputs/R04-T05-a/line-endings-fix/`。

| 检查 | 实际结果 |
| --- | --- |
| 修正前 `core.autocrlf=true` 检出 | `deidei_gym_env.py` 15,836 → 16,183 字节；真实 checker 退出 1，复现误报 |
| 修正后 `core.autocrlf=false` | 八项大小／Git blob／SHA-256 与清单一致，`git check-attr text` 均为 unset |
| 修正后 `core.autocrlf=true` | 同上；`deidei_env.py` 原 CRLF 与其余材料原字节保留 |
| 两种检出的 `python3 legacy/rl/check.py` | 各退出 0；八项保全成功；25 项测试，仅原 #1 的 1 项 expectedFailure |
| 临时副本只改变 `deidei_gym_env.py` 一个字节 | 退出 1，报告 preserved bytes differ；随后恢复临时输入 |
| 临时副本移走 `rl_checkpoints/latest.zip` | 退出 1，报告缺文件；随后恢复临时输入 |
| 整合工作区 `python3 scripts/check.py` | 退出 0：语法 68 文件；根递归 35、core 174、runtime 27、独立样本 192、旧规则 25；原 1 项 expectedFailure；C074/C081 两项 session 仍 NOT_RUN |
| `git diff --check`、`git diff --cached --check` | 均退出 0 |

最终完整 head、新 head CI 的关联提交／实际 checkout／树比较，以及追加备份的回读结果写在 PR 正文。历史 `REPORT.md`、`CHECKS.json`、`SCOPE.json` 和原备份引用保留原版本。GUI、服务器与性能沿用原版本证据，本次未重新执行；没有加载模型或调用 Kimi。原前端目录及其未提交内容保留，整合工作区继续保留未归档；main 合入与管理设置另待最终确认。
