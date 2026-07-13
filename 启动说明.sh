#!/bin/bash
# 墨源 - 一键启动脚本
# 使用方法：bash 启动说明.sh

echo "========================================="
echo "  墨源 - AI古籍识读与研究工作台"
echo "========================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js，请先安装："
    echo "   访问 https://nodejs.org 下载安装 LTS 版本（18+）"
    echo "   或用 Homebrew: brew install node"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 版本过低（当前 v$(node -v)），需要 18 以上"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# 安装依赖
echo ""
echo "📦 安装依赖..."
npm install --silent 2>/dev/null
cd server && npm install --silent 2>/dev/null && cd ..
cd client && npm install --silent 2>/dev/null && cd ..
echo "✅ 依赖安装完成"

# 启动
echo ""
echo "🚀 启动墨源..."
echo ""
echo "   前端地址: http://localhost:5173/"
echo "   后端地址: http://localhost:3001/"
echo ""
echo "   按 Ctrl+C 停止服务"
echo ""

cd "$(dirname "$0")"
npx concurrently --names "后端,前端" "cd server && npx tsx src/index.ts" "cd client && npx vite --host 0.0.0.0"