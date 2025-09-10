# pyright: reportGeneralTypeIssues=false

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import UserProfile, User
from app.schemas import (
    UserProfileCreate, 
    UserProfileUpdate, 
    UserProfileResponse,
    MessageResponse
)
from app.dependencies import get_current_active_user

router = APIRouter()

@router.post("/", response_model=UserProfileResponse)
async def create_profile(
    profile_data: UserProfileCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    创建用户资料
    """
    # 检查是否已有资料
    existing_profile = db.query(UserProfile).filter(
        UserProfile.user_id == current_user.id
    ).first()
    if existing_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户资料已存在"
        )
    
    # 创建资料
    db_profile = UserProfile(
        user_id=current_user.id,
        **profile_data.dict(exclude_unset=True)
    )
    db.add(db_profile)
    db.commit()
    db.refresh(db_profile)
    
    return db_profile

@router.get("/user/{user_id}", response_model=Optional[UserProfileResponse])
async def get_profile_by_user_id(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    根据用户ID获取资料
    """
    # 用户只能查看自己的资料
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限访问此用户资料"
        )
    
    profile = db.query(UserProfile).filter(
        UserProfile.user_id == user_id
    ).first()
    
    # 如果没有资料，返回 None 而不是 404 错误
    return profile

@router.put("/user/{user_id}", response_model=UserProfileResponse)
async def update_profile(
    user_id: int,
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    更新用户资料
    """
    # 用户只能更新自己的资料
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限更新此用户资料"
        )
    
    profile = db.query(UserProfile).filter(
        UserProfile.user_id == user_id
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户资料不存在"
        )
    
    # 更新字段
    update_data = profile_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)
    
    db.commit()
    db.refresh(profile)
    
    return profile

@router.delete("/user/{user_id}", response_model=MessageResponse)
async def delete_profile(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    删除用户资料
    """
    # 用户只能删除自己的资料
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限删除此用户资料"
        )
    
    profile = db.query(UserProfile).filter(
        UserProfile.user_id == user_id
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户资料不存在"
        )
    
    db.delete(profile)
    db.commit()
    
    return MessageResponse(message="用户资料删除成功")

@router.get("/", response_model=List[UserProfileResponse])
async def list_profiles(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    获取用户资料列表（管理员功能）
    """
    # 普通用户无权限访问用户资料列表
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="无权限访问用户资料列表"
    )