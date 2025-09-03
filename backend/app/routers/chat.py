from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
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
    RelationshipOption,
    TodayPlanRequest
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
        
        # 获取当前日期并生成未来28天的日期
        today = datetime.now().date()
        dates = [(today + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(28)]
        
        # 构建个性化的治疗计划提示词，强调根据用户具体情况生成不同内容
        system_prompt = f"""
你是一位资深的心理咨询师和治疗师，拥有多年的临床经验和专业资质。请仔细分析用户提供的详细心理咨询信息，深入理解他们的具体问题、情感状态、生活背景和个人特点，为其制定一个完全个性化、科学、实用的1个月心理治疗计划。

**重要要求：**
- 必须根据用户的具体情况、问题类型、严重程度、生活环境等因素来定制内容
- 避免使用通用模板，每个治疗计划都应该是独特的
- 针对用户的具体问题提供精准的解决方案
- 考虑用户的年龄、职业、家庭状况、性格特点等个人因素
- 每周必须包含7天的具体安排，对应一周的每一天
- 每天都要有具体的日期和对应的治疗活动

请严格按照以下JSON格式返回治疗计划：

{{
  "weeks": [
    {{
      "week": 1,
      "title": "[根据用户具体问题定制的第一周主题]",
      "description": "[针对用户情况的详细说明]",
      "items": [
        {{
          "day": 1,
          "date": "{dates[0]}",
          "text": "[第1天针对用户具体问题的专门方法]",
          "completed": false
        }},
        {{
          "day": 2,
          "date": "{dates[1]}",
          "text": "[第2天结合用户生活环境的实践建议]",
          "completed": false
        }},
        {{
          "day": 3,
          "date": "{dates[2]}",
          "text": "[第3天考虑用户个人特点的具体策略]",
          "completed": false
        }},
        {{
          "day": 4,
          "date": "{dates[3]}",
          "text": "[第4天适合用户情况的日常练习]",
          "completed": false
        }},
        {{
          "day": 5,
          "date": "{dates[4]}",
          "text": "[第5天针对用户工作压力的缓解方法]",
          "completed": false
        }},
        {{
          "day": 6,
          "date": "{dates[5]}",
          "text": "[第6天适合用户的周末放松活动]",
          "completed": false
        }},
        {{
          "day": 7,
          "date": "{dates[6]}",
          "text": "[第7天本周总结和下周准备]",
          "completed": false
        }}
      ]
    }},
    {{
      "week": 2,
      "title": "[基于第一周进展的第二周主题]",
      "description": "[深入分析用户核心问题的说明]",
      "items": [
        {{
          "day": 1,
          "date": "{dates[7]}",
          "text": "[第8天针对用户认知模式的具体干预]",
          "completed": false
        }},
        {{
          "day": 2,
          "date": "{dates[8]}",
          "text": "[第9天结合用户人际关系的改善方法]",
          "completed": false
        }},
        {{
          "day": 3,
          "date": "{dates[9]}",
          "text": "[第10天适合用户性格的思维训练]",
          "completed": false
        }},
        {{
          "day": 4,
          "date": "{dates[10]}",
          "text": "[第11天考虑用户工作生活的平衡策略]",
          "completed": false
        }},
        {{
          "day": 5,
          "date": "{dates[11]}",
          "text": "[第12天深化情绪管理技能]",
          "completed": false
        }},
        {{
          "day": 6,
          "date": "{dates[12]}",
          "text": "[第13天社交技能提升练习]",
          "completed": false
        }},
        {{
          "day": 7,
          "date": "{dates[13]}",
          "text": "[第14天第二周成果巩固]",
          "completed": false
        }}
      ]
    }},
    {{
      "week": 3,
      "title": "[针对用户行为改变的第三周主题]",
      "description": "[结合用户具体行为模式的分析]",
      "items": [
        {{
          "day": 1,
          "date": "{dates[14]}",
          "text": "[第15天针对用户具体行为问题的干预]",
          "completed": false
        }},
        {{
          "day": 2,
          "date": "{dates[15]}",
          "text": "[第16天适合用户社交环境的技能训练]",
          "completed": false
        }},
        {{
          "day": 3,
          "date": "{dates[16]}",
          "text": "[第17天结合用户压力源的管理方法]",
          "completed": false
        }},
        {{
          "day": 4,
          "date": "{dates[17]}",
          "text": "[第18天考虑用户兴趣爱好的积极活动]",
          "completed": false
        }},
        {{
          "day": 5,
          "date": "{dates[18]}",
          "text": "[第19天行为习惯改变实践]",
          "completed": false
        }},
        {{
          "day": 6,
          "date": "{dates[19]}",
          "text": "[第20天自我激励系统建立]",
          "completed": false
        }},
        {{
          "day": 7,
          "date": "{dates[20]}",
          "text": "[第21天第三周行为改变总结]",
          "completed": false
        }}
      ]
    }},
    {{
      "week": 4,
      "title": "[整合用户个人成长的第四周主题]",
      "description": "[基于用户整体情况的巩固计划]",
      "items": [
        {{
          "day": 1,
          "date": "{dates[21]}",
          "text": "[第22天总结用户个人成长的具体成果]",
          "completed": false
        }},
        {{
          "day": 2,
          "date": "{dates[22]}",
          "text": "[第23天制定符合用户生活方式的长期计划]",
          "completed": false
        }},
        {{
          "day": 3,
          "date": "{dates[23]}",
          "text": "[第24天针对用户易复发点的预防策略]",
          "completed": false
        }},
        {{
          "day": 4,
          "date": "{dates[24]}",
          "text": "[第25天建立用户个人支持系统的方法]",
          "completed": false
        }},
        {{
          "day": 5,
          "date": "{dates[25]}",
          "text": "[第26天未来挑战应对策略]",
          "completed": false
        }},
        {{
          "day": 6,
          "date": "{dates[26]}",
          "text": "[第27天持续成长计划制定]",
          "completed": false
        }},
        {{
          "day": 7,
          "date": "{dates[27]}",
          "text": "[第28天整个月治疗计划总结和庆祝]",
          "completed": false
        }}
      ]
    }}
  ],
  "dailyPractice": [
    "[结合用户作息时间的每日任务]",
    "[适合用户能力水平的具体目标]",
    "[针对用户动机特点的鼓励方式]",
    "[考虑用户生活节奏的实践建议]"
  ]
}}

**生成原则：**
1. 深度分析用户的具体问题和背景信息
2. 避免使用通用化的建议，确保每条建议都针对用户的具体情况
3. 使用温暖、专业、易懂的语言，体现个人化关怀
4. 提供具体可操作的建议，考虑用户的实际执行能力
5. 确保治疗计划的连贯性和递进性，符合心理治疗的科学原理
6. 日期应该从今天开始计算，连续28天
7. 每天的内容都应该不同且有针对性

用户信息：{treatment_request.prompt}

请基于以上用户信息，生成完全个性化的治疗计划：
4. 严格按照JSON格式返回，不要包含其他文字
        """
        
        # 调用 DeepSeek API
        treatment_plan_raw = await deepseek_service.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": treatment_request.prompt}
            ],
            max_tokens=2000,
            temperature=0.7
        )
        
        # 清理和验证返回的JSON数据
        try:
            # 尝试提取JSON部分
            treatment_plan_text = treatment_plan_raw.strip()
            
            # 如果包含代码块标记，提取其中的JSON
            if '```json' in treatment_plan_text:
                start = treatment_plan_text.find('```json') + 7
                end = treatment_plan_text.find('```', start)
                if end != -1:
                    treatment_plan_text = treatment_plan_text[start:end].strip()
            elif '```' in treatment_plan_text:
                start = treatment_plan_text.find('```') + 3
                end = treatment_plan_text.find('```', start)
                if end != -1:
                    treatment_plan_text = treatment_plan_text[start:end].strip()
            
            # 查找JSON对象的开始和结束
            json_start = treatment_plan_text.find('{')
            json_end = treatment_plan_text.rfind('}') + 1
            
            if json_start != -1 and json_end > json_start:
                treatment_plan_text = treatment_plan_text[json_start:json_end]
            
            # 验证JSON格式
            import json
            json.loads(treatment_plan_text)
            treatment_plan = treatment_plan_text
            
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"JSON解析失败: {str(e)}, 原始数据: {treatment_plan_raw[:500]}...")
            # 如果JSON解析失败，返回原始数据但记录错误
            treatment_plan = treatment_plan_raw
        
        # 从 flowData 中提取信息
        flow_data = treatment_request.flowData or {}
        relationship_type = flow_data.get('relationshipType', '未知关系')
        
        # 生成计划名称
        current_time = datetime.now()
        plan_name = f"{relationship_type}心理治疗计划_{current_time.strftime('%Y%m%d_%H%M')}"
        
        return TreatmentPlanResponse(
            treatmentPlan=treatment_plan,
            created_at=current_time,
            plan_name=plan_name,
            relationship_type=relationship_type
        )
        
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
        
        # 构建个性化的治疗计划提示词，生成4周详细计划，每周7天，每天内容不同
        system_prompt = """
你是一位资深的心理咨询师和治疗师，拥有多年的临床经验和专业资质。请仔细分析用户提供的详细心理咨询信息，深入理解他们的具体问题、情感状态、生活背景和个人特点，为其制定一个完全个性化、科学、实用的4周心理治疗计划。

**重要要求：**
- 必须根据用户的具体情况、问题类型、严重程度、生活环境等因素来定制内容
- 避免使用通用模板，每个治疗计划都应该是独特的
- 针对用户的具体问题提供精准的解决方案
- 考虑用户的年龄、职业、家庭状况、性格特点等个人因素
- 确保4周内容各不相同，具有递进性和连贯性
- 每周包含7天，每天的内容都必须不同且丰富
- 每天至少包含3-5个具体的治疗活动或练习

请严格按照以下JSON格式返回治疗计划：

{
  "weeks": [
    {
      "week": 1,
      "title": "第一周：[根据用户具体问题定制的主题]",
      "description": "[针对用户情况的详细说明，解释本周治疗重点]",
      "days": [
        {
          "day": 1,
          "theme": "[第1天的具体主题]",
          "activities": [
            "[针对用户问题的具体活动1]",
            "[结合用户生活的实践2]",
            "[个性化的练习3]",
            "[适合的疗愈方法4]"
          ]
        },
        {
          "day": 2,
          "theme": "[第2天的具体主题]",
          "activities": [
            "[不同于第1天的活动1]",
            "[深入的练习2]",
            "[新的疗愈方法3]",
            "[进阶的实践4]"
          ]
        },
        {
          "day": 3,
          "theme": "[第3天的具体主题]",
          "activities": [
            "[第3天专属活动1]",
            "[创新的练习2]",
            "[特殊的疗愈3]",
            "[独特的实践4]"
          ]
        },
        {
          "day": 4,
          "theme": "[第4天的具体主题]",
          "activities": [
            "[第4天特色活动1]",
            "[专门的练习2]",
            "[针对性疗愈3]",
            "[定制化实践4]"
          ]
        },
        {
          "day": 5,
          "theme": "[第5天的具体主题]",
          "activities": [
            "[第5天独有活动1]",
            "[特别的练习2]",
            "[个性化疗愈3]",
            "[专属实践4]"
          ]
        },
        {
          "day": 6,
          "theme": "[第6天的具体主题]",
          "activities": [
            "[第6天专门活动1]",
            "[独特练习2]",
            "[创意疗愈3]",
            "[新颖实践4]"
          ]
        },
        {
          "day": 7,
          "theme": "[第7天的具体主题]",
          "activities": [
            "[第7天总结活动1]",
            "[回顾练习2]",
            "[巩固疗愈3]",
            "[准备下周实践4]"
          ]
        }
      ]
    },
    {
      "week": 2,
      "title": "第二周：[基于第一周进展的主题]",
      "description": "[深入分析用户核心问题的说明，本周治疗重点]",
      "days": [
        {
          "day": 1,
          "theme": "[第8天的具体主题]",
          "activities": [
            "[第二周开始的新活动1]",
            "[进阶练习2]",
            "[深度疗愈3]",
            "[强化实践4]"
          ]
        },
        {
          "day": 2,
          "theme": "[第9天的具体主题]",
          "activities": [
            "[第9天专属活动1]",
            "[认知重构练习2]",
            "[情绪调节3]",
            "[行为改变4]"
          ]
        },
        {
          "day": 3,
          "theme": "[第10天的具体主题]",
          "activities": [
            "[第10天特色活动1]",
            "[思维训练2]",
            "[压力管理3]",
            "[关系改善4]"
          ]
        },
        {
          "day": 4,
          "theme": "[第11天的具体主题]",
          "activities": [
            "[第11天独有活动1]",
            "[自我觉察练习2]",
            "[情感表达3]",
            "[沟通技巧4]"
          ]
        },
        {
          "day": 5,
          "theme": "[第12天的具体主题]",
          "activities": [
            "[第12天专门活动1]",
            "[正念练习2]",
            "[身心连接3]",
            "[能量恢复4]"
          ]
        },
        {
          "day": 6,
          "theme": "[第13天的具体主题]",
          "activities": [
            "[第13天创新活动1]",
            "[创造性表达2]",
            "[艺术疗愈3]",
            "[内在探索4]"
          ]
        },
        {
          "day": 7,
          "theme": "[第14天的具体主题]",
          "activities": [
            "[第14天总结活动1]",
            "[第二周回顾2]",
            "[成长确认3]",
            "[下周准备4]"
          ]
        }
      ]
    },
    {
      "week": 3,
      "title": "第三周：[针对用户行为改变的主题]",
      "description": "[结合用户具体行为模式的分析，本周治疗重点]",
      "days": [
        {
          "day": 1,
          "theme": "[第15天的具体主题]",
          "activities": [
            "[第三周启动活动1]",
            "[行为实验2]",
            "[习惯建立3]",
            "[目标设定4]"
          ]
        },
        {
          "day": 2,
          "theme": "[第16天的具体主题]",
          "activities": [
            "[第16天专属活动1]",
            "[社交练习2]",
            "[人际技能3]",
            "[边界设定4]"
          ]
        },
        {
          "day": 3,
          "theme": "[第17天的具体主题]",
          "activities": [
            "[第17天特色活动1]",
            "[冲突解决2]",
            "[协商技巧3]",
            "[合作能力4]"
          ]
        },
        {
          "day": 4,
          "theme": "[第18天的具体主题]",
          "activities": [
            "[第18天独有活动1]",
            "[自信建立2]",
            "[自我肯定3]",
            "[价值澄清4]"
          ]
        },
        {
          "day": 5,
          "theme": "[第19天的具体主题]",
          "activities": [
            "[第19天专门活动1]",
            "[决策练习2]",
            "[问题解决3]",
            "[创新思维4]"
          ]
        },
        {
          "day": 6,
          "theme": "[第20天的具体主题]",
          "activities": [
            "[第20天创新活动1]",
            "[生活平衡2]",
            "[时间管理3]",
            "[优先级设定4]"
          ]
        },
        {
          "day": 7,
          "theme": "[第21天的具体主题]",
          "activities": [
            "[第21天总结活动1]",
            "[第三周回顾2]",
            "[行为改变确认3]",
            "[最后一周准备4]"
          ]
        }
      ]
    },
    {
      "week": 4,
      "title": "第四周：[整合巩固与未来规划]",
      "description": "[基于用户整体情况的巩固计划，本周治疗重点]",
      "days": [
        {
          "day": 1,
          "theme": "[第22天的具体主题]",
          "activities": [
            "[第四周开始活动1]",
            "[整合练习2]",
            "[成果回顾3]",
            "[技能巩固4]"
          ]
        },
        {
          "day": 2,
          "theme": "[第23天的具体主题]",
          "activities": [
            "[第23天专属活动1]",
            "[长期规划2]",
            "[目标调整3]",
            "[资源整合4]"
          ]
        },
        {
          "day": 3,
          "theme": "[第24天的具体主题]",
          "activities": [
            "[第24天特色活动1]",
            "[支持系统建立2]",
            "[网络构建3]",
            "[关系维护4]"
          ]
        },
        {
          "day": 4,
          "theme": "[第25天的具体主题]",
          "activities": [
            "[第25天独有活动1]",
            "[预防复发2]",
            "[应对策略3]",
            "[危机管理4]"
          ]
        },
        {
          "day": 5,
          "theme": "[第26天的具体主题]",
          "activities": [
            "[第26天专门活动1]",
            "[自我监测2]",
            "[持续改进3]",
            "[成长记录4]"
          ]
        },
        {
          "day": 6,
          "theme": "[第27天的具体主题]",
          "activities": [
            "[第27天创新活动1]",
            "[感恩练习2]",
            "[成就庆祝3]",
            "[未来展望4]"
          ]
        },
        {
          "day": 7,
          "theme": "[第28天的具体主题]",
          "activities": [
            "[第28天完结活动1]",
            "[全程总结2]",
            "[成长确认3]",
            "[新开始准备4]"
          ]
        }
      ]
    }
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
                    max_tokens=3000,
                    temperature=0.9,
                    top_p=0.95,
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

@router.post("/today-plan-detailed")
async def create_today_plan_detailed(
    today_plan_request: TodayPlanRequest
):
    """生成今日详细疗愈计划（流式版本）"""
    try:
        deepseek_service = get_deepseek_service()
        
        # 从flowData中提取用户信息
        flow_data = today_plan_request.flowData
        age = flow_data.get('age', '未知')
        gender = flow_data.get('gender', '未知')
        occupation = flow_data.get('occupation', '未知')
        emotional_state = flow_data.get('emotional_state', '未知')
        main_concerns = flow_data.get('main_concerns', '未知')
        desired_improvements = flow_data.get('desired_improvements', '未知')
        
        # 构建今日计划的提示词
        prompt = f"""
你是一位专业的心理健康顾问。请根据用户的情况，为今天制定一个详细的疗愈计划。

用户信息：
- 年龄：{age}
- 性别：{gender}
- 职业：{occupation}
- 情感状态：{emotional_state}
- 主要困扰：{main_concerns}
- 期望改善：{desired_improvements}

请生成一个今日疗愈计划，包含以下结构：
1. 晨间疗愈（早上的练习和任务）
2. 午间调节（中午的放松和调整）
3. 晚间总结（晚上的反思和准备）

请以清晰的文本格式返回，每个时段包含具体的任务和练习建议。
"""
        
        async def generate_stream():
            try:
                async for chunk in deepseek_service.chat_completion_stream(
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=2000
                ):
                    if chunk:
                        yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
                        
                yield "data: [DONE]\n\n"
                
            except Exception as e:
                logger.error(f"流式生成今日疗愈计划失败: {str(e)}", exc_info=True)
                yield f"data: {json.dumps({'error': '生成失败，请稍后重试'}, ensure_ascii=False)}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/plain; charset=utf-8",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "*"
            }
        )
        
    except Exception as e:
        logger.error(f"创建今日疗愈计划流失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="生成今日疗愈计划失败，请稍后重试"
        )


@router.get("/get-today-top-plans")
async def get_today_top_plans(
    user_id: int,
    db: Session = Depends(get_db)
):
    """获取当天前三个治疗计划"""
    try:
        # 获取当前日期
        today = datetime.now().date()
        
        # 查询当天的治疗计划，按创建时间排序，取前3个
        plans = db.query(TreatmentPlan).filter(
            TreatmentPlan.user_id == user_id,
            TreatmentPlan.plan_type == "daily",
            TreatmentPlan.created_at >= today,
            TreatmentPlan.created_at < today + timedelta(days=1)
        ).order_by(TreatmentPlan.created_at.asc()).limit(3).all()
        
        # 如果没有找到计划，返回默认计划
        if not plans:
            default_plans = [
                {
                    "id": "default_1",
                    "text": "培养一个兴趣爱好，坚持每日打卡这个兴趣",
                    "completed": False
                },
                {
                    "id": "default_2", 
                    "text": "分散注意力，不让自己被情绪左右",
                    "completed": False
                },
                {
                    "id": "default_3",
                    "text": "保持沟通，避免陷入自我怀疑",
                    "completed": False
                }
            ]
            return {
                "success": True,
                "data": default_plans,
                "message": "返回默认计划"
            }
        
        # 解析计划内容，提取前三个活动
        result_plans = []
        plan_count = 0
        
        for plan in plans:
            if plan_count >= 3:
                break
                
            try:
                # 尝试解析JSON格式的计划内容
                plan_content = json.loads(plan.plan_content)
                
                # 从不同可能的字段中提取活动
                activities = []
                
                # 检查tasks字段
                if "tasks" in plan_content and isinstance(plan_content["tasks"], list):
                    for task in plan_content["tasks"]:
                        if isinstance(task, dict) and "text" in task:
                            activities.append({
                                "id": task.get("id", len(activities) + 1),
                                "text": task["text"],
                                "completed": task.get("completed", False)
                            })
                        elif isinstance(task, str):
                            activities.append({
                                "id": len(activities) + 1,
                                "text": task,
                                "completed": False
                            })
                
                # 检查activities字段
                if "activities" in plan_content and isinstance(plan_content["activities"], list):
                    for activity in plan_content["activities"]:
                        if isinstance(activity, dict) and "name" in activity:
                            activities.append({
                                "id": len(activities) + 1,
                                "text": activity["name"],
                                "completed": False
                            })
                        elif isinstance(activity, str):
                            activities.append({
                                "id": len(activities) + 1,
                                "text": activity,
                                "completed": False
                            })
                
                # 添加找到的活动到结果中
                for activity in activities:
                    if plan_count < 3:
                        result_plans.append(activity)
                        plan_count += 1
                        
            except (json.JSONDecodeError, KeyError):
                # 如果解析失败，尝试将整个内容作为文本处理
                if plan_count < 3:
                    result_plans.append({
                        "id": plan_count + 1,
                        "text": plan.plan_content[:100] + "..." if len(plan.plan_content) > 100 else plan.plan_content,
                        "completed": False
                    })
                    plan_count += 1
        
        # 如果计划数量不足3个，用默认计划补充
        default_texts = [
            "培养一个兴趣爱好，坚持每日打卡这个兴趣",
            "分散注意力，不让自己被情绪左右", 
            "保持沟通，避免陷入自我怀疑"
        ]
        
        while len(result_plans) < 3:
            result_plans.append({
                "id": f"default_{len(result_plans) + 1}",
                "text": default_texts[len(result_plans)],
                "completed": False
            })
        
        return {
            "success": True,
            "data": result_plans[:3],  # 确保只返回前3个
            "message": "获取成功"
        }
        
    except Exception as e:
        logger.error(f"获取今日前三个计划失败: {str(e)}", exc_info=True)
        return {
            "success": False,
            "data": [],
            "message": f"获取失败: {str(e)}"
        }

@router.get("/get-treatment-plans")
async def get_treatment_plans(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    获取用户的治疗计划列表
    """
    try:
        # 检查用户是否存在
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )
        
        # 查询用户的所有治疗计划（按创建时间倒序）
        treatment_plans = db.query(TreatmentPlan).filter(
            TreatmentPlan.user_id == user_id
        ).order_by(TreatmentPlan.created_at.desc()).all()
        
        # 格式化返回数据
        plans_data = []
        for plan in treatment_plans:
            # 从flow_data中提取relationshipType
            relationship_type = "未知"
            if plan.flow_data and isinstance(plan.flow_data, dict):
                relationship_type = plan.flow_data.get('relationshipType', '未知')
            
            plans_data.append({
                "id": plan.id,
                "title": plan.plan_name,
                "date": plan.created_at.strftime("%Y-%m-%d %H:%M"),
                "relationship": relationship_type,
                "progress": plan.status,
                "created_at": plan.created_at,
                "plan_type": plan.plan_type,
                "flow_data": plan.flow_data
            })
        
        logger.info(f"获取治疗计划列表成功，用户ID: {user_id}, 计划数量: {len(plans_data)}")
        
        return {
            "total": len(plans_data),
            "plans": plans_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取治疗计划列表失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取治疗计划列表失败，请稍后重试"
        )

@router.delete("/delete-treatment-plan")
async def delete_treatment_plan(
    plan_id: int,
    db: Session = Depends(get_db)
):
    """
    删除治疗计划
    """
    try:
        # 查找治疗计划
        treatment_plan = db.query(TreatmentPlan).filter(
            TreatmentPlan.id == plan_id
        ).first()
        
        if not treatment_plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="治疗计划不存在"
            )
        
        # 删除治疗计划
        db.delete(treatment_plan)
        db.commit()
        
        logger.info(f"治疗计划删除成功: plan_id={plan_id}")
        
        return {
            "success": True,
            "message": "治疗计划删除成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"删除治疗计划失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除治疗计划失败，请稍后重试"
        )

@router.get("/get-today-plan")
async def get_today_plan(
    user_id: int,
    date: str,
    db: Session = Depends(get_db)
):
    """
    获取用户的今日疗愈计划
    """
    try:
        # 检查用户是否存在
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )
        
        # 查询今日计划（按创建时间倒序，获取最新的今日计划）
        today_plan = db.query(TreatmentPlan).filter(
            TreatmentPlan.user_id == user_id,
            TreatmentPlan.plan_type == "daily"
        ).order_by(TreatmentPlan.created_at.desc()).first()
        
        if not today_plan:
            return {
                "message": "未找到今日计划",
                "plan_content": None,
                "plan_name": None
            }
        
        logger.info(f"获取今日计划成功，用户ID: {user_id}, 计划ID: {today_plan.id}")
        
        return {
            "plan_content": today_plan.plan_content,
            "plan_name": today_plan.plan_name,
            "created_at": today_plan.created_at,
            "flow_data": today_plan.flow_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取今日计划失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取今日计划失败，请稍后重试"
        )

@router.delete("/delete-today-plan")
async def delete_today_plan(
    user_id: int,
    date: str = None,
    db: Session = Depends(get_db)
):
    """
    删除用户的今日疗愈计划
    """
    try:
        # 检查用户是否存在
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )
        
        # 查询要删除的今日计划
        query = db.query(TreatmentPlan).filter(
            TreatmentPlan.user_id == user_id,
            TreatmentPlan.plan_type == "daily"
        )
        
        # 如果指定了日期，可以根据创建时间进行筛选（这里简化处理，删除所有daily类型的计划）
        today_plans = query.all()
        
        if not today_plans:
            return {
                "message": "未找到要删除的今日计划",
                "deleted_count": 0
            }
        
        # 删除找到的计划
        deleted_count = 0
        for plan in today_plans:
            db.delete(plan)
            deleted_count += 1
        
        db.commit()
        
        logger.info(f"删除今日计划成功，用户ID: {user_id}, 删除数量: {deleted_count}")
        
        return {
            "message": f"成功删除 {deleted_count} 个今日计划",
            "deleted_count": deleted_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除今日计划失败: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除今日计划失败，请稍后重试"
        )

@router.post("/save-today-plan", response_model=TreatmentPlanSaveResponse)
async def save_today_plan(
    save_request: TreatmentPlanSaveRequest,
    db: Session = Depends(get_db)
):
    """
    保存用户的今日疗愈计划
    """
    try:
        # 检查用户是否存在
        user = db.query(User).filter(User.id == save_request.user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )
        
        # 创建今日计划记录
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
        
        logger.info(f"今日计划保存成功，用户ID: {save_request.user_id}, 计划ID: {treatment_plan.id}")
        
        return treatment_plan
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"保存今日计划失败: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="保存今日计划失败，请稍后重试"
        )

@router.post("/today-plan-detailed-stream")
async def create_today_plan_detailed_stream(
    treatment_request: TreatmentPlanRequest
):
    """生成今日详细疗愈计划（流式版本）"""
    try:
        deepseek_service = get_deepseek_service()
        
        # 获取当前日期
        today = datetime.now().date().strftime("%Y-%m-%d")
        
        # 从flowData中提取用户信息
        flow_data = treatment_request.flowData
        age = flow_data.get('age', '未知')
        gender = flow_data.get('gender', '未知')
        occupation = flow_data.get('occupation', '未知')
        emotional_state = flow_data.get('emotional_state', '未知')
        main_concerns = flow_data.get('main_concerns', '未知')
        desired_improvements = flow_data.get('desired_improvements', '未知')
        
        # 构建今日计划的提示词
        prompt = f"""
你是一位专业的心理健康顾问。请根据用户的情况，为今天制定一个详细的疗愈计划。

用户信息：
- 年龄：{age}
- 性别：{gender}
- 职业：{occupation}
- 情感状态：{emotional_state}
- 主要困扰：{main_concerns}
- 期望改善：{desired_improvements}

请生成一个今日疗愈计划，包含以下结构：
1. 今日主题（与用户情况相关的疗愈主题）
2. 具体任务清单（3-5个可执行的任务）
3. 每日练习（冥想、呼吸练习等）

请以JSON格式返回，结构如下：
{{
  "title": "今日疗愈主题",
  "date": "{today}",
  "theme": "今日疗愈重点",
  "tasks": [
    {{
      "id": 1,
      "text": "任务描述",
      "completed": false
    }}
  ],
  "practices": [
    {{
      "title": "练习名称",
      "description": "练习描述",
      "duration": "建议时长"
    }}
  ]
}}
"""
        
        async def generate_stream():
            try:
                async for chunk in deepseek_service.chat_completion_stream(
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=2000
                ):
                    if chunk:
                        yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
                        
                yield "data: [DONE]\n\n"
                
            except Exception as e:
                logger.error(f"流式生成今日疗愈计划失败: {str(e)}", exc_info=True)
                yield f"data: {json.dumps({'error': '生成失败，请稍后重试'}, ensure_ascii=False)}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/plain; charset=utf-8",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "*"
            }
        )
        
    except Exception as e:
        logger.error(f"创建今日疗愈计划流失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="生成今日疗愈计划失败，请稍后重试"
        )