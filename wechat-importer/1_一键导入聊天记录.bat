@echo off
chcp 65001 >nul
title 小象CRM - 批量导入微信聊天记录

cd /d "%~dp0"

echo ========================================
echo   小象CRM - 批量导入微信聊天记录
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
    echo ⚠  未找到 wechat_key.txt 文件
    echo.
    echo 你需要先获取微信数据库密钥:
    echo 1. 下载 WeChatMsg: https://github.com/LC044/WeChatMsg/releases
    echo 2. 运行后点击「获取信息」，复制 Key
    echo 3. 将密钥保存为 wechat_key.txt 放在当前目录
    echo.
    set /p key_input=或者直接输入密钥: 
    if defined key_input (
        echo %key_input% > wechat_key.txt
        echo ✓ 密钥已保存
    ) else (
        echo ❌ 没有密钥无法继续
        pause
        exit /b 1
    )
)

echo.
echo 🚀 正在启动导入程序...
echo.
python wechat_importer.py

echo.
echo ========================================
echo   导入完成
echo ========================================
pause
