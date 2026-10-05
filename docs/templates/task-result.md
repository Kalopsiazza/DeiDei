# <R01-Txx-a>｜执行结果

## 身份与输入

task_id：  
执行状态：RUNNING / PARTIAL / BLOCKED / SUBMITTED（不得自填 ACCEPTED）  
输入 ref 与完整 SHA：  
PRD／架构／UI 版本：  
执行分支与 PR：  
tested_code_sha（无代码写 N/A）：  
报告提交 SHA（上传后补入 PR 说明即可）：

## 本包完成了什么

逐条对应工作包的验收编号，分别写 PASS、FAIL、NOT_RUN、WAITING_FOR_TEDDY。只报告自己实际做过的事。

## 变更范围

文件清单：  
是否出现允许目录外变化：  
原代码／模型／依赖是否改变：

## 验证记录

| 验收项 | 机器／环境 | 命令或操作 | 结果／退出码 | 证据路径 |
| --- | --- | --- | --- | --- |
| 示例 TECH-03 | 填实际系统与 CPU | 填实际操作 | 不填猜测结果 | 相对路径 |

Windows/macOS 分别列构建、运行、离线、人工观察。CI 无头、开发模式、分发包运行分别标注。未测试的设备不能写支持。

## 产物索引

| 文件／包 | 用途 | 路径／下载位置 | SHA-256 | 保存期 |
| --- | --- | --- | --- | --- |
| 待填 | 待填 | 待填 | 待填 | 仓库永久／artifact 日期 |

生图额外记录参考图 SHA-256、提示词、实际工具／模型、尺寸、次数、后处理。运行截图注明系统、时间和被测提交。截图／日志先去掉私人路径与凭据。

## 未完成、原因与下一步所需

缺谁的答案：  
需要 ChatGPT 修改哪些设计：  
需要 Teddy 的设备／选择：  
还有哪些结论仅是猜测：

## 返回 ChatGPT

本包可以审什么、不能审什么：  
PR URL：  
结果目录：

附 `manifest.json`，最少包含 task_id、status、input_ref、input_sha、prd_version、architecture_version、tested_code_sha、platforms、commands、artifacts（path/sha256/kind）、open_questions。没有实际值用 null 或 unknown，不伪造 SHA。
