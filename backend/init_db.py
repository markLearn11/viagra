#!/usr/bin/env python3
"""
数据库初始化脚本
用于创建数据库表结构和初始数据
"""

import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import DATABASE_URL, Base
from app.models import User, UserProfile, ChatSession, ChatMessage, MBTIResult, TreeholePost, Character

def create_tables():
    """
    创建所有数据库表
    """
    print("正在创建数据库表...")
    
    # 创建数据库引擎
    engine = create_engine(DATABASE_URL)
    
    # 创建所有表
    Base.metadata.create_all(bind=engine)
    
    print("数据库表创建完成！")
    
    return engine

def create_initial_data(engine):
    """
    创建初始数据
    """
    print("正在创建初始数据...")
    
    # 创建会话
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # 创建默认角色
        default_characters = [
            {
                "name": "心理咨询师",
                "description": "专业的心理咨询师，擅长倾听和提供心理支持",
                "personality": "温和、耐心、专业",
                "character_background": "拥有多年心理咨询经验，专注于情感支持和心理健康",
                "avatar_url": "/avatars/psychologist.png",
                "category": "心理健康",
                "prompt_template": "你是一位专业的心理咨询师，请以温和、耐心的态度回应用户的问题，提供专业的心理支持和建议。",
                "is_active": True,
                "usage_count": 0
            },
            {
                "name": "生活助手",
                "description": "贴心的生活助手，帮助解决日常生活问题",
                "personality": "友善、实用、贴心",
                "character_background": "熟悉各种生活技巧和实用建议",
                "avatar_url": "/avatars/assistant.png",
                "category": "生活服务",
                "prompt_template": "你是一位贴心的生活助手，请为用户提供实用的生活建议和解决方案。",
                "is_active": True,
                "usage_count": 0
            },
            {
                "name": "学习伙伴",
                "description": "陪伴学习的好伙伴，提供学习方法和动力支持",
                "personality": "积极、鼓励、有条理",
                "character_background": "擅长学习方法指导和学习动力激发",
                "avatar_url": "/avatars/study_buddy.png",
                "category": "学习教育",
                "prompt_template": "你是一位学习伙伴，请以积极鼓励的态度帮助用户解决学习问题，提供有效的学习方法。",
                "is_active": True,
                "usage_count": 0
            },
            {
                "name": "情感陪伴",
                "description": "温暖的情感陪伴者，在你需要时给予关怀",
                "personality": "温暖、理解、共情",
                "character_background": "善于倾听和情感支持，给予温暖的陪伴",
                "avatar_url": "/avatars/companion.png",
                "category": "情感支持",
                "prompt_template": "你是一位温暖的情感陪伴者，请以理解和共情的态度陪伴用户，给予情感支持。",
                "is_active": True,
                "usage_count": 0
            }
        ]
        
        # 检查是否已存在角色数据
        existing_characters = db.query(Character).count()
        if existing_characters == 0:
            for char_data in default_characters:
                character = Character(**char_data)
                db.add(character)
            
            db.commit()
            print(f"已创建 {len(default_characters)} 个默认角色")
        else:
            print(f"数据库中已存在 {existing_characters} 个角色，跳过初始化")
        
        print("初始数据创建完成！")
        
    except Exception as e:
        print(f"创建初始数据时出错: {e}")
        db.rollback()
    finally:
        db.close()

def main():
    """
    主函数
    """
    print("开始初始化数据库...")
    
    try:
        # 创建表
        engine = create_tables()
        
        # 创建初始数据
        create_initial_data(engine)
        
        print("\n数据库初始化完成！")
        print("\n接下来你可以：")
        print("1. 复制 .env.example 为 .env 并配置数据库连接")
        print("2. 运行 'uvicorn main:app --reload' 启动服务")
        
    except Exception as e:
        print(f"初始化过程中出错: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())