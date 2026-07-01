@echo off
chcp 65001 >nul
title 小象CRM - 微信聊天记录全自动导入

cd /d "%~dp0"

echo ============================================================
echo    小象智能 CRM - 微信聊天记录全自动导入
echo ============================================================
echo.
echo    一键完成：提取密钥 - 解密数据库 - 读取消息 - 上传CRM
echo.
echo    请确保：
echo    1. 微信已登录并在运行
echo    2. 以管理员身份运行此脚本（右键 - 以管理员身份运行）
echo.
echo ============================================================
echo.

REM 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到 Python
    echo.
    echo 请先安装 Python 3.8+
    echo 下载: https://www.python.org/downloads/
    echo 安装时勾选 "Add Python to PATH"
    echo.
    pause
    exit /b 1
)

echo ✅ Python 已安装
echo.

REM 检查依赖
python -c "import pymem; import Crypto; import requests" >nul 2>&1
if errorlevel 1 (
    echo ⚠  缺少依赖，正在安装...
    echo.
    pip install pymem pycryptodome requests
    if errorlevel 1 (
        echo.
        echo 尝试国内镜像源...
        pip install -i https://pypi.tuna.tsinghua.edu.cn/simple pymem pycryptodome requests
    )
    echo.
)

echo 🚀 开始导入...
echo.

python auto_import.py

echo.
echo ============================================================
echo   导入完成
echo ============================================================
pause
