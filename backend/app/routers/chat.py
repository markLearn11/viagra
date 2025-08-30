from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import logging
import json

from app.database import get_db
from app.models import ChatSession, ChatMessage, User, TreatmentPlan
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
    TreatmentPlanResponse,
    TreatmentPlanSaveRequest,
    TreatmentPlanSaveResponse,
    RelationshipAnalysisRequest,
    RelationshipAnalysisResponse,
    RelationshipOption
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

# AI分析接口 - 流式输出版本
@router.post("/analyze")
async def analyze_user_info_stream(
    analyze_request: AnalyzeRequest
):
    """
    AI分析接口 - 分析用户提供的心理咨询信息（真正的流式输出）
    """
    try:
        deepseek_service = get_deepseek_service()
        
        # 构建专业的心理分析提示词，限制字数
        system_prompt = """
你是一位温柔、专业的心理咨询师，具有丰富的心理学知识和咨询经验。
请基于用户提供的信息，进行温和、专业的心理分析。

重要要求：
1. 分析内容必须控制在150字以内
2. 语言要温柔、关怀、专业，充满理解和同情
3. 用温暖的语调表达对用户的理解和支持
4. 重点突出核心问题和温和的建议
5. 避免冷漠或过于学术化的表达

请用温柔关怀的语调给出分析结果，不要超过150个字符。
        """
        
        async def generate_stream():
            try:
                response = deepseek_service.client.chat.completions.create(
                    model=deepseek_service.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": analyze_request.prompt}
                    ],
                    max_tokens=200,  # 限制token数量确保不超过150字
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
                logger.error(f"流式AI分析失败: {str(e)}", exc_info=True)
                yield f"data: {json.dumps({'error': 'AI分析失败'})}\n\n"
        
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
        logger.error(f"AI分析流式生成失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI分析服务暂时不可用，请稍后重试"
        )

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

# 关系类型映射函数
def map_relationship_to_option(relationship_label: str) -> RelationshipOption:
    """将关系类型标签映射为包含key和label的对象"""
    relationship_mapping = {
        '伴侣/配偶': RelationshipOption(key='partner', label='伴侣/配偶'),
        '爸爸': RelationshipOption(key='father', label='爸爸'),
        '妈妈': RelationshipOption(key='mother', label='妈妈'),
        '朋友': RelationshipOption(key='friend', label='朋友'),
        '同事': RelationshipOption(key='colleague', label='同事'),
        '同学': RelationshipOption(key='classmate', label='同学'),
        '其他亲密关系': RelationshipOption(key='other', label='其他亲密关系')
    }
    return relationship_mapping.get(relationship_label, RelationshipOption(key='other', label=relationship_label))

# 智能关系分析接口
@router.post("/relationship-analysis", response_model=RelationshipAnalysisResponse)
async def analyze_relationship(
    request: RelationshipAnalysisRequest
):
    """
    AI智能关系分析接口 - 根据用户输入智能推荐相关的关系类型
    """
    try:
        deepseek_service = get_deepseek_service()
        
        # 构建智能关系分析提示词
        system_prompt = """
你是一个专业的心理咨询助手，需要根据用户的输入智能分析可能涉及的人际关系类型。

可选的关系类型包括：
- 伴侣/配偶（包括男朋友、女朋友、老公、老婆、恋人等）
- 爸爸（包括父亲、爸爸等）
- 妈妈（包括母亲、妈妈等）
- 朋友（包括好友、闺蜜、兄弟等）
- 同事（包括同事、领导、老板等）
- 同学（包括同学、室友、学长学姐等）
- 其他亲密关系（包括亲戚、邻居等其他关系）

分析规则：
1. 如果用户明确提到具体关系（如"我男朋友"、"我妈妈"），返回单一明确关系
2. 如果用户使用模糊表述（如"我分手了"、"我们吵架了"），返回多个可能的关系选项
3. 如果完全无法判断涉及他人关系，返回空数组

请以JSON格式返回：
- 明确关系：{"relationship": "具体关系", "confidence": 0.9, "reasoning": "分析原因"}
- 模糊关系：{"suggestions": ["关系1", "关系2"], "confidence": 0.6, "reasoning": "分析原因"}
- 无关系：{"suggestions": [], "confidence": 0.0, "reasoning": "分析原因"}

注意：reasoning要简洁说明判断依据
        """
        
        # 调用AI进行关系分析
        analysis_result = await deepseek_service.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.user_input}
            ],
            temperature=0.1,
            max_tokens=200
        )
        
        # 解析AI返回的JSON结果
        import json
        try:
            result = json.loads(analysis_result)
            
            # 处理明确关系的情况
            if "relationship" in result:
                relationship_option = map_relationship_to_option(result["relationship"])
                return RelationshipAnalysisResponse(
                    suggested_relationships=[relationship_option],
                    confidence=result.get("confidence", 0.0),
                    reasoning=result.get("reasoning", "AI分析完成")
                )
            # 处理建议关系的情况
            else:
                suggestions = result.get("suggestions", [])
                relationship_options = [map_relationship_to_option(rel) for rel in suggestions]
                return RelationshipAnalysisResponse(
                    suggested_relationships=relationship_options,
                    confidence=result.get("confidence", 0.0),
                    reasoning=result.get("reasoning", "AI分析完成")
                )
        except json.JSONDecodeError:
            # 如果JSON解析失败，返回默认结果
            return RelationshipAnalysisResponse(
                suggested_relationships=[],
                confidence=0.0,
                reasoning="无法确定具体关系类型"
            )
        
    except Exception as e:
        logger.error(f"智能关系分析失败: {str(e)}", exc_info=True)
        # 返回默认结果而不是抛出异常
        return RelationshipAnalysisResponse(
            suggested_relationships=[],
            confidence=0.0,
            reasoning="分析服务暂时不可用"
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


# AI总结生成接口
@router.post("/ai-summary")
async def generate_ai_summary(
    request: dict
):
    """
    生成AI总结 - 根据用户输入生成简洁的总结
    """
    try:
        # 获取用户输入数据
        problem_description = request.get('problemDescription', '')
        relationship_type = request.get('relationshipType', '')
        incident_process = request.get('incidentProcess', '')
        additional_info = request.get('additionalInfo', '')
        
        # 构建提示词
        prompt = f"""
请根据以下信息生成一个简洁的总结，每项内容不超过15个字符：

问题描述：{problem_description}
关系类型：{relationship_type}
事件经过：{incident_process}
补充信息：{additional_info}

请以JSON格式返回，包含以下字段：
{{
    "problemSummary": "问题描述的简洁总结（不超过15字符）",
    "relationshipSummary": "关系类型的简洁总结（不超过15字符）",
    "incidentSummary": "事件经过的简洁总结（不超过15字符）",
    "additionalSummary": "补充信息的简洁总结（不超过15字符，如果没有补充信息则返回'无'）"
}}

要求：
1. 每个总结都要简洁明了，突出关键信息
2. 严格控制字符数量，不超过15个字符
3. 如果某项信息为空，对应的总结字段返回"无"
4. 只返回JSON格式，不要其他内容
"""
        
        # 调用DeepSeek API生成总结
        deepseek_service = get_deepseek_service()
        ai_response = await deepseek_service.generate_reply(
            user_message=prompt,
            conversation_history=[],
            system_prompt="你是一个专业的文本总结助手，擅长将复杂信息简化为简洁明了的总结。"
        )
        
        # 尝试解析JSON响应
        try:
            import json
            summary_data = json.loads(ai_response.strip())
            return summary_data
        except json.JSONDecodeError:
            # 如果解析失败，返回默认总结
            logger.warning(f"AI总结响应解析失败: {ai_response}")
            return {
                "problemSummary": problem_description[:15] if problem_description else "无",
                "relationshipSummary": relationship_type[:15] if relationship_type else "无",
                "incidentSummary": incident_process[:15] if incident_process else "无",
                "additionalSummary": additional_info[:15] if additional_info else "无"
            }
        
    except Exception as e:
        logger.error(f"AI总结生成失败: {str(e)}", exc_info=True)
        # 返回降级总结
        return {
            "problemSummary": request.get('problemDescription', '')[:15] if request.get('problemDescription') else "无",
            "relationshipSummary": request.get('relationshipType', '')[:15] if request.get('relationshipType') else "无",
            "incidentSummary": request.get('incidentProcess', '')[:15] if request.get('incidentProcess') else "无",
            "additionalSummary": request.get('additionalInfo', '')[:15] if request.get('additionalInfo') else "无"
        }

@router.post("/save-treatment-plan", response_model=TreatmentPlanSaveResponse)
async def save_treatment_plan(
    save_request: TreatmentPlanSaveRequest,
    db: Session = Depends(get_db)
):
    """
    保存用户的治疗计划
    """
    try:
        # 检查用户是否存在
        user = db.query(User).filter(User.id == save_request.user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )
        
        # 创建治疗计划记录
        treatment_plan = TreatmentPlan(
            user_id=save_request.user_id,
            plan_name=save_request.plan_name,
            plan_content=save_request.plan_content,
            flow_data=save_request.flow_data,
            plan_type=save_request.plan_type
        )
        
        db.add(treatment_plan)
        db.commit()
        db.refresh(treatment_plan)
        
        logger.info(f"治疗计划保存成功，用户ID: {save_request.user_id}, 计划ID: {treatment_plan.id}")
        
        return treatment_plan
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"保存治疗计划失败: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="保存治疗计划失败，请稍后重试"
        )