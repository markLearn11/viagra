from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    openid = Column(String(100), unique=True, index=True, nullable=True)  # 微信小程序openid
    wechat_openid = Column(String(100), unique=True, index=True, nullable=True)  # 微信公众号openid
    phone = Column(String(20), unique=True, index=True, nullable=True)  # 手机号
    nickname = Column(String(50), nullable=True)  # 昵称
    avatar_url = Column(String(500), nullable=True)  # 头像URL
    session_key = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # 关联关系
    profile = relationship("UserProfile", back_populates="user", uselist=False)
    chat_sessions = relationship("ChatSession", back_populates="user")
    mbti_results = relationship("MBTIResult", back_populates="user")
    treehole_posts = relationship("TreeholePost", back_populates="user")
    treatment_plans = relationship("TreatmentPlan", back_populates="user")

class UserProfile(Base):
    __tablename__ = "user_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    nickname = Column(String(50))
    gender = Column(String(10))
    birthday = Column(String(20))
    blood_type = Column(String(5))
    occupation = Column(String(100))
    current_status = Column(String(100))
    marital_status = Column(String(20))
    has_children = Column(String(10))
    avatar_url = Column(String(500))
    tags = Column(JSON)  # 存储标签数组
    stats = Column(JSON)  # 存储统计信息
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联关系
    user = relationship("User", back_populates="profile")

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # 关联关系
    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"))
    role = Column(String(20))  # 'user' 或 'assistant'
    content = Column(Text)
    message_type = Column(String(20), default="text")  # text, image, audio等
    message_metadata = Column(JSON)  # 存储额外信息
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关联关系
    session = relationship("ChatSession", back_populates="messages")

class MBTIResult(Base):
    __tablename__ = "mbti_results"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    result_type = Column(String(10))  # 如 INFP, ENFJ 等
    answers = Column(JSON)  # 存储答题结果
    scores = Column(JSON)  # 存储各维度得分
    description = Column(Text)  # 结果描述
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关联关系
    user = relationship("User", back_populates="mbti_results")

class TreeholePost(Base):
    __tablename__ = "treehole_posts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(200))
    content = Column(Text)
    is_anonymous = Column(Boolean, default=True)
    mood_score = Column(Integer)  # 心情评分 1-10
    tags = Column(JSON)  # 标签
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联关系
    user = relationship("User", back_populates="treehole_posts")

class TreatmentPlan(Base):
    __tablename__ = "treatment_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    plan_name = Column(String(200), nullable=False)  # 计划名称
    plan_content = Column(Text, nullable=False)  # 计划内容（JSON格式或文本）
    flow_data = Column(JSON)  # 生成计划时的流程数据
    plan_type = Column(String(50), default="monthly")  # 计划类型：monthly, weekly等
    status = Column(String(20), default="active")  # 状态：active, completed, paused
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联关系
    user = relationship("User", back_populates="treatment_plans")

class Character(Base):
    __tablename__ = "characters"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    personality = Column(Text)
    character_background = Column(Text)
    avatar_url = Column(String(500))
    category = Column(String(50))
    prompt_template = Column(Text)  # AI对话的提示词模板
    usage_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)