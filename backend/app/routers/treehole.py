# pyright: reportGeneralTypeIssues=false

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import TreeholePost, User
from app.schemas import (
    TreeholePostCreate,
    TreeholePostUpdate,
    TreeholePostResponse,
    MessageResponse
)
from app.dependencies import get_current_active_user

router = APIRouter()

@router.post("/posts", response_model=TreeholePostResponse)
async def create_treehole_post(
    post_data: TreeholePostCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    创建树洞帖子
    """
    # 创建帖子
    db_post = TreeholePost(
        user_id=current_user.id,
        **post_data.dict()
    )
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    
    return db_post

@router.get("/posts", response_model=List[TreeholePostResponse])
async def get_treehole_posts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    mood_score: Optional[int] = Query(None, ge=1, le=10),
    tags: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    获取树洞帖子列表（公开的匿名帖子）
    """
    query = db.query(TreeholePost).filter(
        TreeholePost.is_anonymous == True
    )
    
    # 按心情评分筛选
    if mood_score is not None:
        query = query.filter(TreeholePost.mood_score == mood_score)
    
    # 按标签筛选
    if tags:
        tag_list = tags.split(",")
        for tag in tag_list:
            query = query.filter(
                TreeholePost.tags.contains([tag.strip()])
            )
    
    posts = query.order_by(
        TreeholePost.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    return posts

@router.get("/posts/user/{user_id}", response_model=List[TreeholePostResponse])
async def get_user_treehole_posts(
    user_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    获取用户的树洞帖子（包括非匿名的）
    """
    # 用户只能查看自己的帖子
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限访问此用户帖子"
        )
    
    posts = db.query(TreeholePost).filter(
        TreeholePost.user_id == user_id
    ).order_by(
        TreeholePost.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    return posts

@router.get("/posts/{post_id}", response_model=TreeholePostResponse)
async def get_treehole_post(
    post_id: int,
    db: Session = Depends(get_db)
):
    """
    获取特定的树洞帖子
    """
    post = db.query(TreeholePost).filter(
        TreeholePost.id == post_id
    ).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="帖子不存在"
        )
    
    return post

@router.put("/posts/{post_id}", response_model=TreeholePostResponse)
async def update_treehole_post(
    post_id: int,
    post_data: TreeholePostUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    更新树洞帖子
    """
    post = db.query(TreeholePost).filter(
        TreeholePost.id == post_id
    ).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="帖子不存在"
        )
    
    # 检查是否是帖子作者
    if post.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限修改此帖子"
        )
    
    # 更新字段
    update_data = post_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(post, field, value)
    
    db.commit()
    db.refresh(post)
    
    return post

@router.delete("/posts/{post_id}", response_model=MessageResponse)
async def delete_treehole_post(
    post_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    删除树洞帖子
    """
    post = db.query(TreeholePost).filter(
        TreeholePost.id == post_id
    ).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="帖子不存在"
        )
    
    # 检查是否是帖子作者
    if post.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限删除此帖子"
        )
    
    db.delete(post)
    db.commit()
    
    return MessageResponse(message="帖子删除成功")

@router.get("/stats/mood")
async def get_mood_stats(
    db: Session = Depends(get_db)
):
    """
    获取心情统计数据
    """
    from sqlalchemy import func
    
    # 统计各心情评分的帖子数量
    mood_stats = db.query(
        TreeholePost.mood_score,
        func.count(TreeholePost.id).label('count')
    ).filter(
        TreeholePost.mood_score.isnot(None)
    ).group_by(
        TreeholePost.mood_score
    ).all()
    
    # 转换为字典格式
    stats = {str(mood): count for mood, count in mood_stats}
    
    return {"mood_distribution": stats}

@router.get("/stats/tags")
async def get_tags_stats(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    获取热门标签统计
    """
    from sqlalchemy import func
    from collections import Counter
    
    # 获取所有帖子的标签
    posts_with_tags = db.query(TreeholePost.tags).filter(
        TreeholePost.tags.isnot(None)
    ).all()
    
    # 统计标签频次
    all_tags = []
    for post_tags in posts_with_tags:
        if post_tags[0]:  # post_tags是一个元组
            all_tags.extend(post_tags[0])
    
    tag_counter = Counter(all_tags)
    popular_tags = tag_counter.most_common(limit)
    
    return {
        "popular_tags": [
            {"tag": tag, "count": count} 
            for tag, count in popular_tags
        ]
    }