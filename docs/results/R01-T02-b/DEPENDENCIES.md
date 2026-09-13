# 构建依赖审查

2026-09-12 实际 npm registry / npm audit 读取。a 的 exact npm 包版本均可取得，`npm ci` 成功；b 锁文件除根应用名外，所有 packages 条目与固定 a 输入完全一致。没有执行 `audit fix --force`。

审计前／后均 23 项：critical 1、high 19、low 3；`--omit=dev` 为 0。许多是上游受影响链条重复计数，不代表 23 个互不相关根漏洞。下表覆盖全部直接 advisory 根包，其余告警是影响传播。

| 根包与实际版本 | 实际依赖链 | 已知修复 / 本次决定 |
|---|---|---|
| tar 6.2.1 | Forge CLI 7.11.2 → core-utils → @electron/rebuild 3.7.2 → tar；另经 @electron/node-gyp 10.2.0-electron.1 → make-fetch-happen 10.2.1 → cacache 16.1.3 → tar | 当前受影响范围 ≤7.5.20，registry 最新 7.5.22；6.x 最新仍6.2.1。升到7.x跨主版本，不是本包允许的兼容补丁，延期交 ChatGPT 决定。 |
| tmp 0.0.33 | Forge CLI → @inquirer/prompts 6.0.1 → @inquirer/editor 3.0.1 → external-editor 3.1.0 → tmp ^0.0.33 | advisory 修复从0.2.6，registry最新0.2.7；external-editor最新仍3.1.0、依赖仍^0.0.33。0.x次版本也不保证兼容，不能擅自override；延期。 |
| extract-zip 2.0.1 | Forge CLI → core 7.11.2 → @electron/packager 18.4.4 → extract-zip | 当前最新版仍2.0.1，advisory涵盖≤2.0.1；无已发布兼容补丁。保留告警，等待上游修复／规划决定。 |

主要依据：[tar 路径及递归问题](https://github.com/advisories/GHSA-r292-9mhp-454m)、[tar 解压 DoS](https://github.com/advisories/GHSA-23hp-3jrh-7fpw)、[tmp 路径穿越](https://github.com/advisories/GHSA-ph9p-34f9-6g65)、[extract-zip 符号链接路径穿越](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3)。全部 advisory、范围与 npm 建议保留在 audit-before/after.json。

npm 给出的顶层自动修复建议是 Forge CLI 6.4.2（isSemVerMajor=true），这是降级／不兼容工具链变动，未采用。当前 Forge 最新仍7.11.2。以上决定不表示风险已消除：这条构建链只适合继续受控实验，正式分发工具链需再审。运行依赖审计0不等于整体安全通过。

Python 构建锁定3.11.15 / PyInstaller6.22.2；本机使用 uv0.11.13 获取，与a保持一致。CI首次用setup-python取不到该精确版本，保留失败记录；随后改用相同uv及相同Python版本，未换Python版本冒充原环境。CI常规runner／action均无签名密钥、无发布步骤。
