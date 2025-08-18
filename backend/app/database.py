from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# 数据库URL配置
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://username:password@localhost/xinli_db"
)

# 如果是开发环境，可以使用SQLite
if os.getenv("ENVIRONMENT") == "development":
    DATABASE_URL = "sqlite:///./xinli_app.db"
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False}  # SQLite需要这个参数
    )
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# 数据库依赖
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()