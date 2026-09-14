## 这次想解决什么

实现 R03 首批好友房服务，让本机客户端能够创建/加入 2—6 人房、独立观战、准备开局并由服务统一结算。

## 改了什么，哪些没有涉及

仅增加 `game/server/**` 与本任务结果。实现临时身份和重连、房号/密码、角色/准备、权威截止、
超时/休整/缺席、弃权后的有效结果、个人过滤快照、请求幂等与消息边界；提供 A08 真 socket 测试入口。
复用 classic-1.0.1 核心；不改 desktop、runtime、旧测试、模型、打包或正式规划。

## 怎样验证

受测代码 `417ae52f50fb806d1205381a4a148bc96117c7d6`，macOS arm64 / Python 3.13.7。
`docs/results/R03-T01-a/validate.py` 记录命令、退出码和日志：

- 服务 42 tests，通过；六客户端加两观众连续三场、真实时钟截止。
- 核心 174 tests，独立核心 192 fixtures / 469 calls，工具 8 tests，通过。
- `scripts/check.py`：40 tests，39 通过 + 1 原有 expected failure；pip check 和 CLI help 通过。
- 独立房间 T03、Electron、Windows、跨机与真人 NOT_RUN。
- 慢 writer/容量有明确注入边界，不冒充物理弱网或性能压测。

## 对现有内容的影响

- 规则/招式/状态编码/模型：无改动。
- 新依赖：独立 `websockets==17.0.1`，hash lock；PyPI/OSV 查询记录随包，无已列出漏洞。
- 配置：当前候选默认可运行；用户答复未到，状态 PROVISIONAL，不生成已确认配置。
- 未部署、未打包、未改主干或其他 PR。

## 已知问题

交付 PARTIAL：参数尚未确认，本说明备妥但尚未推送/创建 PR。独立任务 03 与跨平台验收需后续进行。
完整细节见 REPORT、TEST-MATRIX、MANIFEST。未调用 Kimi，Codex 自查已完成。

## 提交者确认

- [x] 改动仅在获准目录，无无关重构。
- [x] 如实记录验证和未测项目，未删/跳过失败测试。
- [x] 未提交凭证、个人材料、运行时环境或大文件。
