叠叠 R03 · 本机诊断包

先看 build-info.json：DIAGNOSTIC_BASELINE 表示有已知产品缺陷，仅供诊断；CANDIDATE 也须查看成包自动验证结果。本包不是公网联机版，不代表正式发行或真人验收。

解压整个 ZIP，保留 room-server、THIRD-PARTY 和客户端。无需系统 Python。
macOS arm64：
  ./room-server/deidei-room-server --host 127.0.0.1 --port 8765
  DEIDEI_ROOM_URL=ws://127.0.0.1:8765/rooms-v1 './DeiDei R03 Diagnostic.app/Contents/MacOS/DeiDeiR03'
Windows x64 PowerShell：
  .\room-server\deidei-room-server.exe --host 127.0.0.1 --port 8765
另一个 PowerShell：
  $env:DEIDEI_ROOM_URL='ws://127.0.0.1:8765/rooms-v1'
  & '.\DeiDei R03 Diagnostic-win32-x64\DeiDeiR03.exe'

服务只监听本机；使用已有 --port 0 可获得临时端口，按 Listening 输出填写客户端环境变量。默认 after_turn / early_reveal=true / 10秒。不要向外网开放。退出服务用 Ctrl+C，原临时房间不会持久化。

服务不在场时仍可从主菜单选择单人对局。macOS 为 ad-hoc、未公证；Windows 未签名。遇到系统阻止请保留提示，勿关闭系统防护。原生CI不等于干净机/普通用户通过。

原作者及第三方许可见 THIRD-PARTY；未给整个游戏添加新许可证。
