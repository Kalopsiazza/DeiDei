#!/bin/zsh

# ponytail: 项目内虚拟环境已足够；需要对外分发时再封装 macOS App。
cd -- "${0:A:h}"

if [[ ! -x .venv/bin/python ]]; then
  echo "启动失败：未找到项目运行环境 .venv"
  echo "请在此目录执行：python3 -m venv .venv && .venv/bin/python -m pip install -r requirements_rl.txt"
  read -k 1 "?按任意键关闭..."
  exit 1
fi

.venv/bin/python gui_deidei.py
exit_code=$?

if (( exit_code != 0 )); then
  echo
  echo "DeiDei 启动失败（退出码：$exit_code）。"
  read -k 1 "?按任意键关闭..."
fi

exit $exit_code
