@echo off
if not exist "%~dp0Reflect Mirror.exe" (
  echo Extract the complete Reflect Mirror ZIP before starting the mirror.
  pause
  exit /b 1
)
start "" "%~dp0Reflect Mirror.exe" --kiosk
