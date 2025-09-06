#!/usr/bin/env python3
"""
后端项目打包脚本
用于将后端项目打包成可部署的形式
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path
import datetime
import zipfile

# 定义打包配置
PACKAGE_NAME = "xinli-backend"
VERSION = "1.0.0"
OUTPUT_DIR = "dist"

# 需要包含的文件和目录
INCLUDE_FILES = [
    "main.py",
    "requirements.txt",
    ".env.example",
    "README.md",
    "init_db.py"
]

INCLUDE_DIRS = [
    "app"
]

# 需要排除的文件和目录模式
EXCLUDE_PATTERNS = [
    "__pycache__",
    "*.pyc",
    "*.pyo",
    "*.pyd",
    ".git",
    ".env",
    "*.db",
    "dist",
    "build",
    "*.egg-info"
]

def print_header(message):
    """打印带格式的标题"""
    print("\n" + "=" * 60)
    print(f" {message}")
    print("=" * 60)

def should_exclude(path):
    """检查路径是否应该被排除"""
    for pattern in EXCLUDE_PATTERNS:
        if pattern.startswith("*."):
            ext = pattern[1:]
            if str(path).endswith(ext):
                return True
        elif pattern in str(path):
            return True
    return False

def create_package():
    """创建部署包"""
    print_header("开始打包后端项目")
    
    # 创建时间戳
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    package_dir = f"{OUTPUT_DIR}/{PACKAGE_NAME}-{VERSION}-{timestamp}"
    
    # 创建输出目录
    os.makedirs(package_dir, exist_ok=True)
    print(f"✓ 创建输出目录: {package_dir}")
    
    # 复制文件
    for file in INCLUDE_FILES:
        if os.path.exists(file):
            shutil.copy2(file, f"{package_dir}/{file}")
            print(f"✓ 复制文件: {file}")
        else:
            print(f"✗ 文件不存在: {file}")
    
    # 复制目录
    for dir_name in INCLUDE_DIRS:
        if os.path.exists(dir_name) and os.path.isdir(dir_name):
            dest_dir = f"{package_dir}/{dir_name}"
            os.makedirs(dest_dir, exist_ok=True)
            
            for root, dirs, files in os.walk(dir_name):
                # 过滤掉需要排除的目录
                dirs[:] = [d for d in dirs if not should_exclude(os.path.join(root, d))]
                
                for file in files:
                    src_file = os.path.join(root, file)
                    if not should_exclude(src_file):
                        # 计算相对路径
                        rel_path = os.path.relpath(src_file, dir_name)
                        dest_file = os.path.join(dest_dir, rel_path)
                        
                        # 确保目标目录存在
                        os.makedirs(os.path.dirname(dest_file), exist_ok=True)
                        
                        # 复制文件
                        shutil.copy2(src_file, dest_file)
            
            print(f"✓ 复制目录: {dir_name}")
        else:
            print(f"✗ 目录不存在: {dir_name}")
    
    # 创建启动脚本
    create_start_script(package_dir)
    
    # 创建ZIP归档
    zip_filename = f"{OUTPUT_DIR}/{PACKAGE_NAME}-{VERSION}-{timestamp}.zip"
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(package_dir):
            for file in files:
                file_path = os.path.join(root, file)
                zipf.write(file_path, os.path.relpath(file_path, OUTPUT_DIR))
    
    print(f"✓ 创建ZIP归档: {zip_filename}")
    print_header(f"打包完成! 输出文件: {zip_filename}")
    return zip_filename

def create_start_script(package_dir):
    """创建启动脚本"""
    start_script = f"{package_dir}/start.sh"
    with open(start_script, 'w') as f:
        f.write("""#!/bin/bash
# 启动脚本

# 检查Python环境
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3, 请安装Python 3.8或更高版本"
    exit 1
fi

# 安装依赖
echo "正在安装依赖..."
python3 -m pip install -r requirements.txt

# 检查环境配置
if [ ! -f ".env" ]; then
    echo "警告: 未找到.env文件, 将使用.env.example创建"
    cp .env.example .env
    echo "请编辑.env文件配置您的环境变量"
fi

# 初始化数据库
echo "正在初始化数据库..."
python3 init_db.py

# 启动服务
echo "正在启动服务..."
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
""")
    
    # 设置可执行权限
    os.chmod(start_script, 0o755)
    print(f"✓ 创建启动脚本: start.sh")

def main():
    """主函数"""
    # 检查当前目录是否是后端项目根目录
    if not all(os.path.exists(f) for f in ["main.py", "requirements.txt"]):
        print("错误: 请在后端项目根目录下运行此脚本")
        sys.exit(1)
    
    try:
        zip_file = create_package()
        print(f"\n后端项目已成功打包: {zip_file}")
        print("\n部署说明:")
        print("1. 解压ZIP文件到服务器")
        print("2. 进入解压后的目录")
        print("3. 运行 ./start.sh 启动服务")
    except Exception as e:
        print(f"错误: 打包过程中出现异常: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()