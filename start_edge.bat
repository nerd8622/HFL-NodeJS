@echo off
set /p "port=Enter Port: "
node edge\index.js %port%
pause