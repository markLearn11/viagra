#!/bin/bash
# 部署检查脚本

echo "=== 部署检查 ==="

# 检查基本端点
BASE_URL="http://121.196.244.75:8000"

echo "1. 检查根路径..."
curl -s "$BASE_URL/" || echo "❌ 根路径不可访问"

echo -e "\n2. 检查健康检查端点..."
curl -s "$BASE_URL/health" || echo "❌ 健康检查端点不可访问"

echo -e "\n3. 检查API文档..."
curl -s "$BASE_URL/docs" > /dev/null && echo "✅ API文档可访问" || echo "❌ API文档不可访问"

echo -e "\n4. 检查认证端点..."
curl -s "$BASE_URL/api/auth/verify-token" || echo "❌ 认证端点不可访问"

echo -e "\n5. 检查用户管理端点..."
curl -s "$BASE_URL/api/users/" || echo "❌ 用户管理端点不可访问"

echo -e "\n6. 检查进程状态..."
ps aux | grep uvicorn | grep -v grep || echo "❌ uvicorn进程未运行"

echo -e "\n7. 检查端口占用..."
netstat -tlnp | grep :8000 || echo "❌ 端口8000未被占用"

echo -e "\n8. 检查服务器连通性..."
ping -c 1 121.196.244.75 > /dev/null && echo "✅ 服务器连通" || echo "❌ 服务器不可达"

echo -e "\n=== 检查完成 ==="
echo "服务器地址: $BASE_URL"
echo "API文档: $BASE_URL/docs"
echo "健康检查: $BASE_URL/health"
