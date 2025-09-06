from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPBearer
from contextlib import asynccontextmanager
import uvicorn
import os
from dotenv import load_dotenv

from app.database import engine, Base
from app.routers import users, profiles, chat, mbti, treehole, characters, auth
from app.middleware import rate_limit_middleware

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
app.include_router(auth.router, tags=["认证"])
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
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True if os.getenv("ENVIRONMENT") == "development" else False
    )