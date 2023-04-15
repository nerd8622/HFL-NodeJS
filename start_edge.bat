@echo off
set /p "PORT=Enter Port: "
set /p "HOST=Enter Server Hostname: "
set /p "CENTRAL_SERVER=Enter Central Server Hostname: "
node edge\index.js
pause