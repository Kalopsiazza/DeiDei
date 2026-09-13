# R02-T05-a 中间失败与复测

这些不是最终验收版本；最终版本与产物只认 MANIFEST.json。没有删除原规则用例、修改独立预期或添加 skip 来处理失败。

| 版本 / 执行 | 实际结果与修复 |
| --- | --- |
| 本机首次 uv Python 获取 | 退出 2；固定 uv 内置表未列 Python 3.11.16。使用官方受支持的 metadata 参数，核对同版官方归档，无版本替换。 |
| 本机 21c7600 / CI 34770229110 | 冻结 worker 失败；显式 ad-hoc identity 触发 hardened runtime 的 Team ID 库校验。使用 PyInstaller 默认 ad-hoc 后复测。 |
| 本机 28bdccf / CI 34770270300 | worker 已通过，校验的目录是 Packager 平台输出目录；更正为其中真实 .app。 |
| 本机 016c13a | 许可证收集断言失败；Electron 的许可位于平台目录，不在 .app 内，补入 ZIP 的第三方资料。 |
| CI 34770439040 / 6e6f678 | 成包驱动诊断暴露 Mac /var 与 /private/var 路径比较，以及 Windows Node 递归复制时驱动提前退出；另有 source Electron 下载显式准备。 |
| CI 34770706886 / 1d7dc8b | 一次官方许可提取命令失败后误先提交了 SOURCES 索引。随后补齐官方归档内完整 notices；没有把该中间包当候选。 |
| CI 34770820119 / d38aa42 | Mac 菜单按钮名称含箭头，精确名称定位失败；Windows 仍停在复制。更正实际 UI 定位与平台复制方法。 |
| CI 34771048196 / 45ceaba | Mac 成包自动化通过。Windows Node fs.cpSync 导致驱动突然结束；改用已安装构建 Python 的 shutil 复制测试产物，不改变产品 worker 路径。控制台环境变量试验无效，已移除。 |
| CI 34771227463 / 6b5c3db | Mac 通过。Windows 游戏已启动，驱动把 Playwright 外层进程当主进程；从实际 app 读取 process.pid 后正确核验后台归属。 |
| CI 34771414682 / 8d23cb1 | 两端构建及成包自动化均通过，但下载核对发现 Windows checkout 默认 CRLF 转换使 catalog/lock 哈希与 Git 原字节不同。保留该版本的 build-info 与 ZIP 清单用于对照，不作为最终交付包。 |
| 45dbf9c | 临时 CI checkout 关闭自动换行转换；构建入口断言 catalog、entry-map 和实际 lock 等于对应 Git blob。最终执行结果见 final-run.json。 |

本机前三次构建的命令/退出码保存在 failures/；每个 CI 执行的原始日志可由 `https://github.com/Kalopsiazza/DeiDei/actions/runs/<执行编号>` 回读。成功构建前的失败没有上传相应运行候选。所有本机删除/复制只针对本包自己的输出与临时产物，原工作树未覆盖。

Mac 的 ad-hoc 完整性通过与 Gatekeeper 信任是两项结果：CI Gatekeeper 实际拒绝，保留退出码；本机旧有 `override=security disabled` 也不能计信任通过。本包没有改系统防护、没有购买证书或公证。

下载校验辅助脚本首次退出1：Python zipfile按CP437解释了ditto归档中的中文说明文件名；按实际UTF-8名称建立映射后所有条目通过，另用原生ditto展开、核对中文说明原字节及真实worker。未修改交付ZIP。
