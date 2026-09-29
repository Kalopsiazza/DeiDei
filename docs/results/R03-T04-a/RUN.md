# 复跑入口

先按 game/server/requirements.lock 建立服务环境，桌面按原 npm lock 安装依赖。本轮复用已有版本，未改锁。
从仓库根目录：

```sh
/path/to/venv/bin/python game/integration/run.py --output /tmp/deidei-integration-result
```

默认串行跑所有基线、三轮独立160例（N35继续未测）、真实 GUI、100 seed 与900秒持续运行；各组失败仍继续安全独立项，总退出非零。
可用 `--stage checks|gui|sequences|soak` 分阶段复跑，默认 all；`--independent-runs 3`、`--seeds 100`、`--soak-seconds 900`。
脚本要求产品/测试输入已提交，禁止复跑过程中修改或提交该检出；输出放临时目录或本任务结果目录。

`npm test` 现在包含原25和在线28；`npm run test:online`、原MOCK入口保留。`npm run smoke:live-online` 是真实服务与窗口，DEIDEI_PYTHON 指既定服务环境。
run.py 自动把自身 Python 传给服务、relay 和离线 worker，使用全新临时档案，最终回收自有子进程。不得把测试脚本、relay、临时档案带进成包产品。
每份 output/run.json 保留具体子命令、退出码、阶段受测 SHA、时长及源码哈希；输出不包含会话凭证或未揭晓对手牌。
