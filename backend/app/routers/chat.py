from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import logging

from app.database import get_db
from app.models import ChatSession, ChatMessage, User
from app.schemas import (
    ChatSessionCreate,
    ChatSessionResponse,
    ChatMessageCreate,
    ChatMessageResponse,
    MessageResponse,
    ChatRequest,
    ChatResponse
)
from app.services import get_deepseek_service

logger = logging.getLogger(__name__)
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

# AI聊天接口
@router.post("/ai-chat", response_model=ChatResponse)
async def ai_chat(
    chat_request: ChatRequest,
    db: Session = Depends(get_db)
):
    """
    AI聊天接口 - 用户发送消息并获得AI回复
    """
    # 检查会话是否存在
    session = db.query(ChatSession).filter(
        ChatSession.id == chat_request.session_id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="聊天会话不存在"
        )
    
    # 保存用户消息
    user_message = ChatMessage(
        session_id=chat_request.session_id,
        role="user",
        content=chat_request.message,
        message_type="text",
        message_metadata={}
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)
    
    try:
        # 获取对话历史（最近10条消息）
        recent_messages = db.query(ChatMessage).filter(
            ChatMessage.session_id == chat_request.session_id
        ).order_by(ChatMessage.created_at.desc()).limit(10).all()
        
        # 构建对话历史
        conversation_history = []
        for msg in reversed(recent_messages[1:]):  # 排除刚添加的用户消息
            conversation_history.append({
                "role": msg.role,
                "content": msg.content
            })
        
        # 获取角色信息（如果指定了character_id）
        system_prompt = None
        if chat_request.character_id:
            from app.models import Character
            character = db.query(Character).filter(
                Character.id == chat_request.character_id,
                Character.is_active == True
            ).first()
            if character and character.prompt_template:
                system_prompt = character.prompt_template
        
        # 调用DeepSeek API生成回复
        deepseek_service = get_deepseek_service()
        ai_reply = await deepseek_service.generate_reply(
            user_message=chat_request.message,
            conversation_history=conversation_history,
            system_prompt=system_prompt
        )
        
        # 保存AI回复
        ai_message = ChatMessage(
            session_id=chat_request.session_id,
            role="assistant",
            content=ai_reply,
            message_type="text",
            message_metadata={}
        )
        db.add(ai_message)
        
        # 更新会话的最后更新时间
        session.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(ai_message)
        
        return ChatResponse(
            user_message=user_message,
            ai_message=ai_message
        )
        
    except Exception as e:
        # 如果AI调用失败，回滚用户消息
        db.rollback()
        logger.error(f"AI聊天失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI回复生成失败: {str(e)}"
        )