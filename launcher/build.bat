@echo off
REM IntelliCell - PyInstaller onedir build (CPU, D16). Output: app\dist\IntelliCell\IntelliCell.exe
setlocal
cd /d "%~dp0..\app"
pushd web
call npm ci || goto :err
call npm run build || goto :err
popd
.venv\Scripts\python -m pip install pyinstaller || goto :err
.venv\Scripts\pyinstaller --noconfirm --onedir --windowed --name IntelliCell ^
  --add-data "static;static" --add-data "server;server" --add-data "fixtures;fixtures" ^
  --paths server --collect-submodules skimage --collect-submodules uvicorn shell.py || goto :err
echo Built app\dist\IntelliCell\IntelliCell.exe
goto :eof
:err
echo Build failed.
pause
