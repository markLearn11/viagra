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