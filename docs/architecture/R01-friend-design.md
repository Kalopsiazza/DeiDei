# FRIEND-R01｜程序与验证设计 1.0

作者：ChatGPT · 2026-09-12。先依据 FRIEND-R01 PRD 编写，本文件只服务两项辅助工作，不改变游戏整体架构。

## D04｜Windows 验证安排

规划工作目录和受测代码目录分别放置。提交PR的分支从 `plan/r01-friend-v1` 开始；程序来自固定运行包或独立只读worktree，不能把技术线程的53个变更文件全部带入同学PR。

先尝试下载既有包，不要求同学预先装Python/Node。Git/GitHub CLI只是协作工具。若需要安装开发环境，先保存当前运行包实测结果，再在明确同意后做源码复测；同学电脑原来已有这些运行时，就将W07保留NOT_RUN，不能卸掉私人环境以凑通过。

工具只能结束本次实际启动的程序或它的子进程。采样绑定可执行文件完整路径、PID、创建时间，避免PID复用；不使用“结束所有python.exe/node.exe”的命令。出错时保留原包，截图只取测试窗口。破坏性档案测试使用单独测试副本，若无法隔离则留NOT_RUN。

子agent可分别查执行输出和报告，窗口串行操作。断网、安装、弹出的系统授权由同学亲自完成，代理在失联前提供离线步骤，不依赖边断网边联网问模型。

## D05｜素材预检的选型

使用Python3.11标准库；无需Node、Pillow、图像模型或服务器。文件建议：`cli.py`（参数和流程）、`manifest_io.py`（清单检查）、`png_metadata.py`（有预算的PNG元信息检查）、`report.py`（稳定报告）、`tests/`。这些是职责划分，可以在相同允许目录内调整文件数，不新增运行依赖。

不解码IDAT像素。`metadata_checks_passed=true`只说明本工具检查通过，不能代表图片完整可解码或存在真实透明像素。透明按PNG颜色类型4/6或合法tRNS块判断声明；输出字段名固定为 `transparency_declared`。

### 命令与返回

```text
python tools/asset-preflight/cli.py --root <素材目录> --manifest <清单JSON> --out <新的报告目录>
```

先校验参数和根目录，再读取清单，逐项检查，最后写 `report.json` 与 `report.md`。退出码0：没有error，允许warning；1：已完成检查但有素材error；2：清单格式、路径、安全或工具运行错误。报告目录已存在且非空时拒绝覆盖；报告目录不在素材根内，避免扫描自己的输出。输入完全只读。

### 清单1.0

```json
{
  "schema_version": 1,
  "assets": [
    {"id":"test-card","path":"cards/test.png","width":128,"height":192,"alpha_policy":"required"}
  ]
}
```

字段严格检查；未知字段报清单错误。id为非空ASCII `[a-z0-9][a-z0-9_-]{0,63}`，区分资产ID与文件名；清单内id唯一。path为使用 `/` 的相对路径，可含中文空格，禁止绝对路径、盘符、URL、空段、`.`、`..`和反斜线。width/height为1—8192的整数，不接受bool。alpha_policy只有`required`或`any`。

最多500条，清单最大1MiB，每个文件最大20MiB。它们是本工具工作预算，与游戏资源或正式美术规格无关。输入不提供时不能自行默认尺寸或透明政策。

相对路径逐段检查符号链接、Windows junction/reparse点；本任务不追随它们。解析结果落在root外则拒绝；无法可靠判断就保留error。打开普通文件时尽量使用同一文件句柄检查类型、大小与读取，读取总量不超过上限；本工具不以处理对抗性并发替换作为安全认证。文件只来自同学自己选择的样本目录。

### PNG元信息检查

按W3C PNG规范：8字节签名；IHDR第一块且数据长13；width/height正数；合法color_type/bit_depth组合；compression=0、filter=0、interlace=0或1。逐块检查声明长度不越文件、CRC相符，存在IDAT和IEND，IEND长度0；若看到APNG控制块则报告本工具暂不支持动画PNG。颜色类型3要求PLTE，tRNS与颜色类型/长度关系检查。达到20MiB预算则拒绝继续读取。

不尝试解码IDAT，所以不能报告PNG可解码；不访问内嵌URL或执行元信息。检查通过后获得width/height、bit_depth、color_type和transparency_declared。无透明声明但alpha_policy=required时为error；有声明也只确认“声明存在”。最后按文件原字节计算SHA-256，重复内容为warning。

### 报告1.0

```json
{
  "schema_version":1,
  "tool_version":"0.1.0",
  "summary":{"assets":1,"errors":0,"warnings":0},
  "items":[{
    "id":"test-card","path":"cards/test.png",
    "width":128,"height":192,"bit_depth":8,"color_type":6,
    "transparency_declared":true,"sha256":"由实际文件计算",
    "metadata_checks_passed":true,"findings":[]
  }]
}
```

失败项目字段用null，不以0伪装未知尺寸。findings逐项含 `code / severity / message`。编号至少覆盖 MISSING_FILE、DUPLICATE_ID、PATH_CASE_COLLISION、UNSAFE_PATH、READ_FAILED、BUDGET_EXCEEDED、INVALID_PNG_METADATA、SIZE_MISMATCH、TRANSPARENCY_NOT_DECLARED、DUPLICATE_CONTENT、UNSUPPORTED_APNG。涉及整个清单的致命错误退出2，写到stderr；若安全创建报告目录已完成，可另写错误报告，否则不写。

固定按id/path排序。Markdown只使用安全文本，不插入原文件提供的HTML，不自动嵌入图片或打开外链。报告不记录用户名、绝对路径、设备序列号；工作环境信息由执行报告另以非敏感摘要记录。

### 测试与证据

用标准库生成2×2、3×2等小PNG样本；大尺寸只写头而不分配巨型像素。样本覆盖RGB、RGBA、带tRNS、合法索引色、错CRC、截断、错尺寸、缺图、重ID、路径大小写同名、重复字节、预算超限、错误字段/布尔尺寸、中文空格、符号链接/Windows junction、不可写输出目录、第二次运行结果一致。测试临时目录自动清理，不触及用户素材。

```text
python -m unittest discover -s tools/asset-preflight/tests -v
```

平台不能创建链接或没有相应权限就显式标NOT_RUN，不伪造平台通过。至少覆盖PRD中A01—A08，每项能找到测试名或手动证据；仅Windows通过不能宣称Mac也通过。工具后续是否接入开发流水线，由ChatGPT另行决定，本次不加CI gate。

完整规则实现和这些测试尚未执行。

参考：W3C [PNG第三版](https://www.w3.org/TR/png-3/)（IHDR、PLTE、tRNS与块校验），2026-09-12核对。透明声明与像素内容的区别在本工具中保留。
