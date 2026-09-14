# 候选诊断包下载

两端PACKAGED_AUTOMATION_PASS；产品d0c96408a3aa8c14174099da4247bcac953fb9f7，工具325006a2fd17f9beaa5ee68ae0142da01986806f。

[原生CI run 34909293225](https://github.com/Kalopsiazza/DeiDei/actions/runs/34909293225) 双端通过。内部artifact保留30天；到期时间为UTC。下载需有仓库访问权限。下载Actions外层ZIP后，取出里面的DeiDei候选ZIP并完整解压，保留客户端、room-server、THIRD-PARTY。不要单独搬动exe或app。

## windows

[下载artifact 10373429643](https://github.com/Kalopsiazza/DeiDei/actions/runs/34909293225/artifacts/10373429643)，到期2026-10-14T23:34:45Z。

- 外层ZIP SHA256：`c567af38cdcef30ec8afd5b1cdbc7b3bba0ae98963e060e82b169ba97d72fb1a`，178430281 bytes。
- 内层文件：`DeiDei-R03-T05-a-CANDIDATE-win32-x64-d0c9640.zip`，178846599 bytes。
- 内层SHA256：`80e185cec1c05817bee31019733480693ae8d8888d52c6cf419a0f2b87a99e27`。
- 实际下载验证：PASS，250项清单一致。包内build-info与client/server一致。

## macos

[下载artifact 10373269801](https://github.com/Kalopsiazza/DeiDei/actions/runs/34909293225/artifacts/10373269801)，到期2026-10-14T23:33:55Z。

- 外层ZIP SHA256：`66a42ccebe1d8ccdc963b3a07303911120f0db9aadbca99b9244b40423fdc18c`，149268540 bytes。
- 内层文件：`DeiDei-R03-T05-a-CANDIDATE-darwin-arm64-d0c9640.zip`，149937759 bytes。
- 内层SHA256：`4409f0d016adb91405d4e367487e18fabc5cc5cd634d9abe2f40fa8102959d21`。
- 实际下载验证：PASS，341项清单一致。包内build-info与client/server一致。

## 启动

仅本机loopback验证，不是异地联机发行版。无需系统Python。macOS终端先启动服务，再在另一终端启动客户端：

```sh
./room-server/deidei-room-server --host 127.0.0.1 --port 8765
DEIDEI_ROOM_URL=ws://127.0.0.1:8765/rooms-v1 './DeiDei R03 Diagnostic.app/Contents/MacOS/DeiDeiR03'
```

Windows PowerShell先启动服务，再在另一窗口设置地址并启动客户端：

```powershell
.\room-server\deidei-room-server.exe --host 127.0.0.1 --port 8765
$env:DEIDEI_ROOM_URL='ws://127.0.0.1:8765/rooms-v1'
& '.\DeiDei R03 Diagnostic-win32-x64\DeiDeiR03.exe'
```

macOS ad-hoc、未公证，CI spctl rejected；Windows未签名。遇系统阻止保留提示，不关闭防护。真人/干净机/公网未验收。CI在停止服务后验证了原离线单人。

旧DIAGNOSTIC_BASELINE产物及失败记录仅用于历史诊断，见downloads-baseline.json和REPORT-BASELINE.md；不替换或改标为候选。
