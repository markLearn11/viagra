#!/usr/bin/env python3
"""
应用启动器
用于启动FastAPI应用
"""

import uvicorn
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

if __name__ == "__main__":
    # 从app模块导入FastAPI应用实例
    from app.main import app
    
    # 启动服务器
    uvicorn.run(
        "app.main:app",  # 指向app模块中的main.py文件的app实例
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True if os.getenv("ENVIRONMENT") == "development" else False
    )