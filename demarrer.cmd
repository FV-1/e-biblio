@echo off
rem Double-cliquez sur ce fichier pour installer (la premiere fois) et lancer e-biblio.
cd /d "%~dp0"
title e-biblio

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 ou plus recent est necessaire : https://nodejs.org
  echo Installez-le, puis double-cliquez a nouveau sur ce fichier.
  pause
  exit /b 1
)

call npm start
if errorlevel 1 pause
