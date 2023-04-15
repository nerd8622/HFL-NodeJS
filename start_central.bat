@echo off
set /p "PORT=Enter Port: "
set /p "HOST=Enter Server Hostname: "
node central\index.js
pause