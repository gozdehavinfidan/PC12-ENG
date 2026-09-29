@echo off
REM IntelliCell - local start (offline). First run creates app\.venv and builds the UI if needed.
setlocal
cd /d "%~dp0..\app"
if not exist .venv\Scripts\python.exe (
  echo Creating Python environment...
  python -m venv .venv || goto :err
  .venv\Scripts\python -m pip install -r requirements.txt || goto :err
)
if not exist static\index.html (
  echo Building the UI - needs Node.js once...
  pushd web
  call npm ci || goto :err
  call npm run build || goto :err
  popd
)
.venv\Scripts\python shell.py
goto :eof
:err
echo Start failed. See the messages above.
pause
