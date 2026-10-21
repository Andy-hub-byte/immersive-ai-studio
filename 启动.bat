@echo off
chcp 65001 >nul
cd /d %~dp0
echo ============================================================
echo   Immersive 3D AI Studio  -  One-click Launcher
echo   沉浸式 3D AI 工作室    -  一键启动
echo ============================================================
echo.

rem ---- 1. 选择端口（8000 被占用则顺延 8010/8020） ----
set PORT=8000
netstat -ano | findstr :8000 | findstr LISTENING >nul
if %errorlevel%==0 (
  set PORT=8010
  netstat -ano | findstr :8010 | findstr LISTENING >nul
  if %errorlevel%==0 (
    set PORT=8020
    netstat -ano | findstr :8020 | findstr LISTENING >nul
    if %errorlevel%==0 (
      echo [X] Ports 8000/8010/8020 are all in use. Please free one and retry.
      echo [X] 8000/8010/8020 端口均被占用，请释放其中一个后重试。
      pause
      exit /b 1
    )
  )
)

rem ---- 2. 检测 Python（首选）/ Node.js（备选） ----
where python >nul 2>nul
if %errorlevel%==0 (
  set PY=python
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    set PY=py
  ) else (
    where node >nul 2>nul
    if %errorlevel%==0 (
      goto usenode
    ) else (
      echo [X] Neither Python nor Node.js was found.
      echo [X] 未找到 Python 或 Node.js 运行时。
      echo     Install either one first:
      echo     - Python:  https://www.python.org/downloads/  ^(check "Add to PATH"^)
      echo     - Node.js: https://nodejs.org/
      pause
      exit /b 1
    )
  )
)

echo [1/2] Starting local server on port %PORT% ...  正在启动本地服务器...
rem ---- 3. 延迟 2 秒打开浏览器（等服务器就绪） ----
start "" cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:%PORT%/index.html"
%PY% -m http.server %PORT%
goto end

:usenode
echo [1/2] Python not found, starting via Node.js ...  未找到 Python，改用 Node.js 启动...
start "" cmd /c "timeout /t 3 /nobreak >nul & start "" http://localhost:%PORT%/index.html"
npx --yes http-server -p %PORT% -c-1 .

:end
echo.
echo Server stopped. You can close this window.  服务器已停止，可以关闭本窗口。
pause
