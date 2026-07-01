#!/bin/bash
# Zeabur 启动脚本

# 设置数据目录
export DATA_DIR="/data"
export UPLOADS_DIR="/data/uploads"
export DATABASE_URL="file:/data/local.db"

# 创建必要的目录
mkdir -p /data/uploads
mkdir -p /data/uploads/audio

# 初始化数据库（如果不存在）
if [ ! -f /data/local.db ]; then
  echo "Initializing database..."
fi

# 启动 Next.js 生产服务器
echo "Starting Next.js server..."
exec npm start