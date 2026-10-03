# R04 A—F 版本与构建输入对照

状态：**本机候选已交付，待源码验收**。分包报告是执行者检查记录；尚未获得六包源码／证据验收。原始大日志与包保留本机，需要时另行取用。

## 审查版本

- 增量草稿 PR 的 base：`work/r04-t01-b-frontend-live`，核对值 `88185af2c9372b2f1d88707218cafee590b94018`（#33 的 head）。本次不修改 #33、不合入 main。
- 集成分支：`codex/r04-t02-e-real-rooms`。保留现有集成提交历史，不 squash/rebase；原分包 worktree 与分支均保留未归档。
- 原生包与 F 最终取样的产品 SHA：**`0a37a89d3ad5e0d1b7817831d3d94f5811e90346`**。
- 本轮文档整理前的完整 head：`25c0ada0ba5731f6852f213ee6a86070ffc171b9`。
- **含本文件与最后交付文档的最终完整 head，在草稿 PR 正文、GitHub `headRefOid` 和本轮回传中给出。** 文件无法写入包含自身的提交 SHA；提交后再次对该 head 做输入比对，然后推送并回读远端。

## 分包提交怎样进入集成

下表的原分包提交为本地来源，A/B/C/D/F 原提交不是集成祖先，不作为远端源码链接；远端审查应打开“集成中的提交”。A/B/C/D/F 的初始实现成对 `patch-id --stable` 相同，集成提交与其后续修复均可从最终 head 到达。E 候选按文件审查接入，未整棵覆盖旧 UI。各轮检查输入不同，不能把通过项汇总成“最终 head 全部重跑”。

|包／报告|原分包实现完整 SHA|集成中的实现／后续修复|主要检查输入与边界|
|---|---|---|---|
|[A](../R04-T02-a/REPORT.md)|`1523ae5f8119af604008c72db5927d8fce2b39c3`|[95d0b6e9f54aa231497be54666005b7cfa1bb86c](https://github.com/Kalopsiazza/DeiDei/commit/95d0b6e9f54aa231497be54666005b7cfa1bb86c)；配置纳入 `b335be4f11da76dba9c477271196fd71378dd55f`；打包补丁／文案 `0a37a89d3ad5e0d1b7817831d3d94f5811e90346`|初轮 `1523ae5f8119af604008c72db5927d8fce2b39c3`；最终原生包 `0a37a89d3ad5e0d1b7817831d3d94f5811e90346`；成包 GUI guard 实际退出1，未运行|
|[B](../R04-T02-b/README.md)|`852a211cb3801b98fee9c39e5e58db23d29c3e17`|[e0431a8b81d7018036f522c318d0e14ebf11b340](https://github.com/Kalopsiazza/DeiDei/commit/e0431a8b81d7018036f522c318d0e14ebf11b340)；目标 smoke／报告 `d118ef0907c98cf4c2d46f2891069ef328dc685f`|原分支 `852a211cb3801b98fee9c39e5e58db23d29c3e17`；真实集成 GUI `725ec1f1186e63673563a3a7d7e1409f28ea0756`；MOCK 不作真实服务证据|
|[C](../R04-T02-c/README.md)|`9162150348d48413b548afce0006c11d12dcf832`|[aeb166c82c55fc667c47efff1df68d4e3b57ed58](https://github.com/Kalopsiazza/DeiDei/commit/aeb166c82c55fc667c47efff1df68d4e3b57ed58)；失成员退出 `8a65b881e64a15c18a218e59ed3130fa48babe01`|初轮 `852a211cb3801b98fee9c39e5e58db23d29c3e17` 加明确 dirty；本地恢复 `74fbf366fe71e96f2794470f94a8b75526fff7bc`；MOCK／擂台 `8647ac58cea004bded7b6a4a854ffe22c63199c9`；真实 GUI `725ec1f1186e63673563a3a7d7e1409f28ea0756`|
|[D](../R04-T02-d/REPORT.md)|`91c15b3850c10123023bc2afe56d0f9f0972f4e1`|[9c5371001b46350136c15cab1753d9e88c6aa546](https://github.com/Kalopsiazza/DeiDei/commit/9c5371001b46350136c15cab1753d9e88c6aa546)|desktop单元65项／72布局场景固定原分包 `91c15b3850c10123023bc2afe56d0f9f0972f4e1`；动态尺寸与完整页面／状态覆盖未验|
|[E](../R04-T02-e/RESULT.md)|候选 `4df3287e793223f776208f72dbd07c8a32062e33`|[55411aa7f105057c7bee67d313592bb4462e16fa](https://github.com/Kalopsiazza/DeiDei/commit/55411aa7f105057c7bee67d313592bb4462e16fa) 逐项接入；相关 C 修复见上行|真实 Electron 13组 `725ec1f1186e63673563a3a7d7e1409f28ea0756`；TLS 28组 `74fbf366fe71e96f2794470f94a8b75526fff7bc`；Room/core 合成样本 `8e3272199aa2cd15a820d13a78d8a78077782a65`；跨设备未验|
|[F](../R04-T02-f/NOTES.md)|`0f4f15052ad8366422360ad9911b7e8f7573874c`|[a64c457d385837ec27cf0f1ac4ec8adfd15cbd87](https://github.com/Kalopsiazza/DeiDei/commit/a64c457d385837ec27cf0f1ac4ec8adfd15cbd87)；真实 RAF `c7570113e926ee3e6287a9f1a02ab5e4def610b0`；失败留证 `6f0657d585c72ca68ca61556b178ac4717298341`|基线 `88185af2c9372b2f1d88707218cafee590b94018` 加诊断脚本 dirty；最终四轮 clean `0a37a89d3ad5e0d1b7817831d3d94f5811e90346`；诊断交付，长帧未定位，旧两人停顿未复现，不称修复|

### 报告来源

这些历史报告均已纳入同一集成树，本轮仅加交付状态／版本关系说明；后续文档提交不改变相应检查输入。

|包|原分包报告／回补记录（本地）|集成报告记录（最终 head 的祖先）|
|---|---|---|
|A|最终报告 `0a95a96f3142055efd2e89c53c91f9fbe7ec13ae`；E 打包补丁回补 A 为 `07381319a876c2a725ca4eeb72b28ce9430f0b68`|`a64f0c618723a27c9482d0abc0652226705b717a` → `d4809475ea548cea494b2d596e1e7c8b99f28b88`|
|B|`f8d47797678bd24497f2007ad0717c579d7517b8`|`d118ef0907c98cf4c2d46f2891069ef328dc685f`|
|C|`3e26191e50c711c300614cdd04e533a19727dbf5`；E 失成员修复回补 C 为 `d2380199c3b4fb53050453e62c845c2b8da8344d`|`aeb166c82c55fc667c47efff1df68d4e3b57ed58` → `268b508ee9c9ef58eca410ef503b6c11998df1dd`；C 本地最后回补文档未单独 cherry-pick，集成报告已含复验结果|
|D|`2154b1980ffb80b4cb59efab49dcb7578d040f10`|`c15e250e0dc3aa3b2b474d270eeaeac4c2a05992`|
|E|由集成分支完成|TLS `55411aa7f105057c7bee67d313592bb4462e16fa`；RESULT `268b508ee9c9ef58eca410ef503b6c11998df1dd` → `25c0ada0ba5731f6852f213ee6a86070ffc171b9`|
|F|`7f66b0d032aae1f42ecc2d368139d6d48c13a232`|`a64c457d385837ec27cf0f1ac4ec8adfd15cbd87` → `8ce3d4689c2d95681714edd60332db47579bda2f`|

## 实际构建输入比对

[BUILD-INPUTS.json](BUILD-INPUTS.json) 从原生包 `stage/build-info.json` 的 `input_files_sha256` 提取**完整206项路径与 SHA256**，不是仅对 `game/` 做 diff。其 build-info 摘要与 A [delivery-manifest.json](../R04-T02-a/delivery-manifest.json) 相符。逐项对比包记录、产品 SHA 的 Git blob、文档 checkpoint `25c0ada0ba5731f6852f213ee6a86070ffc171b9` 的 Git blob 和工作区字节：新增0、删除0、变化0。本轮提交后另对最终 head 重做同一比对，结果在 PR 正文回传；因此可沿用原产品检查，无需重跑六包。

实际 `build.py` 的仓库输入范围：`game/core`（9）、`game/runtime`（17）、`game/desktop`（127）、`game/packaging`（52），以及 **`docs/results/R04-T01-b/manual-content/content.json`（1）**。共206项、26550143字节。路径名单按排序后每行路径加末尾 LF 的 UTF-8 编码；摘要映射按 key 排序的紧凑 JSON、ensure_ascii=False、UTF-8 编码。

- 路径名单 SHA256：`7ea1473308cd6dc473f710de04cf57349dfdec5f352bdeeff1f21c0a285a96a0`
- 路径→摘要映射 SHA256：`c235f8f06a15974b79fe013278adc767ea6bdccd227c674023a72a8499ce9677`
- 图鉴 JSON SHA256：`61d559c9a06fc285fff2d715233993b4228a63f7f339b0877686de8726de00ca`
- 原 build-info SHA256：`9bbf7053fb82cf3d390f097511d0859120138d7a95e62c947ade1e1cf5f31173`

另外沿 `build.cjs` 的 JS/CSS imports、`stage.cjs` 的56项、40项资产、`worker.spec` 与原 PyInstaller TOC 核对本仓库来源：包括唯一 `docs/` 图鉴导入，未发现漏项。206项是构建脚本的 tracked scope 快照，含范围内的测试／README，不是只有实际编译叶子；也不覆盖全部验证输入或外部环境。`game/server`、`game/integration`、根 `scripts/check.py`、根测试及 `tests/rules_v1_001` 等在范围外，但本轮仅改交付文档，对其没有修改。Node/Python工具、node_modules、PyInstaller hooks/stdlib、Electron下载及系统签名工具是外部输入，版本／lock／官方 checksum 与成包文件清单由 A 原记录分别约束；该比对不证明外部环境完全可复现。生成的 bundle/worker 字节沿用原包清单核验。

从最终分支根复核名单与 Git 字节（不需要生成包）：

```sh
python3 - <<'PY'
import hashlib, json, subprocess
from pathlib import Path
m = json.loads(Path('docs/results/R04-T02/BUILD-INPUTS.json').read_text())
expected = m['recorded_input_files_sha256']
scopes = ['game/core', 'game/runtime', 'game/desktop', 'game/packaging',
          'docs/results/R04-T01-b/manual-content/content.json']
for ref in [m['product_sha'], 'HEAD']:
    paths = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', ref, '--', *scopes]).decode().splitlines()
    assert set(paths) == set(expected), (ref, 'input list changed')
    for path, sha in expected.items():
        data = subprocess.check_output(['git', 'show', f'{ref}:{path}'])
        assert hashlib.sha256(data).hexdigest() == sha, (ref, path)
assert hashlib.sha256(('\n'.join(sorted(expected)) + '\n').encode()).hexdigest() == m['list_sha256']
assert hashlib.sha256(json.dumps(expected, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest() == m['mapping_sha256']
print('PASS: product and HEAD, 206 inputs identical including manual JSON')
PY
```

## 包与未验事项

macOS ZIP **仅在本机，未上传、未向审查者提供可下载地址，审查者尚未取得或核对 SHA256**。文件名 `DeiDei-R04-T02-a-macOS-arm64-0a37a89.zip`，162011579字节；执行者记录 SHA256 `5403f5c48d675cb8ab7839be446507046758fad1230fdae148f75a09005167c9`。内容层级与摘要见 A manifest。没有创建 release/tag。

A 成包 GUI 须在符合 guard 的一次性 CI 系统账户中另验；当前实际退出1。D 连续拖动窗口、转场中 resize、完整进出全屏序列、物理跨 DPI、文字／席位／点击区／视频末帧交接、最小支持尺寸与范围外处理，以及欢迎至所有弹窗的完整页面×职责控件七态清单仍未验；已有固定尺寸、全屏取样与检查数量不能替代。E 跨设备真人、Windows／干净机／物理断网与正式系统信任未验。F 1920 图鉴长帧未定位，旧两人严重停顿未复现，欢迎52项不能证明旧问题修复；诊断交付已收口，无需重做整包。原失败、强制回收与缺退出码记录均保留。Kimi 未调用（暂停）。
