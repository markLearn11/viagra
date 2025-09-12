# pyright: reportGeneralTypeIssues=false

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
import logging
from app.database import get_db
from app.models import User
from app.utils import verify_token

# 创建HTTPBearer实例
security = HTTPBearer()

# 配置日志
logger = logging.getLogger(__name__)

async def get_current_user_from_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    从token获取当前用户
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # 从credentials中获取token
        token = credentials.credentials
        logger.info(f"Received token: {token[:10]}...")  # 只记录前10个字符用于调试
        
        user_id = verify_token(token)
        logger.info(f"Decoded user_id: {user_id}")
        
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            logger.warning(f"User not found for id: {user_id}")
            raise credentials_exception
            
        logger.info(f"Successfully authenticated user: {user.id}")
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication failed: {str(e)}")
        raise credentials_exception

async def get_current_active_user(
    current_user: User = Depends(get_current_user_from_token)
) -> User:
    """
    获取当前活跃用户
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户已被禁用"
        )
    return current_user