@echo off
setlocal EnableExtensions
REM CAMEX sunumunu baslatir: once Python 3 ile onbelleksiz serve.py dener,
REM sonra Node.js, en son Windows PowerShell yedegini kullanir.

cd /d "%~dp0"

REM Yeni kurulan Python bazi acik oturumlarda PATH'e hemen yansimayabilir.
REM Kullanici Python kurulumlarini bu betik icin gecici olarak one aliyoruz.
if exist "%LocalAppData%\Programs\Python\Launcher" set "PATH=%LocalAppData%\Programs\Python\Launcher;%PATH%"
for /d %%P in ("%LocalAppData%\Programs\Python\Python3*") do (
  if exist "%%~fP\python.exe" set "PATH=%%~fP;%%~fP\Scripts;%PATH%"
)

set "DIA_NO_BROWSER_ARG="
set "DIA_PS_NO_BROWSER_ARG="
if "%DIASAGE_NO_BROWSER%"=="1" (
  set "DIA_NO_BROWSER_ARG=--no-browser"
  set "DIA_PS_NO_BROWSER_ARG=-NoBrowser"
)

echo CAMEX sunum sunucusu baslatiliyor (port 8242)...
echo Bu pencereyi KAPATMAYIN; sunum bitince kapatabilirsiniz.
echo.

call :RunPython "py -3"
if "%ERRORLEVEL%"=="0" goto done

call :RunPython "python"
if "%ERRORLEVEL%"=="0" goto done

call :RunPython "python3"
if "%ERRORLEVEL%"=="0" goto done

call :RunNode
if "%ERRORLEVEL%"=="0" goto done

call :RunPowerShell
if "%ERRORLEVEL%"=="0" goto done

echo HATA: Calisan Python 3, Node.js veya PowerShell bulunamadi.
echo Bu sunum icin yerel HTTP sunucusu gerekir; dosyayi file:// ile acmak yeterli degildir.
echo Python 3 kurup tekrar deneyin: https://www.python.org/downloads/
echo.
pause
exit /b 1

:RunPython
set "DIA_CMD=%~1"
for /f "tokens=1" %%A in ("%DIA_CMD%") do set "DIA_EXE=%%A"

where %DIA_EXE% >nul 2>nul
if errorlevel 1 exit /b 1

%DIA_CMD% -c "import sys; sys.exit(0 if sys.version_info >= (3, 7) else 1)" >nul 2>nul
if errorlevel 1 exit /b 1

echo Python bulundu: %DIA_CMD%
%DIA_CMD% "%~dp0serve.py" %DIA_NO_BROWSER_ARG%
exit /b 0

:RunNode
where node >nul 2>nul
if errorlevel 1 exit /b 1

node -e "const major = Number(process.versions.node.split('.')[0]); process.exit(major >= 14 ? 0 : 1)" >nul 2>nul
if errorlevel 1 exit /b 1

if not exist "%~dp0tools\serve.mjs" exit /b 1

echo Node.js bulundu: node
node "%~dp0tools\serve.mjs" %DIA_NO_BROWSER_ARG%
exit /b 0

:RunPowerShell
if not exist "%~dp0tools\serve-presentation.ps1" exit /b 1

where powershell.exe >nul 2>nul
if not errorlevel 1 (
  echo PowerShell yedegi kullaniliyor.
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve-presentation.ps1" -Root "%~dp0" -Port 8242 %DIA_PS_NO_BROWSER_ARG%
  exit /b 0
)

where pwsh >nul 2>nul
if not errorlevel 1 (
  echo PowerShell 7 yedegi kullaniliyor.
  pwsh -NoProfile -File "%~dp0tools\serve-presentation.ps1" -Root "%~dp0" -Port 8242 %DIA_PS_NO_BROWSER_ARG%
  exit /b 0
)

exit /b 1

:done
echo.
echo Sunucu durdu. Hata varsa yukarida gorebilirsiniz.
pause
exit /b 0
