@echo off
chcp 65001 >nul
title 小象CRM - 微信聊天实时监控

cd /d "%~dp0"

echo ========================================
echo   小象CRM - 微信聊天实时监控
echo ========================================
echo.

REM 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到 Python，请先运行 "0_安装依赖.bat"
    pause
    exit /b 1
)

REM 检查密钥文件
if not exist "wechat_key.txt" (
    echo ❌ 未找到 wechat_key.txt 文件
    echo 请先运行 "1_一键导入聊天记录.bat" 配置密钥
    pause
    exit /b 1
)

echo 提示: 按 Ctrl+C 可以停止监控
echo.
echo 🚀 正在启动监控程序...
echo.
python wechat_monitor.py

echo.
echo 监控已停止
pause
