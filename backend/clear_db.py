#!/usr/bin/env python3
"""
数据库清空脚本
用于清空数据库中的所有数据或特定表的数据
"""

import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.database import DATABASE_URL, Base
from app.models import User, UserProfile, ChatSession, ChatMessage, MBTIResult, TreeholePost, Character, TreatmentPlan

def clear_all_data():
    """
    清空所有表的数据
    """
    print("正在清空所有表的数据...")
    
    # 创建数据库引擎
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # 按依赖关系顺序删除数据（避免外键约束错误）
        tables_to_clear = [
            "chat_messages",
            "chat_sessions", 
            "mbti_results",
            "treehole_posts",
            "treatment_plans",
            "user_profiles",
            "users",
            "characters"
        ]
        
        for table in tables_to_clear:
            try:
                # 使用原生SQL删除数据
                db.execute(text(f"DELETE FROM {table}"))
                print(f"✓ 已清空表: {table}")
            except Exception as e:
                print(f"⚠ 清空表 {table} 时出错: {e}")
        
        db.commit()
        print("\n✅ 所有表数据已清空！")
        
    except Exception as e:
        print(f"❌ 清空数据时出错: {e}")
        db.rollback()
        return False
    finally:
        db.close()
    
    return True

def clear_specific_tables(table_names):
    """
    清空指定表的数据
    """
    print(f"正在清空指定表的数据: {', '.join(table_names)}...")
    
    # 创建数据库引擎
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        for table in table_names:
            try:
                db.execute(text(f"DELETE FROM {table}"))
                print(f"✓ 已清空表: {table}")
            except Exception as e:
                print(f"⚠ 清空表 {table} 时出错: {e}")
        
        db.commit()
        print(f"\n✅ 指定表数据已清空！")
        
    except Exception as e:
        print(f"❌ 清空数据时出错: {e}")
        db.rollback()
        return False
    finally:
        db.close()
    
    return True

def reset_database():
    """
    重置数据库（删除所有表并重新创建）
    """
    print("正在重置数据库...")
    
    try:
        # 删除所有表
        engine = create_engine(DATABASE_URL)
        Base.metadata.drop_all(bind=engine)
        print("✓ 已删除所有表")
        
        # 重新创建所有表
        Base.metadata.create_all(bind=engine)
        print("✓ 已重新创建所有表")
        
        print("\n✅ 数据库已重置！")
        return True
        
    except Exception as e:
        print(f"❌ 重置数据库时出错: {e}")
        return False

def show_help():
    """
    显示帮助信息
    """
    print("""
数据库清空脚本使用说明：

1. 清空所有数据：
   python clear_db.py --all

2. 清空指定表：
   python clear_db.py --tables users,user_profiles,chat_sessions

3. 重置数据库（删除并重建所有表）：
   python clear_db.py --reset

4. 显示帮助：
   python clear_db.py --help

可用的表名：
- users: 用户表
- user_profiles: 用户档案表
- chat_sessions: 聊天会话表
- chat_messages: 聊天消息表
- mbti_results: MBTI测试结果表
- treehole_posts: 树洞帖子表
- treatment_plans: 疗愈计划表
- characters: 角色表
    """)

def main():
    """
    主函数
    """
    if len(sys.argv) < 2:
        show_help()
        return 1
    
    command = sys.argv[1]
    
    if command == "--help" or command == "-h":
        show_help()
        return 0
    
    elif command == "--all":
        print("⚠️  警告：这将清空所有表的数据！")
        confirm = input("确认继续吗？(y/N): ")
        if confirm.lower() != 'y':
            print("操作已取消")
            return 0
        
        if clear_all_data():
            print("\n🎉 数据库清空完成！")
            print("💡 提示：可以运行 'python init_db.py' 重新初始化数据库")
        else:
            print("\n❌ 数据库清空失败！")
            return 1
    
    elif command == "--tables":
        if len(sys.argv) < 3:
            print("❌ 请指定要清空的表名")
            show_help()
            return 1
        
        table_names = [t.strip() for t in sys.argv[2].split(',')]
        print(f"⚠️  警告：将清空表 {', '.join(table_names)} 的数据！")
        confirm = input("确认继续吗？(y/N): ")
        if confirm.lower() != 'y':
            print("操作已取消")
            return 0
        
        if clear_specific_tables(table_names):
            print("\n🎉 指定表数据清空完成！")
        else:
            print("\n❌ 表数据清空失败！")
            return 1
    
    elif command == "--reset":
        print("⚠️  警告：这将删除所有表并重新创建！")
        confirm = input("确认继续吗？(y/N): ")
        if confirm.lower() != 'y':
            print("操作已取消")
            return 0
        
        if reset_database():
            print("\n🎉 数据库重置完成！")
            print("💡 提示：可以运行 'python init_db.py' 重新初始化数据库")
        else:
            print("\n❌ 数据库重置失败！")
            return 1
    
    else:
        print(f"❌ 未知命令: {command}")
        show_help()
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
