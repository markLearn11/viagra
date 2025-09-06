'''
Author: jihao00122 52628008+jihao00122@users.noreply.github.com
Date: 2025-09-06 23:38:21
LastEditors: jihao00122 52628008+jihao00122@users.noreply.github.com
LastEditTime: 2025-09-07 00:00:25
FilePath: /viagra/backend/app/main.py
Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
'''
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPBearer
from contextlib import asynccontextmanager
import uvicorn
import os
from dotenv import load_dotenv

from .database import engine, Base
from .routers import users, profiles, chat, mbti, treehole, characters, auth
from .middleware import rate_limit_middleware

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时创建数据库表
    Base.metadata.create_all(bind=engine)
    yield
    # 关闭时的清理工作
    pass

app = FastAPI(
    title="栖溯光屿心理健康API",
    description="为心理健康小程序提供后端服务",
    version="1.0.0",
    lifespan=lifespan
)

# 安全中间件
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["*", "121.196.244.75", "localhost", "127.0.0.1"]
)

# CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://121.196.244.75:8000",
        "http://121.196.244.75",
        "http://localhost:3000",
        "https://servicewechat.com",
        "https://*.servicewechat.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 限流中间件
app.middleware("http")(rate_limit_middleware)

# 注册路由
app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(users.router, prefix="/api/users", tags=["用户管理"])
app.include_router(profiles.router, prefix="/api/profiles", tags=["用户资料"])
app.include_router(chat.router, prefix="/api/chat", tags=["聊天功能"])
app.include_router(mbti.router, prefix="/api/mbti", tags=["MBTI测试"])
app.include_router(treehole.router, prefix="/api/treehole", tags=["树洞功能"])
app.include_router(characters.router, prefix="/api/characters", tags=["角色管理"])

@app.get("/")
async def root():
    return {"message": "栖溯光屿心理健康API服务正在运行"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "xinli-backend",
        "version": "1.0.0"
    }

if __name__ == "__main__":
        uvicorn.run(
        "app.main:app",  # ✅ 正确！明确指向自己
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True if os.getenv("ENVIRONMENT") == "development" else False
    )