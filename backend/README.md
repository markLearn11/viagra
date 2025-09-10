# 小程序后端服务

基于 FastAPI 构建的小程序后端服务，提供用户管理、聊天功能、MBTI测试、树洞分享等功能。

## 功能特性

- 🔐 用户认证与管理（JWT Token认证）
- 👤 用户档案管理
- 💬 智能聊天对话
- 🧠 MBTI性格测试
- 🌳 匿名树洞分享
- 🎭 AI角色管理
- 🚀 高性能异步API
- 📊 数据统计分析

## 技术栈

- **框架**: FastAPI
- **数据库**: PostgreSQL / SQLite
- **ORM**: SQLAlchemy
- **验证**: Pydantic
- **认证**: JWT
- **限流**: Redis
- **部署**: Uvicorn

## 项目结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── models.py          # 数据模型
│   ├── schemas.py         # API模式
│   ├── database.py        # 数据库配置
│   ├── utils.py           # JWT工具函数
│   ├── dependencies.py    # 依赖项
│   ├── WXBizDataCrypt.py  # 微信数据解密模块
│   ├── middleware.py      # 中间件
│   └── routers/           # 路由模块
│       ├── users.py       # 用户管理
│       ├── profiles.py    # 档案管理
│       ├── chat.py        # 聊天功能
│       ├── mbti.py        # MBTI测试
│       ├── treehole.py    # 树洞功能
│       └── characters.py  # 角色管理
├── main.py               # 应用入口
├── init_db.py           # 数据库初始化
├── requirements.txt     # 依赖包
├── .env.example        # 环境变量示例
├── AUTHENTICATION.md   # 认证系统说明
└── README.md           # 项目说明
```

## 认证系统

本系统使用JWT (JSON Web Token) 进行用户认证。详细说明请查看 [AUTHENTICATION.md](file:///Users/anzhi/viagra/backend/AUTHENTICATION.md) 文件。

## 快速开始

### 一键启动（推荐）

```bash
# 安装依赖、配置环境、初始化数据库并启动服务
pip install -r requirements.txt && cp .env.example .env && python init_db.py && python start.py
```

或者分步执行：

### 1. 环境准备

确保已安装 Python 3.8+

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 配置环境

```bash
# 复制环境变量文件
cp .env.example .env

# 编辑 .env 文件，配置数据库连接等信息
```

### 4. 初始化数据库

```bash
# 运行数据库初始化脚本
python init_db.py
```

### 5. 启动服务

#### 方式一：使用启动脚本（推荐）

```bash
# 使用启动脚本，会自动检查依赖和环境配置
python start.py
```

#### 方式二：直接使用uvicorn

```bash
# 开发模式启动
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 生产模式启动
uvicorn main:app --host 0.0.0.0 --port 8000
```

服务启动后，可以访问：
- API文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

## API 接口

### 认证接口
- `POST /api/auth/wechat-login` - 微信登录
- `POST /api/auth/login` - 手机号验证码登录
- `POST /api/auth/decrypt-phone` - 微信手机号解密登录
- `POST /api/auth/send-code` - 发送验证码

### 用户管理
- `POST /api/users/register` - 用户注册
- `GET /api/users/me` - 获取当前用户信息
- `GET /api/users/{user_id}` - 获取用户详情
- `PUT /api/users/{user_id}/deactivate` - 停用用户
- `PUT /api/users/{user_id}/activate` - 激活用户

### 档案管理
- `POST /api/profiles/` - 创建用户档案
- `GET /api/profiles/user/{user_id}` - 获取用户档案
- `PUT /api/profiles/user/{user_id}` - 更新档案
- `DELETE /api/profiles/user/{user_id}` - 删除档案

### 聊天功能
- `POST /api/chat/sessions` - 创建聊天会话
- `GET /api/chat/sessions/user/{user_id}` - 获取用户会话列表
- `GET /api/chat/sessions/{session_id}` - 获取特定会话
- `PUT /api/chat/sessions/{session_id}` - 更新会话
- `DELETE /api/chat/sessions/{session_id}` - 删除会话
- `POST /api/chat/messages` - 发送消息
- `GET /api/chat/sessions/{session_id}/messages` - 获取会话消息
- `DELETE /api/chat/messages/{message_id}` - 删除消息
- `POST /api/chat/ai-chat` - AI聊天
- `POST /api/chat/analyze` - AI分析
- `POST /api/chat/treatment` - 生成治疗计划

### MBTI测试
- `GET /api/mbti/questions` - 获取测试题目
- `POST /api/mbti/submit` - 提交测试答案
- `GET /api/mbti/results/user/{user_id}` - 获取用户测试结果
- `GET /api/mbti/results/{result_id}` - 获取特定测试结果
- `DELETE /api/mbti/results/{result_id}` - 删除测试结果

### 树洞功能
- `POST /api/treehole/posts` - 发布树洞帖子
- `GET /api/treehole/posts` - 获取公开帖子列表
- `GET /api/treehole/posts/user/{user_id}` - 获取用户帖子
- `GET /api/treehole/posts/{post_id}` - 获取特定帖子
- `PUT /api/treehole/posts/{post_id}` - 更新帖子
- `DELETE /api/treehole/posts/{post_id}` - 删除帖子
- `GET /api/treehole/stats/mood` - 获取心情统计
- `GET /api/treehole/stats/tags` - 获取标签统计

### 角色管理
- `GET /api/characters/` - 获取角色列表
- `GET /api/characters/popular` - 获取热门角色
- `GET /api/characters/{character_id}` - 获取特定角色
- `GET /api/characters/categories` - 获取角色分类
- `GET /api/characters/search/{query}` - 搜索角色
- `POST /api/characters/{character_id}/use` - 使用角色