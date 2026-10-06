# 检查与证据

日期2026-10-06，macOS arm64；开发Node24.12.0/npm11.6.2/Python3.13.7。原模型隔离CPU环境另列。原始日志保留在本任务 `.local-outputs/R05-T01-a/`，未提交大文件或私有档案。

| 产品SHA / 层 | 命令 | 退出码 / 实际结果 | 证据 |
| --- | --- | --- | --- |
| 01f6bc0cfa4c371c81d042a8cdac614909453f4c / source/unit baseline | `python3 scripts/check.py` | 0；各隔离组与旧AI保全通过，原expectedFailure保留 | baseline-python.log |
| 同基线 / desktop baseline | `npm --prefix game/desktop ci`，`npm --prefix game/desktop test` | 0；类型/构建、94项通过 | baseline-npm-ci.log / baseline-desktop.log |
| 同基线 / server baseline | `python3 -m venv game/server/.venv`；pip `--require-hashes -r game/server/requirements.lock`；`PYTHONPATH=game/core:game/server game/server/.venv/bin/python -m unittest discover -s game/server/tests -v` | 0；真实回环与服务检查通过 | baseline-server-install.log / baseline-server.log |
| 步骤1工作内容 / original core | `PYTHONPATH=game/core python3 -m unittest discover -s game/core/tests -v` | 0；原174项通过 | core-original.log |

## 分层最终状态（实施中，不是完成声明）

source/unit：基线PASS，新功能进行中。real_worker_room / real_model产品会话 / telemetry_http_db / update_transport / package_contents / native_install / production_trust / human_cross_device：NOT_RUN。模型原权重加载已提前PASS，不能替代对局或模型强度验收。

失败：候选NumPy1.26.4真实模型加载因缺少`numpy._core.numeric`失败；定向改用NumPy2.3.5真实加载成功。保留model-probe/raw-load.log。没有修改legacy八项、模型权重或使用随机网络。
