#!/bin/bash

# UU Notes Server 部署脚本 - 适用于 NAS

set -e

echo "🚀 开始部署 UU Notes Server..."

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 未找到 Node.js，请先安装 Node.js${NC}"
    echo "安装方法："
    echo "  群晖: 套件中心 → 搜索 Node.js → 安装"
    echo "  QNAP: App Center → 搜索 Node.js → 安装"
    echo "  或使用 Docker: docker pull node:18-alpine"
    exit 1
fi

echo -e "${GREEN}✓ Node.js 版本: $(node -v)${NC}"

# 安装依赖
echo "📦 安装依赖..."
npm install

# 检查环境变量文件
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  未找到 .env 文件，从 .env.example 复制...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  请编辑 .env 文件，配置你的参数！${NC}"
    exit 1
fi

# 创建数据目录
echo "📁 创建数据目录..."
mkdir -p data

# 检查 PM2
if command -v pm2 &> /dev/null; then
    echo "🔄 使用 PM2 启动服务..."
    pm2 stop uu-notes-server 2>/dev/null || true
    pm2 delete uu-notes-server 2>/dev/null || true
    pm2 start index.js --name uu-notes-server
    pm2 save
    echo -e "${GREEN}✓ 服务已启动（使用 PM2 管理）${NC}"
    echo "查看日志: pm2 logs uu-notes-server"
    echo "重启服务: pm2 restart uu-notes-server"
    echo "停止服务: pm2 stop uu-notes-server"
else
    echo -e "${YELLOW}⚠️  未安装 PM2，使用普通模式启动...${NC}"
    echo "建议安装 PM2 以便进程管理: npm install -g pm2"
    echo "启动服务: npm start"
fi

echo ""
echo -e "${GREEN}🎉 部署完成！${NC}"
echo ""
echo "接下来的步骤："
echo "1. 编辑 .env 文件，配置你的参数"
echo "2. 配置域名和 HTTPS（必须）"
echo "3. 在小程序后台配置服务器域名"
echo "4. 修改小程序代码，使用新的 API"
echo ""
echo "详细文档: README.md"
