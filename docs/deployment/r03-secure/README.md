# R03 TLS 准备（R03-T06-a）

本包交付服务端可选 TLS、桌面主进程只读地址配置与本机联测工具。
经典规则 `classic-1.0.1`、协议 `rooms-1.1`、端点 `/rooms-v1`、子协议 `deidei.rooms.v1` 保持。
实际部署尚未执行，资源缺项见 [PENDING-DEPLOYMENT.md](PENDING-DEPLOYMENT.md)。

## 服务启动与停止

在仓库根目录按 `game/server/README.md` 创建专用 Python 3.11+ 环境并安装原 hashlock。
以下仅监听回环，证书路径由环境提供，不能使用本次测试证书对外服务：

```sh
PYTHONPATH=game/core:game/server game/server/.venv/bin/python -m deidei_server \
  --host 127.0.0.1 --port 8765 \
  --tls-cert-file /approved/path/fullchain.pem \
  --tls-key-file /approved/path/private.key
```

省略两个证书参数仍使用原明文回环模式。证书必须成对、可读、匹配，支持未加密 PEM 私钥；
加密私钥立即报错，不读取终端密码。错误发生在监听之前，无明文降级。最低 TLS 1.2，握手限时 5 秒。
用 Ctrl+C 停止前台服务；不会安装守护进程、修改系统启动项或防火墙。

未来非回环 IP 监听必须同时传入 `--allow-remote` 和 TLS；本包仅纯函数检查该组合，未实际非回环 bind。
上线前应由获准的部署任务落实普通低权限运行用户、私钥访问权限、证书完整链与有效期、域名匹配、
证书续期与有界重启。现有进程启动时载入证书，更新证书文件需要受控重启，内存房间会结束。
不支持 bind 域名、代理头信任或反向代理配置。Origin、消息/连接/队列预算与真实对端 IP 限流保持。
日志只记录既有有限事件/错误码及监听 URL，不启用帧、密码或身份凭据日志。

## 桌面配置优先级

主进程启动时仅读取一次，不向 renderer 提供地址输入、文件访问、证书或临时身份凭据。

| 环境 | 地址来源 | 无效/缺失处理 |
| --- | --- | --- |
| 源码 | `DEIDEI_ROOM_URL` | 空值为未配置；非法 URL 为配置错误 |
| 成包有文件 | 固定 `resources/service-config.json` | 文件优先，环境不能覆盖；null 主动关闭联机 |
| 成包文件坏/不可读 | 同上 | `SERVICE_CONFIG_INVALID`，不回退 |
| 成包文件不存在 | 环境仅允许严格回环诊断 ws/wss | 非回环报配置错误；环境也缺失则未配置 |

示例 JSON 只在此文档目录；没有放进成品或改变现有打包程序。
正式文件最多 4096 UTF-8 字节，字段精确为 `schema_version:1` 和 `room_url`，拒绝重复键。
坏配置只在联机入口显示，菜单、档案与离线单人仍可使用。修改地址后需退出并重新启动应用。

URL 必须精确使用 `/rooms-v1`，禁止凭据、空白/控制字符、查询、片段、编码路径、点路径与尾斜杠。
ws 仅允许 `127.0.0.1`/`[::1]` 加显式 1–65535 端口；wss 接受有效 ASCII DNS/标准 IP，缺端口为 443。
拒绝未指定目标、组播、IPv4 非单播范围和不明确的数字 IP 别名。证书验证失败不会切回 ws。
通用握手/网络错误显示“安全连接未建立，请检查服务器证书或网络”，不猜测具体证书原因。

## 重现安全联测

使用原依赖锁；Node 需提供原生 WebSocket，Electron/Playwright 使用现有桌面固定依赖。
先 `cd game/desktop && npm run build`，再回到仓库根目录：

```sh
PYTHONPATH=.:game/core:game/server game/server/.venv/bin/python -m unittest discover \
  -s game/server/tests -p 'test_transport_tls*.py' -v
node --test game/desktop/tests-online/test-service-config.cjs
PYTHONPATH=.:game/core:game/server game/server/.venv/bin/python \
  game/integration/secure/run.py --electron --output /tmp/deidei-secure-evidence
```

`DEIDEI_OPENSSL` 可指定已安装的 OpenSSL 可执行文件；未设置使用 PATH 中的 `openssl`。
工具只在新临时目录生成两套测试 CA 和四类证书，逐命令核对退出码、保存公开指纹。
Python 用 `cafile`，Node/Electron 用启动时的 `NODE_EXTRA_CA_CERTS`；不改系统信任，测试结束删除证书目录。
无图形环境时省略 `--electron`，只记录 L2/L3，不等同于 L4 通过。

L2 是真实 Python TLS socket；L3 是原生 WebSocket + NetworkRoomPort；L4 是普通 Electron main/preload/renderer。
L3/L4 共用行为脚本，独立记录层次。测试观察器只数 `session.open`，故障控制只关闭自有 socket/服务。
不替换裁判，不记录 token、密码或私钥。L4 使用独立合成档案，自动应答应用自己的退出对局提示，
不操纵系统安全确认。每次子进程有 180 秒上限，保存进程退出、端口释放与临时目录删除证据。

## 技术依据

- [Python SSLContext](https://docs.python.org/3.11/library/ssl.html)：服务端 TLS context、证书链加载与客户端验证。
- [websockets 加密连接](https://websockets.readthedocs.io/en/stable/howto/encryption.html)：向 serve 传入 TLS context。
- [Node 24 启动参数](https://nodejs.org/download/release/v24.12.0/docs/api/cli.html)：额外 CA 在进程启动时读取。

不新增依赖、CI、自动安装脚本或运行包。Windows、新成包读取配置的实际窗口、公网/跨电脑与真实设备仍需后续验收。
