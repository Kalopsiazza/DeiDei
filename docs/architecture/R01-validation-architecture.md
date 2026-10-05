# 第一轮验证架构

编号 ARC-R01 · 版本 1.0 · 作者 ChatGPT · 2026-09-11  
前置：PRD-R01 1.0。状态：选定用于验证；尚非正式游戏架构。Codex 负责按本设计实测，不能自行换技术路线。

## 本轮选型

桌面程序：Electron；界面：React + TypeScript + 普通 CSS；构建与打包：Electron Forge；本机逻辑：Python 3.11 起步、既有 deidei_env.py 只读复用；轻量可执行程序：PyInstaller onedir；试验通信：按行 JSON，经 stdin/stdout。

这项选择优先利用现有 Python 游戏与 AI，并为手绘素材和卡片信息提供可控页面。体积与运行成本评估放在真实包体积、内存、冷启动和不同系统表现上；本次不承诺 Electron 比其他方案更快或更小。

Godot、Tauri、Unity 没有被判定不可用；本轮不让三个线程各自选择一个。候选未通过时，ChatGPT 根据证据发 b 包或新架构版本。图片生成属于素材生产步骤，玩家运行游戏时不调用图片模型。

## 实验中的各部分

- renderer：本地打包页面，只展示验证按钮、六个固定占位席位和少量测试卡图；不持有胜负判定，不接触本地文件系统。
- preload：仅暴露固定方法 health、profileRead、profileWrite、runCase、chooseEasy、shutdown；不暴露任意命令执行、任意文件路径或通用 IPC。
- main：创建窗口；校验通信来源与参数；保存测试档案；拉起／停止本机 Python 可执行程序；收集并展示故障。
- Python worker：调用只读的既有代码；维护固定双人案例，不连接网络；stdout 仅输出协议消息，诊断写 stderr。

源码只写 `experiments/r01-t02-a/`。如果打包需要拷贝既有文件，只在实验构建目录生成带原始 SHA-256 的副本，不提交第二套可编辑规则。旧模型不变，不反序列化来源不明的文件。

## 试验协议 v1

请求为一行 UTF-8 JSON：`{"v":1,"id":"req-001","op":"health","payload":{}}`。

成功：`{"v":1,"id":"req-001","ok":true,"data":{"worker":"ready"}}`。失败：`{"v":1,"id":"req-001","ok":false,"error":{"code":"BAD_REQUEST","message":"..."}}`。

op 仅 health、run_case、choose_easy、shutdown；case_id 仅固定测试名称，不接受任意 Python 表达式或代码路径。每条消息上限 64 KiB，超过或 JSON 不完整时报告错误；id 配对响应。首次 health 等待上限 10 秒，超时显示失败并提供重试，不能永远等待。上述数值仅为实验参数。

固定案例：双方攒、Bi 对攒、Bi 对普通防御、反弹对 Bi。每次用全新状态，结果作为旧程序行为，不写成正式玩法结论。已知炸药列表副作用仍由 T01 取证，本实验不能偷偷修复它。

choose_easy 使用显式随机种子和既有公开双人状态；不把玩家本回合尚未揭晓的选择传给 AI。显示 AI 类型与随机种子。模型检查单独报告，不把 fallback 当专家模型。

## 本地档案试验

仅写实验专用 userData 子目录下的 profile.json，字段 version、localId、nickname、avatarId、settings。字段类型和长度做白名单检查，昵称以纯文本显示。用临时文件写完再替换；无权限、损坏文件给可见提示，不自行删除玩家文件。实验目录与将来产品档案分开。

这里的一机一档按当前安装／操作系统用户的数据目录工作，不建立跨系统用户的硬件绑定。正式保存位置与迁移策略留到正式架构。

## 桌面安全与离线

nodeIntegration=false、contextIsolation=true、sandbox=true，保留 webSecurity；本地 app:// 资源协议、限制 CSP、不加载远端脚本、字体或 UI。禁止任意新窗口、导航和外部协议；IPC 校验 sender 与参数。正式包不依赖 Vite 开发服务。Python 从打包资源的固定路径启动，参数使用数组，shell=false。

离线测试断开网络并关闭开发服务，再从分发目录启动；不只在已运行窗口里切换离线按钮。非开发环境没有可调用的系统 Python/Node，也应能运行。退出窗口和应用都验证子进程回收；连续启停十次记录观察。不能用关闭系统安全功能来制造通过结果。

## 打包与平台

Windows 和 macOS 分别用对应系统构建 Python 程序，分别打包 Electron。先记录实际 Windows OS/CPU、Mac OS/CPU，不默认 x64、arm64 或 Intel 已测试。没有目标机就写未验证；CI build 通过、无头自动检查、原生窗口运行、真人试玩是四项不同证据。

轻量包先含简单 AI。隔离环境另做既有权重 CPU 加载测试，报告依赖确切版本、耗时、内存、回退与 GUI 反向依赖问题；需要改 rl_ai.py 才能通过时报告给 ChatGPT，a 包不修改它。模型运行包的设计可在 b 包完成。

使用受支持稳定依赖，不装预览版本。实际版本写 package-lock.json 与 Python 精确依赖清单；库的替换属于方案变更，返回 ChatGPT。工具的小版本选择属于实验准备，但要能复现。

允许新增 `.github/workflows/r01-t02-a.yml`，仅实验目录与本 PR 触发，contents:read，无 secrets，不运行 pull_request_target，不发布 release。安装文件不提交进 Git，采用任务结果的 Actions artifact 或已获准附件，报告 SHA-256、位置与保存期。

## 联机和动画在本轮的位置

远端房间服务方向已保留，正式阶段由 ChatGPT 设计无云端账号的会话身份、房间密码、出牌保密和结果权威。本轮不部署公网服务、不写房间协议、不租服务器。

中央仅用于确认窗口和素材能显示。完整演出、事件数据、逐招组合以及是否增加独立 2D 渲染库，在规则资料具备后由 ChatGPT 另写架构。不能以实验方便为由加入临时胜负逻辑。

## 官方资料与设计依据

读取日期 2026-09-11。以下提供工具能力与注意事项；上面的组合和取舍是 ChatGPT 为本项目作出的候选设计。

- Electron 进程模型：https://www.electronjs.org/docs/latest/tutorial/process-model
- Electron 安全建议：https://www.electronjs.org/docs/latest/tutorial/security
- Electron Forge 打包与模板：https://www.electronforge.io/
- PyInstaller 手册（目标系统分别构建）：https://pyinstaller.org/en/stable/
- 桌面签名与公证：https://www.electronjs.org/docs/latest/tutorial/code-signing
- Playwright Electron 自动化为 experimental，自动结果不能替代实机：https://playwright.dev/docs/api/class-electron

不据此声称已完成 Windows/macOS 测试。性能数字全部由任务 02 实测后填写。
