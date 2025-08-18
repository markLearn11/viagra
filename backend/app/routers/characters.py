from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import Character
from app.schemas import (
    CharacterCreate,
    CharacterUpdate,
    CharacterResponse,
    MessageResponse
)

router = APIRouter()

@router.post("/", response_model=CharacterResponse)
async def create_character(
    character_data: CharacterCreate,
    db: Session = Depends(get_db)
):
    """
    创建新角色
    """
    # 检查角色名是否已存在
    existing_character = db.query(Character).filter(
        Character.name == character_data.name
    ).first()
    
    if existing_character:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="角色名已存在"
        )
    
    db_character = Character(**character_data.dict())
    db.add(db_character)
    db.commit()
    db.refresh(db_character)
    
    return db_character

@router.get("/", response_model=List[CharacterResponse])
async def get_characters(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db)
):
    """
    获取角色列表
    """
    query = db.query(Character)
    
    # 按分类筛选
    if category:
        query = query.filter(Character.category == category)
    
    # 按状态筛选
    if is_active is not None:
        query = query.filter(Character.is_active == is_active)
    
    characters = query.order_by(
        Character.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    return characters

@router.get("/categories")
async def get_character_categories(
    db: Session = Depends(get_db)
):
    """
    获取所有角色分类
    """
    from sqlalchemy import func
    
    categories = db.query(
        Character.category
    ).filter(
        Character.category.isnot(None),
        Character.is_active == True
    ).distinct().all()
    
    return {
        "categories": [cat[0] for cat in categories if cat[0]]
    }

@router.get("/popular")
async def get_popular_characters(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    获取热门角色（按使用次数排序）
    """
    characters = db.query(Character).filter(
        Character.is_active == True
    ).order_by(
        Character.usage_count.desc()
    ).limit(limit).all()
    
    return characters

@router.get("/{character_id}", response_model=CharacterResponse)
async def get_character(
    character_id: int,
    db: Session = Depends(get_db)
):
    """
    获取特定角色信息
    """
    character = db.query(Character).filter(
        Character.id == character_id
    ).first()
    
    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )
    
    return character

@router.put("/{character_id}", response_model=CharacterResponse)
async def update_character(
    character_id: int,
    character_data: CharacterUpdate,
    db: Session = Depends(get_db)
):
    """
    更新角色信息
    """
    character = db.query(Character).filter(
        Character.id == character_id
    ).first()
    
    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )
    
    # 如果更新名称，检查是否与其他角色重名
    if character_data.name and character_data.name != character.name:
        existing_character = db.query(Character).filter(
            Character.name == character_data.name,
            Character.id != character_id
        ).first()
        
        if existing_character:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="角色名已存在"
            )
    
    # 更新字段
    update_data = character_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(character, field, value)
    
    db.commit()
    db.refresh(character)
    
    return character

@router.delete("/{character_id}", response_model=MessageResponse)
async def delete_character(
    character_id: int,
    db: Session = Depends(get_db)
):
    """
    删除角色
    """
    character = db.query(Character).filter(
        Character.id == character_id
    ).first()
    
    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )
    
    db.delete(character)
    db.commit()
    
    return MessageResponse(message="角色删除成功")

@router.post("/{character_id}/use", response_model=CharacterResponse)
async def use_character(
    character_id: int,
    db: Session = Depends(get_db)
):
    """
    使用角色（增加使用次数）
    """
    character = db.query(Character).filter(
        Character.id == character_id
    ).first()
    
    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )
    
    if not character.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="角色已被禁用"
        )
    
    # 增加使用次数
    character.usage_count += 1
    db.commit()
    db.refresh(character)
    
    return character

@router.post("/{character_id}/toggle-status", response_model=CharacterResponse)
async def toggle_character_status(
    character_id: int,
    db: Session = Depends(get_db)
):
    """
    切换角色启用/禁用状态
    """
    character = db.query(Character).filter(
        Character.id == character_id
    ).first()
    
    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )
    
    # 切换状态
    character.is_active = not character.is_active
    db.commit()
    db.refresh(character)
    
    return character

@router.get("/search/{query}")
async def search_characters(
    query: str,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    搜索角色（按名称和描述）
    """
    characters = db.query(Character).filter(
        Character.is_active == True
    ).filter(
        Character.name.contains(query) |
        Character.description.contains(query)
    ).limit(limit).all()
    
    return characters