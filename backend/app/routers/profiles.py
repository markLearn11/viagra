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

@router.post("/create", response_model=UserProfileResponse, summary="创建用户档案")
async def create_user_profile(
    profile_data: UserProfileCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    创建用户档案
    如果档案已存在，则更新现有档案而不是报错
    """
    # 检查是否已有资料
    existing_profile = db.query(UserProfile).filter(
        UserProfile.user_id == current_user.id
    ).first()
    
    if existing_profile:
        # 如果档案已存在，则更新现有档案
        update_data = profile_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(existing_profile, field, value)
        db.commit()
        db.refresh(existing_profile)
        return existing_profile
    else:
        # 创建新档案
        db_profile = UserProfile(
            user_id=current_user.id,
            **profile_data.dict(exclude_unset=True)
        )
        db.add(db_profile)
        db.commit()
        db.refresh(db_profile)
        return db_profile

@router.put("/update", response_model=UserProfileResponse, summary="更新用户档案")
async def update_user_profile(
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    更新用户档案
    如果档案不存在，则创建新档案
    """
    # 查找现有档案
    profile = db.query(UserProfile).filter(
        UserProfile.user_id == current_user.id
    ).first()
    
    if not profile:
        # 如果档案不存在，则创建新档案
        db_profile = UserProfile(
            user_id=current_user.id,
            **profile_data.dict(exclude_unset=True)
        )
        db.add(db_profile)
        db.commit()
        db.refresh(db_profile)
        return db_profile
    else:
        # 更新现有档案
        update_data = profile_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(profile, field, value)
        db.commit()
        db.refresh(profile)
        return profile

@router.get("/me", response_model=Optional[UserProfileResponse], summary="获取当前用户档案")
async def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    获取当前用户档案信息
    """
    profile = db.query(UserProfile).filter(
        UserProfile.user_id == current_user.id
    ).first()
    
    # 如果没有资料，返回 None 而不是 404 错误
    return profile

@router.get("/{user_id}", response_model=Optional[UserProfileResponse], summary="根据用户ID获取档案")
async def get_profile_by_user_id(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    根据用户ID获取档案信息
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

@router.delete("/delete", response_model=MessageResponse, summary="删除当前用户档案")
async def delete_current_user_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    删除当前用户档案
    """
    profile = db.query(UserProfile).filter(
        UserProfile.user_id == current_user.id
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户档案不存在"
        )
    
    db.delete(profile)
    db.commit()
    
    return MessageResponse(message="用户档案删除成功")

@router.delete("/{user_id}", response_model=MessageResponse, summary="根据用户ID删除档案")
async def delete_profile_by_user_id(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    根据用户ID删除档案
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
            detail="用户档案不存在"
        )
    
    db.delete(profile)
    db.commit()
    
    return MessageResponse(message="用户档案删除成功")

@router.get("/", response_model=List[UserProfileResponse], summary="获取用户档案列表")
async def list_user_profiles(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    获取用户档案列表（管理员功能）
    """
    # 普通用户无权限访问用户资料列表
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="无权限访问用户资料列表"
    )