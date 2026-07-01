@echo off
chcp 65001 >nul
title 小象CRM - 一键安装依赖

echo ========================================
echo   小象CRM微信导入 - 安装依赖
echo ========================================
echo.

echo [1/3] 检查 Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到 Python
    echo.
    echo 请先安装 Python 3.8 或更高版本:
    echo 下载地址: https://www.python.org/downloads/
    echo 安装时请勾选 "Add Python to PATH"
    echo.
    pause
    exit /b 1
)
echo ✓ Python 已安装
python --version

echo.
echo [2/3] 安装依赖包...
pip install requests pycryptodome pymem
if errorlevel 1 (
    echo.
    echo ⚠  尝试使用国内镜像源...
    pip install -i https://pypi.tuna.tsinghua.edu.cn/simple requests pycryptodome pymem
)

echo.
echo [3/3] 验证安装...
python -c "import requests; import Crypto; print('✓ 依赖安装成功')" 2>nul
if errorlevel 1 (
    echo ❌ 依赖安装失败，请检查网络连接
    pause
    exit /b 1
)

echo.
echo ========================================
echo   ✅ 依赖安装完成！
echo ========================================
echo.
echo 接下来你可以运行:
echo   - 双击 "1_一键导入聊天记录.bat" 导入历史消息
echo   - 双击 "2_启动实时监控.bat" 持续同步新消息
echo.
pause
