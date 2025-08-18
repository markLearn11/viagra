from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import ChatSession, ChatMessage, User
from app.schemas import (
    ChatSessionCreate,
    ChatSessionResponse,
    ChatMessageCreate,
    ChatMessageResponse,
    MessageResponse
)

router = APIRouter()

# 聊天会话相关接口
@router.post("/sessions", response_model=ChatSessionResponse)
async def create_chat_session(
    session_data: ChatSessionCreate,
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    创建聊天会话
    """
    # 检查用户是否存在
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 创建会话
    db_session = ChatSession(
        user_id=user_id,
        title=session_data.title or "新的对话"
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    
    return db_session

@router.get("/sessions/user/{user_id}", response_model=List[ChatSessionResponse])
async def get_user_chat_sessions(
    user_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    获取用户的聊天会话列表
    """
    sessions = db.query(ChatSession).filter(
        ChatSession.user_id == user_id,
        ChatSession.is_active == True
    ).order_by(ChatSession.updated_at.desc()).offset(skip).limit(limit).all()
    
    return sessions

@router.get("/sessions/{session_id}", response_model=ChatSessionResponse)
async def get_chat_session(
    session_id: int,
    db: Session = Depends(get_db)
):
    """
    获取特定聊天会话
    """
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="聊天会话不存在"
        )
    
    return session

@router.put("/sessions/{session_id}", response_model=ChatSessionResponse)
async def update_chat_session(
    session_id: int,
    title: str,
    db: Session = Depends(get_db)
):
    """
    更新聊天会话标题
    """
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="聊天会话不存在"
        )
    
    session.title = title
    db.commit()
    db.refresh(session)
    
    return session

@router.delete("/sessions/{session_id}", response_model=MessageResponse)
async def delete_chat_session(
    session_id: int,
    db: Session = Depends(get_db)
):
    """
    删除聊天会话（软删除）
    """
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="聊天会话不存在"
        )
    
    session.is_active = False
    db.commit()
    
    return MessageResponse(message="聊天会话删除成功")

# 聊天消息相关接口
@router.post("/messages", response_model=ChatMessageResponse)
async def create_chat_message(
    message_data: ChatMessageCreate,
    db: Session = Depends(get_db)
):
    """
    创建聊天消息
    """
    # 检查会话是否存在
    session = db.query(ChatSession).filter(
        ChatSession.id == message_data.session_id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="聊天会话不存在"
        )
    
    # 创建消息
    db_message = ChatMessage(**message_data.dict())
    db.add(db_message)
    
    # 更新会话的最后更新时间
    from datetime import datetime
    session.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_message)
    
    return db_message

@router.get("/sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
async def get_session_messages(
    session_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    获取会话的消息列表
    """
    # 检查会话是否存在
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="聊天会话不存在"
        )
    
    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.asc()).offset(skip).limit(limit).all()
    
    return messages

@router.delete("/messages/{message_id}", response_model=MessageResponse)
async def delete_chat_message(
    message_id: int,
    db: Session = Depends(get_db)
):
    """
    删除聊天消息
    """
    message = db.query(ChatMessage).filter(
        ChatMessage.id == message_id
    ).first()
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="消息不存在"
        )
    
    db.delete(message)
    db.commit()
    
    return MessageResponse(message="消息删除成功")