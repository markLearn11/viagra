from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
import time
from collections import defaultdict
from typing import Dict
import asyncio

# 简单的内存限流器
class RateLimiter:
    def __init__(self):
        self.requests: Dict[str, list] = defaultdict(list)
        self.window_size = 900  # 15分钟
        self.max_requests = 100  # 最大请求数
    
    def is_allowed(self, client_ip: str) -> bool:
        now = time.time()
        # 清理过期的请求记录
        self.requests[client_ip] = [
            req_time for req_time in self.requests[client_ip]
            if now - req_time < self.window_size
        ]
        
        # 检查是否超过限制
        if len(self.requests[client_ip]) >= self.max_requests:
            return False
        
        # 记录当前请求
        self.requests[client_ip].append(now)
        return True

# 全局限流器实例
rate_limiter = RateLimiter()

async def rate_limit_middleware(request: Request, call_next):
    """
    限流中间件
    """
    client_ip = request.client.host
    
    # 检查是否允许请求
    if not rate_limiter.is_allowed(client_ip):
        return JSONResponse(
            status_code=429,
            content={"detail": "请求过于频繁，请稍后再试"}
        )
    
    response = await call_next(request)
    return response

async def security_headers_middleware(request: Request, call_next):
    """
    安全头中间件
    """
    response = await call_next(request)
    
    # 添加安全头
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    return response