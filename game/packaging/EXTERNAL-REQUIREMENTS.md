# R05 外部配置与未执行验收

此清单用于最终集中确认。它不表示已经配置、部署、发布或通过验收。

- 正式公开 GitHub Releases 的 owner/repo、stable/beta 发布约定，及首次从旧无 updater ZIP 手动安装的分发说明。生产 update-config.json 只接受固定公开 GitHub provider，不能含 token、headers、任意 URL 或 stagingPercentage。当前模板 configured=false。
- macOS Developer ID Application 身份、完整私有签名链与公证方式：有效 Keychain profile，或受保护环境中的 Apple API key，或 APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID。凭据不能写入仓库、工件或日志。builder 的 CSC_LINK/CSC_KEY_PASSWORD 可导入私有证书；production 构建前须已在 Keychain 可见有效 Developer ID。嵌套 Python/Torch 二进制也要签。
- Windows 可信代码签名与确切证书 publisher：WIN_CSC_LINK/WIN_CSC_KEY_PASSWORD 或 CSC_LINK/CSC_KEY_PASSWORD，以及 build.py --publisher-name。当前入口没有配置 Azure Trusted Signing；若选择该服务需另行明确完整服务参数并接入受保护配置，不能只用 AZURE_TENANT_ID 当签名证明。
- 能覆盖 N/N+1/N+2 的有效测试签名，以及严格独立 appId、应用名、安装目录和全新合成默认 userData，用于安装、坏签名拒绝后重试、native 新进程、safeStorage 保留；不能使用正式 R02 私人档案。CI 一次性 OS 账户是可选隔离方式，不要求另建账户才运行独立 fixture。当前本地没有有效签名身份，原生替换不得记 PASS。
- 统计 collector 的受控 HTTPS origin、旧目的地删除/上传确认场景与测试证据。telemetry-config.json 默认 schema_version=1、origin=null。更新产物保持隐私选择不等于 collector 迁移或旧记录删除已验收。
- Windows x64 实机/CI、macOS 其他设备、安装首次信任及真人 DPI/交互验收；macOS 单机候选与传输成功不能替代这些层。

手动 CI 默认 production，需要维护者先配置上述受保护环境与正式 feed JSON 才可完成；没有这些条件应选择显式 local-test。不会自动创建 Release、修改仓库可见性或关闭系统保护。
