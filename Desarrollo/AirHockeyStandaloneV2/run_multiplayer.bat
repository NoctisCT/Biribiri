@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] No encuentro Node.js en PATH.
    pause
    exit /b 1
)

echo ========================================
echo  AIR HOCKEY STANDALONE V2 MULTIPLAYER
echo ========================================
echo.
echo Arrancando servidor en http://127.0.0.1:8766/
echo.

start "Air Hockey V2 Server" /b node server.js

powershell -NoProfile -Command ^
  "$deadline=(Get-Date).AddSeconds(10); " ^
  "do { " ^
  "  try { " ^
  "    $c = New-Object System.Net.Sockets.TcpClient; " ^
  "    $iar = $c.BeginConnect('127.0.0.1',8766,$null,$null); " ^
  "    $ok = $iar.AsyncWaitHandle.WaitOne(200); " ^
  "    if($ok -and $c.Connected){ $c.EndConnect($iar); $c.Close(); exit 0 }; " ^
  "    $c.Close() " ^
  "  } catch {} " ^
  "  Start-Sleep -Milliseconds 100 " ^
  "} while((Get-Date) -lt $deadline); exit 1"

if errorlevel 1 (
    echo.
    echo [ERROR] El servidor no llego a abrir el puerto 8766.
    echo Mira los errores de Node que aparecen arriba.
    pause
    exit /b 1
)

echo [OK] Servidor listo.
echo [OK] Abriendo jugador 1 y jugador 2...
echo.

start "" "http://127.0.0.1:8766/"
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:8766/"

echo.
echo Deja esta ventana abierta mientras juegas.
echo Para detener el servidor, cierra esta ventana.
echo.
pause >nul
