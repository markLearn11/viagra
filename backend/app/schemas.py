from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# 用户相关模式
class UserBase(BaseModel):
    openid: Optional[str] = None
    phone: Optional[str] = None
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None

class UserCreate(UserBase):
    session_key: Optional[str] = None
    wechat_openid: Optional[str] = None

class UserResponse(UserBase):
    id: int
    wechat_openid: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    is_active: bool
    
    class Config:
        from_attributes = True

# 用户资料相关模式
class UserProfileBase(BaseModel):
    nickname: Optional[str] = None
    gender: Optional[str] = None
    birthday: Optional[str] = None
    blood_type: Optional[str] = None
    occupation: Optional[str] = None
    current_status: Optional[str] = None
    marital_status: Optional[str] = None
    has_children: Optional[str] = None
    avatar_url: Optional[str] = None
    tags: Optional[List[Dict[str, Any]]] = None
    stats: Optional[Dict[str, Any]] = None

class UserProfileCreate(UserProfileBase):
    pass

class UserProfileUpdate(UserProfileBase):
    pass

class UserProfileResponse(UserProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# 聊天相关模式
class ChatSessionBase(BaseModel):
    title: Optional[str] = None

class ChatSessionCreate(ChatSessionBase):
    pass

class ChatSessionResponse(ChatSessionBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    is_active: bool
    
    class Config:
        from_attributes = True

class ChatMessageBase(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str
    message_type: str = "text"
    message_metadata: Optional[Dict[str, Any]] = None

class ChatMessageCreate(ChatMessageBase):
    session_id: int

class ChatMessageResponse(ChatMessageBase):
    id: int
    session_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# MBTI相关模式
class MBTIAnswerBase(BaseModel):
    question_id: int
    answer: str

class MBTISubmission(BaseModel):
    answers: List[MBTIAnswerBase]

class MBTIResultResponse(BaseModel):
    id: int
    user_id: int
    result_type: str
    answers: List[Dict[str, Any]]
    scores: Dict[str, Any]
    description: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# 树洞相关模式
class TreeholePostBase(BaseModel):
    title: str = Field(..., max_length=200)
    content: str
    is_anonymous: bool = True
    mood_score: Optional[int] = Field(None, ge=1, le=10)
    tags: Optional[List[str]] = None

class TreeholePostCreate(TreeholePostBase):
    pass

class TreeholePostUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = None
    mood_score: Optional[int] = Field(None, ge=1, le=10)
    tags: Optional[List[str]] = None

class TreeholePostResponse(TreeholePostBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# 角色相关模式
class CharacterBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    personality: Optional[str] = None
    avatar_url: Optional[str] = None
    prompt_template: Optional[str] = None

class CharacterCreate(CharacterBase):
    pass

class CharacterUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    personality: Optional[str] = None
    avatar_url: Optional[str] = None
    prompt_template: Optional[str] = None
    is_active: Optional[bool] = None

class CharacterResponse(CharacterBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# 通用响应模式
class MessageResponse(BaseModel):
    message: str

class ErrorResponse(BaseModel):
    detail: str

# AI聊天相关模式
class ChatRequest(BaseModel):
    session_id: int
    message: str
    character_id: Optional[int] = None

class ChatResponse(BaseModel):
    user_message: ChatMessageResponse
    ai_message: ChatMessageResponse

# AI分析相关模式
class AnalyzeRequest(BaseModel):
    prompt: str
    flowData: Dict[str, Any]

class AnalyzeResponse(BaseModel):
    analysis: str

class TreatmentPlanRequest(BaseModel):
    prompt: str
    flowData: dict

class TodayPlanRequest(BaseModel):
    flowData: dict

class TreatmentPlanResponse(BaseModel):
    treatmentPlan: str
    created_at: Optional[datetime] = None
    plan_name: Optional[str] = None
    relationship_type: Optional[str] = None

# 智能关系分析相关模式
class RelationshipAnalysisRequest(BaseModel):
    user_input: str

class RelationshipOption(BaseModel):
    key: str
    label: str

class RelationshipAnalysisResponse(BaseModel):
    suggested_relationships: List[RelationshipOption]
    confidence: float
    reasoning: str

# 治疗计划保存相关模式
class TreatmentPlanSaveRequest(BaseModel):
    user_id: int
    plan_name: str
    plan_content: str
    flow_data: Optional[Dict[str, Any]] = None
    plan_type: str = "monthly"

class TreatmentPlanBase(BaseModel):
    plan_name: str
    plan_content: str
    flow_data: Optional[Dict[str, Any]] = None
    plan_type: str = "monthly"
    status: str = "active"

class TreatmentPlanCreate(TreatmentPlanBase):
    user_id: int

class TreatmentPlanUpdate(BaseModel):
    plan_name: Optional[str] = None
    plan_content: Optional[str] = None
    status: Optional[str] = None

class TreatmentPlanSaveResponse(TreatmentPlanBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# 本周计划达成统计响应模型
class WeeklyPlanStatsResponse(BaseModel):
    completed_count: int  # 已完成计划数
    total_count: int      # 总计划数
    completion_rate: float  # 完成率（百分比）
    week_start: str       # 本周开始日期
    week_end: str         # 本周结束日期
    plans: List[Dict[str, Any]]  # 本周的计划列表

# AI对话流式接口相关模式
class AIStreamChatRequest(BaseModel):
    message: str = Field(..., description="用户消息内容")
    session_id: Optional[int] = Field(None, description="聊天会话ID，可选")
    user_id: int = Field(..., description="用户ID")
    system_prompt: Optional[str] = Field(None, description="自定义系统提示词，可选")
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="温度参数，控制回复的随机性")
    max_tokens: Optional[int] = Field(None, ge=1, le=4000, description="最大token数")

class AIStreamChatResponse(BaseModel):
    content: str = Field(..., description="AI回复内容")
    session_id: int = Field(..., description="聊天会话ID")
    message_id: int = Field(..., description="消息ID")
    timestamp: datetime = Field(..., description="消息时间戳")

class AIStreamChunk(BaseModel):
    type: str = Field(..., description="数据类型：content, session_id, message_id, done")
    data: str = Field(..., description="数据内容")
    timestamp: Optional[datetime] = Field(None, description="时间戳")

# 今日计划相关模式
class TodayPlanItem(BaseModel):
    id: str = Field(..., description="计划项ID")
    plan_id: int = Field(..., description="所属计划ID")
    plan_name: str = Field(..., description="计划名称")
    text: str = Field(..., description="计划内容")
    completed: bool = Field(..., description="是否已完成")
    day: int = Field(..., description="天数")
    date: str = Field(..., description="日期")
    week_title: str = Field(..., description="周标题")
    week_number: int = Field(..., description="周数")

class TodayPlanResponse(BaseModel):
    success: bool = Field(..., description="请求是否成功")
    message: str = Field(..., description="响应消息")
    data: Dict[str, Any] = Field(..., description="响应数据")

class UpdatePlanStatusRequest(BaseModel):
    user_id: int = Field(..., description="用户ID")
    plan_id: int = Field(..., description="计划ID")
    date: str = Field(..., description="日期")
    day: int = Field(..., description="天数")
    completed: bool = Field(..., description="完成状态")

class UpdatePlanStatusResponse(BaseModel):
    success: bool = Field(..., description="更新是否成功")
    message: str = Field(..., description="响应消息")
    data: Dict[str, Any] = Field(..., description="更新后的数据")

# 简化版今日任务模式
class TodayTaskItem(BaseModel):
    id: str = Field(..., description="任务唯一标识")
    plan_id: int = Field(..., description="所属计划ID")
    plan_name: str = Field(..., description="计划名称")
    task_text: str = Field(..., description="任务内容")
    completed: bool = Field(..., description="是否已完成")
    day: int = Field(..., description="天数")
    date: str = Field(..., description="日期")
    week_info: Dict[str, Any] = Field(..., description="周信息")

class TodayTasksResponse(BaseModel):
    success: bool = Field(..., description="请求是否成功")
    message: str = Field(..., description="响应消息")
    data: Dict[str, Any] = Field(..., description="任务数据")

class UpdateTaskStatusResponse(BaseModel):
    success: bool = Field(..., description="更新是否成功")
    message: str = Field(..., description="响应消息")
    data: Dict[str, Any] = Field(..., description="更新结果")