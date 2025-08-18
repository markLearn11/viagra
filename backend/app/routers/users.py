from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserResponse, MessageResponse

router = APIRouter()

@router.post("/register", response_model=UserResponse)
async def register_user(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """
    用户注册（微信小程序登录）
    """
    # 检查用户是否已存在
    existing_user = db.query(User).filter(
        User.openid == user_data.openid
    ).first()
    
    if existing_user:
        # 更新session_key
        if user_data.session_key:
            existing_user.session_key = user_data.session_key
            db.commit()
            db.refresh(existing_user)
        return existing_user
    
    # 创建新用户
    db_user = User(
        openid=user_data.openid,
        session_key=user_data.session_key
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.get("/me", response_model=UserResponse)
async def get_current_user(
    openid: str,
    db: Session = Depends(get_db)
):
    """
    获取当前用户信息
    """
    user = db.query(User).filter(User.openid == openid).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    return user

@router.get("/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    根据ID获取用户信息
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    return user

@router.put("/{user_id}/deactivate", response_model=MessageResponse)
async def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    停用用户账户
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    user.is_active = False
    db.commit()
    
    return MessageResponse(message="用户账户已停用")

@router.put("/{user_id}/activate", response_model=MessageResponse)
async def activate_user(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    激活用户账户
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    user.is_active = True
    db.commit()
    
    return MessageResponse(message="用户账户已激活")

@router.get("/", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    获取用户列表（管理员功能）
    """
    users = db.query(User).offset(skip).limit(limit).all()
    return users

@router.delete("/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    删除用户（管理员功能）
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    db.delete(user)
    db.commit()
    
    return MessageResponse(message="用户删除成功")