#!/bin/bash

set -euo pipefail

# FG2 项目使用 Supabase 远程数据库，不再有本地 SQLite/Prisma 数据库。
# 此脚本保留为占位：仅在存在本地 db/ 目录时原样复制，不再执行 prisma db push。

PROJECT_DIR="${PROJECT_DIR:-/home/z/my-project}"
BUILD_DIR="${BUILD_DIR:?BUILD_DIR is required}"
SOURCE_DB_DIR="$PROJECT_DIR/db"

if [ -d "$SOURCE_DB_DIR" ] && [ -n "$(ls -A "$SOURCE_DB_DIR" 2>/dev/null)" ]; then
    echo "🗄️  复制本地 db/ 目录到构建产物（如存在）..."
    mkdir -p "$BUILD_DIR/db"
    cp -a "$SOURCE_DB_DIR/." "$BUILD_DIR/db/"
else
    echo "ℹ️  数据层为 Supabase 远程服务，无本地数据库需要打包，跳过"
fi

echo "✅ 数据库构建步骤完成"
