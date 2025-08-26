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
    ChatResponse,
    AnalyzeRequest,
    AnalyzeResponse,
    TreatmentPlanRequest,
    TreatmentPlanResponse
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

# AI分析接口
@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_user_info(
    analyze_request: AnalyzeRequest
):
    """
    AI分析接口 - 分析用户提供的心理咨询信息
    """
    try:
        # 获取DeepSeek服务
        deepseek_service = get_deepseek_service()
        
        # 构建专业的心理分析提示词
        system_prompt = """
你是一位专业的心理咨询师，具有丰富的心理学知识和咨询经验。
请基于用户提供的信息，进行客观、专业的心理分析。
分析应该包括：
1. 情感状态分析
2. 问题的可能原因
3. 关系动态分析
4. 建设性的见解

请用温和、专业的语调回复，避免过于直接的判断，多提供理解和支持。
分析长度控制在200-300字之间。
        """
        
        # 调用AI生成分析
        analysis = await deepseek_service.generate_reply(
            user_message=analyze_request.prompt,
            system_prompt=system_prompt
        )
        
        return AnalyzeResponse(analysis=analysis)
        
    except Exception as e:
        logger.error(f"AI分析失败: {str(e)}", exc_info=True)
        # 返回默认分析内容，而不是抛出异常
        return AnalyzeResponse(
            analysis="感谢你对我的信任。基于你分享的情况，我能感受到你正在经历一些情感上的困扰。每个人在人际关系中都会遇到挑战，这是很正常的。重要的是要学会理解自己的感受，同时也尝试从不同角度看待问题。建议你可以多与信任的朋友交流，或者寻求专业的心理咨询帮助。记住，寻求帮助是勇敢的表现，你值得被理解和支持。"
        )

from fastapi.responses import StreamingResponse
import json

@router.post("/treatment", response_model=TreatmentPlanResponse)
async def create_treatment_plan(
    treatment_request: TreatmentPlanRequest
):
    """
    为用户制定个性化治疗计划
    """
    try:
        deepseek_service = get_deepseek_service()
        
        # 构建专业的治疗计划提示词，要求返回列表格式
        system_prompt = """
你是一位资深的心理咨询师和治疗师，拥有多年的临床经验和专业资质。请基于用户提供的详细心理咨询信息，为其制定一个个性化、科学、实用的1个月心理治疗计划。

请严格按照以下JSON格式返回治疗计划，每个阶段包含具体的实践项目列表：

{
  "weeks": [
    {
      "week": 1,
      "title": "情绪认知与接纳",
      "items": [
        "具体的情绪识别和记录方法",
        "针对性的放松技巧和正念练习",
        "建立健康的日常作息建议"
      ]
    },
    {
      "week": 2,
      "title": "认知重构与思维调整",
      "items": [
        "识别和挑战负面思维模式的具体方法",
        "培养积极思维的实践练习",
        "提升自我觉察能力的技巧"
      ]
    },
    {
      "week": 3,
      "title": "行为改变与技能提升",
      "items": [
        "针对具体问题的行为干预策略",
        "人际沟通技巧的实践方法",
        "压力管理和情绪调节技能"
      ]
    },
    {
      "week": 4,
      "title": "整合巩固与未来规划",
      "items": [
        "总结前三周的成果和经验",
        "制定长期的心理健康维护计划",
        "预防复发的策略和应对方案"
      ]
    }
  ],
  "dailyPractice": [
    "提供具体的每日任务清单",
    "包含可量化的目标和评估标准",
    "给出鼓励性的话语和坚持的动力"
  ]
}

请确保：
1. 根据用户的具体情况进行个性化调整
2. 使用温暖、专业、易懂的语言
3. 提供具体可操作的建议
4. 严格按照JSON格式返回，不要包含其他文字
        """
        
        # 调用 DeepSeek API
        treatment_plan = await deepseek_service.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": treatment_request.prompt}
            ],
            max_tokens=2000,
            temperature=0.7
        )
        
        return TreatmentPlanResponse(treatmentPlan=treatment_plan)
        
    except Exception as e:
        logger.error(f"治疗计划生成失败: {str(e)}", exc_info=True)
        # 如果AI生成失败，返回错误信息而不是默认内容
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="治疗计划生成服务暂时不可用，请稍后重试"
        )

@router.post("/treatment-stream")
async def create_treatment_plan_stream(
    treatment_request: TreatmentPlanRequest
):
    """
    为用户制定个性化治疗计划 - 流式响应版本
    """
    try:
        deepseek_service = get_deepseek_service()
        
        # 构建专业的治疗计划提示词，要求返回列表格式
        system_prompt = """
你是一位资深的心理咨询师和治疗师，拥有多年的临床经验和专业资质。请基于用户提供的详细心理咨询信息，为其制定一个个性化、科学、实用的1个月心理治疗计划。

请严格按照以下JSON格式返回治疗计划，每个阶段包含具体的实践项目列表：

{
  "weeks": [
    {
      "week": 1,
      "title": "情绪认知与接纳",
      "items": [
        "具体的情绪识别和记录方法",
        "针对性的放松技巧和正念练习",
        "建立健康的日常作息建议"
      ]
    },
    {
      "week": 2,
      "title": "认知重构与思维调整",
      "items": [
        "识别和挑战负面思维模式的具体方法",
        "培养积极思维的实践练习",
        "提升自我觉察能力的技巧"
      ]
    },
    {
      "week": 3,
      "title": "行为改变与技能提升",
      "items": [
        "针对具体问题的行为干预策略",
        "人际沟通技巧的实践方法",
        "压力管理和情绪调节技能"
      ]
    },
    {
      "week": 4,
      "title": "整合巩固与未来规划",
      "items": [
        "总结前三周的成果和经验",
        "制定长期的心理健康维护计划",
        "预防复发的策略和应对方案"
      ]
    }
  ],
  "dailyPractice": [
    "提供具体的每日任务清单",
    "包含可量化的目标和评估标准",
    "给出鼓励性的话语和坚持的动力"
  ]
}

请确保：
1. 根据用户的具体情况进行个性化调整
2. 使用温暖、专业、易懂的语言
3. 提供具体可操作的建议
4. 严格按照JSON格式返回，不要包含其他文字
        """
        
        async def generate_stream():
            try:
                response = deepseek_service.client.chat.completions.create(
                    model=deepseek_service.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": treatment_request.prompt}
                    ],
                    max_tokens=2000,
                    temperature=0.7,
                    stream=True
                )
                
                for chunk in response:
                    if chunk.choices[0].delta.content:
                        content = chunk.choices[0].delta.content
                        # 发送流式数据，格式为 data: {content}\n\n
                        yield f"data: {json.dumps({'content': content})}\n\n"
                
                # 发送结束标记
                yield "data: [DONE]\n\n"
                
            except Exception as e:
                logger.error(f"流式治疗计划生成失败: {str(e)}", exc_info=True)
                yield f"data: {json.dumps({'error': '治疗计划生成失败'})}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            }
        )
        
    except Exception as e:
        logger.error(f"治疗计划流式生成失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="治疗计划生成服务暂时不可用，请稍后重试"
        )