#!/usr/bin/env bash
# ============================================================
# 启动.sh — 一键启动（macOS / Linux / 安卓 Termux 通用）
# One-click launcher for macOS / Linux / Android (Termux)
#
# 用法 / Usage:   bash 启动.sh
#
# 安卓平板（Termux）/ Android tablet (Termux):
#   1. 安装 Termux（建议 F-Droid / GitHub 版，Play 版已停更）
#   2. pkg install python        （或 pkg install nodejs）
#   3. 进入本项目目录执行: bash 启动.sh
#   无法自动跳转浏览器时，脚本会打印网址，复制到浏览器打开即可。
# ============================================================
set -u
cd "$(dirname "$0")"

# ---- 1. 选择空闲端口（8000 / 8010 / 8020 顺延） ----
pick_port() {
  for p in 8000 8010 8020; do
    if command -v curl >/dev/null 2>&1; then
      curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$p/" || { echo "$p"; return; }
    elif (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null; then
      exec 3>&- 2>/dev/null || true
    else
      echo "$p"; return
    fi
  done
  echo ""
}

PORT="$(pick_port)"
if [ -z "$PORT" ]; then
  echo "[X] 8000/8010/8020 端口均被占用，请释放一个后重试。"
  echo "[X] Ports 8000/8010/8020 are all busy. Free one and retry."
  exit 1
fi
URL="http://localhost:$PORT/index.html"
echo "============================================================"
echo "  Immersive 3D AI Studio — 一键启动 / One-click launcher"
echo "  地址 / URL: $URL"
echo "  停止 / Stop: 按 Ctrl+C 或关闭本窗口 (Ctrl+C / close window)"
echo "============================================================"

SERVER_PID=""
cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  echo ""
  echo "服务器已停止 / Server stopped."
}
trap cleanup EXIT INT TERM

# ---- 2. 启动本地服务器（Python 首选，Node.js 备选） ----
if command -v python3 >/dev/null 2>&1; then PY=python3
elif command -v python >/dev/null 2>&1; then PY=python
else PY=""
fi

if [ -n "$PY" ]; then
  "$PY" -m http.server "$PORT" --bind 0.0.0.0 >/dev/null 2>&1 &
  SERVER_PID=$!
elif command -v node >/dev/null 2>&1; then
  echo "[提示] 未找到 Python，改用 Node.js（首次会自动下载 http-server）…"
  echo "[hint] Python not found, falling back to Node.js (auto-download on first run)…"
  npx --yes http-server -p "$PORT" -c-1 . >/dev/null 2>&1 &
  SERVER_PID=$!
else
  echo "[X] 未找到 Python 或 Node.js，请先安装任一运行时："
  echo "[X] Neither Python nor Node.js found. Install either one first:"
  echo "    - Python : https://www.python.org/downloads/"
  echo "    - Node.js: https://nodejs.org/"
  exit 1
fi

# ---- 3. 等待服务就绪并打开浏览器（按平台选择打开方式） ----
sleep 2
if command -v termux-open-url >/dev/null 2>&1; then
  termux-open-url "$URL" 2>/dev/null || true   # 安卓 Termux
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 || true      # Linux
elif command -v open >/dev/null 2>&1; then
  open "$URL" >/dev/null 2>&1 || true          # macOS
else
  echo "[提示] 无法自动打开浏览器，请手动访问 / open manually: $URL"
fi
echo "[就绪] 服务已启动 / server is up: $URL"
wait "$SERVER_PID" 2>/dev/null || true
