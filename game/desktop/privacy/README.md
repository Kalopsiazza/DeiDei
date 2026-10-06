# 本机隐私服务

`TelemetryService` 由 main 创建，renderer 只能调用固定隐私桥。safeStorage 保护独立随机能力；密文绑定 origin/installation_id/policy，能力从不进入 renderer。正式目的地只接受 main 可信配置的 HTTPS origin，显式 fixture 才允许回环 HTTP。默认两 scope 关闭，连 enrollment、health、DNS 探测都不会发。

```js
const {TelemetryService} = require('./privacy/telemetry-service.cjs');
const stats = new TelemetryService({directory: privateUserData, safeStorage, appVersion, collectorOrigin});
await stats.ready;
stats.read(); stats.preview();
await stats.setScope('preferences', true, revision, stateToken);
await stats.stop(); await stats.setLocalRecording(false);
await stats.clearLocal(); await stats.deleteUploaded();
stats.setIdle(true); stats.restartSuspended(true);
```

read 公开 persistedScopes/effectiveScopes、revision/stateToken、配置/队列/删除状态；不公开安装 ID、凭据、epoch 控制文件。stop 在任何 await 前关闭门、换 token 并 abort，旧 enable 和旧 ACK 不能重开；写盘失败仍保持本进程停止并准确提示下次启动风险。只有授权 ACK 后才可产生 eligible；撤回每次增加 revision/换 epoch，丢旧队列。上传器从不扫描 local-usage 补传同意前历史。ACK 只删除被确认的版本，eligible 日累计基线仍留存。清本机汇总会原子换 epoch；删除 ACK 后重新同意换身份。旧 origin/policy 删除凭据独立保留，不能发往新服务。

main 内部观察接口：`recordSettings(oldProfile,newProfile)`（同值/重复保存不计）、`recordSession({id,sessionKind,gameplay,cardStyle,skills})`（内部 session id 仅去重）、`recordRecommendation(token,'shown'|'adopted',graphics)`（同 epoch 展示与成功保存采用配对）、`recordPerformance(closedSummary)`。初始化当前保存选择调用 recordSettings(profile,profile)，计数为零；教程/观众/MOCK/预览/失败开始不调用正式会话接口。推荐 token 与短期 session id 不上传。

本机粗汇总≤90 天/256KiB；eligible≤180 项/约120KiB，保留当前日基线；outbox≤7 天/32 条/128KiB，按日版本合并。单报告/批次≤32KiB、响应≤16KiB。只在菜单/设置空闲发送，每小时最多一批、UTC 每日最多四次；429 尊重 Retry-After、退避最多八次失败后停止自动重试。退出与比赛不等统计。好友房网络和更新网络各自有必要请求，与统计同意分开。

`privacy-state.json`/`local-usage.json` 只在私有 userData，以同目录临时文件、fsync、rename 原子写入；损坏/不可写/不可解密先关门，不以默认同意恢复。Node 单测用隔离 AES-GCM fixture 做算法与竞态验证。普通 main 的本机 Electron GUI 已实际使用原生 safeStorage 注册能力、保存密文并跨冷启动读取成功；正式已签名安装层/其他 OS 的系统保护仍须另验。

`persistenceBarrier()` 只等待当前本机串行写及 ConsentStore 的 diskPromise，不等待网络 ACK。安装协调器在门关闭后等待该屏障并重新读 warning；停止未落盘会取消安装。restartSuspended(false) 只有从 true 恢复时才可能重新确认，并检查暂停捕获的 token/epoch；较新 stop/写失败不会重开。

## 本地验证入口与真实边界

```sh
node --test game/desktop/test-privacy.cjs game/desktop/hardware/test.cjs
DEIDEI_SMOKE_OUTPUT=.local-outputs/R05-T01-a/settings-major node game/integration/smoke-settings-major.cjs
DEIDEI_SMOKE_OUTPUT=.local-outputs/R05-T01-a/telemetry-gui node game/integration/smoke-telemetry-major.cjs
```

普通 main 的回环 collector 夹具只从隔离 DEIDEI_TEST_DATA_DIR 的 privacy-fixture-config.json 读取固定 schema_version/origin；renderer 不能提交 URL，packaged 不读取此文件。未配置的普通 main 保持零请求。真实 collector GUI 仅通过已有固定 lifecycle.reportContext 的 transitioning=true 暂缓自然空闲发送，真实菜单最终放行；没有改时间、注入报告、直接调用 flush、绕过每小时限频或用假 safeStorage。用户动作采用正常界面，正式随机合法对手来自实际 worker。

最终证据：Python 7 项 `privacy-stats/python-tests-6.log`；Node 13 项 `privacy-stats/node-tests-8.log`；普通设置页 27 项 `settings-major-3/checks.json`；真实 collector GUI 30 项 `telemetry-gui-4/checks.json`。GUI 实际聚合仅 1 次正式 solo、1 次设置变化、2 次可见推荐展示、1 次成功保存采用、1 份有效短测，普通主进程自然一批发送并收到 ACK；eligible 保留 preferences rev5/performance rev1，outbox 清零。点击 stop 即关闭有效门，随后原子持久关闭；stop 不冒充服务删除。实际 erasure ACK 后 admin 安装/选择/所有组归零，同 userData 冷启动两 scope 关闭、无队列和补历史贡献。两次 owned main 正常退出，collector 无请求/IP/密钥持久日志。

失败日志完整保留：settings-major-1/2 为夹具异步控件/未聚焦时立即点击；settings-major-4 实际失焦拒绝；settings-major-5 在窗口上下文失效后 main 返回 SAMPLE_EXPIRED，不把失效样本算成功。telemetry-gui-1/2 用 async waitForFunction 造成 IPC 条件提前返回（当前 Playwright 不 await predicate），改 Node 侧 await 固定限时轮询；telemetry-gui-3 在 stop 原子写完成前检查 persisted 值，改为分别检查即时门和持久保存。最终 GUI 未模拟这些成功。跨设备/不同 DPR、正式 TLS/发布域名、备份恢复、真实签名安装层均未运行。Kimi 未调用。
