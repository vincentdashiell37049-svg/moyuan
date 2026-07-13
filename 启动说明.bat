@echo off
chcp 65001 >nul
echo =========================================
echo   墨源 - AI古籍识读与研究工作台
echo =========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未检测到 Node.js，请先安装：
    echo    访问 https://nodejs.org 下载安装 LTS 版本（18+）
    pause
    exit /b 1
)

echo ✅ Node.js 已安装

echo.
echo 📦 安装依赖...
call npm install --silent
cd server && call npm install --silent && cd ..
cd client && call npm install --silent && cd ..
echo ✅ 依赖安装完成

echo.
echo 🚀 启动墨源...
echo.
echo    前端地址: http://localhost:5173/
echo    后端地址: http://localhost:3001/
echo.
echo    按 Ctrl+C 停止服务
echo.

cd /d "%~dp0"
npx concurrently --names "后端,前端" "cd server && npx tsx src/index.ts" "cd client && npx vite --host 0.0.0.0"