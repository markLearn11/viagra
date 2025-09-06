#!/bin/bash
# 生产环境启动脚本

set -e  # 遇到错误立即退出

echo "=== 栖溯光屿心理健康API 启动脚本 ==="

# 检查Python环境
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3, 请安装Python 3.8或更高版本"
    exit 1
fi

echo "Python版本: $(python3 --version)"

# 检查并创建必要目录
mkdir -p logs
mkdir -p uploads

# 检查环境配置
if [ ! -f ".env" ]; then
    if [ -f ".env.production" ]; then
        echo "使用生产环境配置..."
        cp .env.production .env
    else
        echo "警告: 未找到.env文件, 将使用.env.example创建"
        cp .env.example .env
        echo "请编辑.env文件配置您的环境变量"
    fi
fi

# 安装依赖
echo "正在安装依赖..."
python3 -m pip install -r requirements.txt --quiet

# 初始化数据库
echo "正在初始化数据库..."
python3 init_db.py

# 检查端口是否被占用
PORT=8000
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "警告: 端口 $PORT 已被占用"
    echo "正在尝试终止占用进程..."
    lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# 启动服务
echo "正在启动服务在端口 $PORT..."
echo "API文档地址: http://localhost:$PORT/docs"
echo "健康检查地址: http://localhost:$PORT/health"

python3 -m uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
