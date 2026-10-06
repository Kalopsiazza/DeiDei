# 末端配置与复测

本任务没有合并、发布 Release、部署公网或修改仓库设置。以下条件只影响对应验收层，不撤销已经完成的源码、真实模型、回环房间、后台和下载验证。

| 维护者提供或确认 | 用途与复测 |
| --- | --- |
| 公开 GitHub Releases 的 owner/repo、stable/beta 发布约定 | 填写独立的 `update-config.json`，仅固定公开 GitHub provider，无 PAT/headers/任意 URL。旧无 updater ZIP 首次手动安装。`publish-dry-run.cjs` 只列工件、tag、渠道，不上传。 |
| macOS Developer ID Application、有效公证方式 | production 构建在签名前写配置，签全部 Python/Torch 嵌套 Mach-O，再签外 app、公证/staple，核对 Gatekeeper。凭据来自 Keychain 或受保护环境，不入仓库和日志。 |
| 有效且相同的 macOS 测试签名身份，或 Windows 可信签名和实际 publisher | 用全新的独立 fixture 名字/appId/安装目录及默认合成 userData 构建 N/N+1/N+2；真实更新需证明文件版本、新进程、档案/规则/隐私能力保留。测试账户可作隔离选择，不能以目录 override 冒充成包默认路径。 |
| Windows x64 实机或手动 CI 运行环境 | 执行精确 hash lock、完整 NSIS 候选、实际 CPU 模型、签名 publisher、安装/更新/失败恢复。macOS 结果不替代 Windows。 |
| 好友房远端 WSS 与固定 `service-config.json` | 核对真实 TLS/证书及 rooms-1.2，再用两台设备完成建房、改规则、结算、断线恢复。当前只有真实回环服务与客户端验收。 |
| 受控统计 HTTPS origin、TLS/代理日志策略、管理 token 的秘密文件 | 启用 collector；分别核对真实 TLS、无 body/Authorization/IP 持久日志、管理认证/CSV。切换目的地后向旧受信 origin 删除旧贡献，旧能力不发新服务；合成能力跨原生替换仍可解密。 |
| 其他设备及真人体验 | 不同显示器/DPI、跨电脑房间、首次系统信任、窗口/输入/性能体验分别验收；本机 DPR2 与 rAF 短测不代表这些通过。 |
| 合并、公开分发与素材许可决定 | 本任务只交草稿 PR 和本机候选；维护者确认素材可分享范围并另行授权合并/公开分发后再推进。 |

配置细节、锁定工具与身份规则见 [打包说明](../../../game/packaging/README.md) 和 [打包外部条件](../../../game/packaging/EXTERNAL-REQUIREMENTS.md)。当前缺有效签名时 production 构建实际失败；local-test 候选不表示正式系统信任。

## 按条件补验

从本任务分支最终 head 开始，保留现有工作树和输出；每轮使用新的 output 和 fixture 名字。实际产物目录从 `game/packaging/build/latest.json` 读取，不把历史候选当作新版本。

```sh
# 正式配置及有效身份具备后；--publish 始终为 never。
game/packaging/.venv/bin/python game/packaging/build.py --mode production --update-config /private/path/update-config.json --telemetry-config /private/path/telemetry-config.json
node game/packaging/publish-dry-run.cjs <实际成功输出目录>

# 在当前 native 平台分别构建两个完整、同身份的独立工件。
game/packaging/.venv/bin/python game/packaging/build.py --mode fixture --fixture-url http://127.0.0.1:18742/ --fixture-name 'DeiDei Update Fixture R05-new-id' --fixture-version 0.5.0 --fixture-signing-identity '<有效macOS测试身份>'
game/packaging/.venv/bin/python game/packaging/build.py --mode fixture --fixture-url http://127.0.0.1:18742/ --fixture-name 'DeiDei Update Fixture R05-new-id' --fixture-version 0.5.1 --fixture-signing-identity '<同一有效身份>'
```

Windows 按打包说明使用 native x64 环境与 `--publisher-name`，不要使用 macOS 身份参数。原生安装 runner 的隔离前提及真实证据要求见 `check-native-update.cjs`；只有具备身份与隔离条件才执行安装。没有身份时可以执行明确的 `--transport-only --isolated-fixture`，该层仍不调用安装。

坏签名测试由 `prepare-bad-signature.py` 制作独立坏副本，禁止发布。macOS 验证原生交接拒绝，重开后以更高版本 N+2 重试；Windows 在下载阶段核验发布者，拒绝时 native 记未运行。不能用同版本不同 hash 绕过记录，也不重复叠加原生监听。

```sh
PYTHONPATH=game/telemetry game/telemetry/.venv/bin/python -m deidei_stats --database /private/path/stats.sqlite3 --admin-token-file /private/path/admin.token
PYTHONPATH=game/telemetry game/telemetry/.venv/bin/python -m deidei_stats.admin --origin https://stats.example.invalid --token-file /private/path/admin.token
PYTHONPATH=game/telemetry game/telemetry/.venv/bin/python -m deidei_stats.admin --origin https://stats.example.invalid --token-file /private/path/admin.token --csv --output /private/path/summary.csv
```

生产服务模板位于 `game/telemetry/deploy/`。若运营方另做备份，按 README 的最多7天及恢复前重放删除记录执行；已导出的离线 CSV 无法由客户端撤回。公网 TLS、运营备份恢复、真实旧目的地迁移与原生替换后的删除能力尚未验收。
