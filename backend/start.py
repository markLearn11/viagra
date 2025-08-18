#!/usr/bin/env python3
"""
启动脚本
用于快速启动开发服务器
"""

import os
import sys
import subprocess
from pathlib import Path

def check_requirements():
    """
    检查依赖是否已安装
    """
    try:
        import fastapi
        import uvicorn
        import sqlalchemy
        print("✓ 依赖检查通过")
        return True
    except ImportError as e:
        print(f"✗ 缺少依赖: {e}")
        print("请运行: pip install -r requirements.txt")
        return False

def check_env_file():
    """
    检查环境配置文件
    """
    env_file = Path(".env")
    env_example = Path(".env.example")
    
    if not env_file.exists():
        if env_example.exists():
            print("✗ 未找到 .env 文件")
            print("请复制 .env.example 为 .env 并配置相关参数")
            return False
        else:
            print("✗ 未找到环境配置文件")
            return False
    
    print("✓ 环境配置文件检查通过")
    return True

def check_database():
    """
    检查数据库是否已初始化
    """
    try:
        from app.database import engine
        from app.models import Base
        from sqlalchemy import inspect
        
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        if not tables:
            print("✗ 数据库未初始化")
            print("请运行: python init_db.py")
            return False
        
        print(f"✓ 数据库检查通过 (发现 {len(tables)} 个表)")
        return True
        
    except Exception as e:
        print(f"✗ 数据库检查失败: {e}")
        print("请检查数据库配置或运行: python init_db.py")
        return False

def start_server(host="0.0.0.0", port=8000, reload=True):
    """
    启动服务器
    """
    print(f"\n🚀 启动服务器...")
    print(f"   地址: http://{host}:{port}")
    print(f"   API文档: http://{host}:{port}/docs")
    print(f"   重载模式: {'开启' if reload else '关闭'}")
    print("\n按 Ctrl+C 停止服务器\n")
    
    try:
        import uvicorn
        uvicorn.run(
            "main:app",
            host=host,
            port=port,
            reload=reload,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n👋 服务器已停止")
    except Exception as e:
        print(f"\n❌ 启动失败: {e}")
        return False
    
    return True

def main():
    """
    主函数
    """
    print("🔍 正在进行启动前检查...\n")
    
    # 检查依赖
    if not check_requirements():
        return 1
    
    # 检查环境配置
    if not check_env_file():
        return 1
    
    # 检查数据库
    if not check_database():
        return 1
    
    print("\n✅ 所有检查通过！\n")
    
    # 解析命令行参数
    import argparse
    parser = argparse.ArgumentParser(description="启动小程序后端服务")
    parser.add_argument("--host", default="0.0.0.0", help="服务器地址")
    parser.add_argument("--port", type=int, default=8000, help="服务器端口")
    parser.add_argument("--no-reload", action="store_true", help="禁用自动重载")
    
    args = parser.parse_args()
    
    # 启动服务器
    success = start_server(
        host=args.host,
        port=args.port,
        reload=not args.no_reload
    )
    
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())