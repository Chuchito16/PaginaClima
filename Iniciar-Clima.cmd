@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 22.12 o superior desde https://nodejs.org y vuelve a abrir este archivo.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm.cmd ci
  if errorlevel 1 (
    echo No fue posible instalar las dependencias. Revisa la conexion a Internet.
    pause
    exit /b 1
  )
)
echo Abriendo Termometro de la Tierra. Cierra esta ventana para detener el servidor.
call npm.cmd run dev -- --open
if errorlevel 1 pause
