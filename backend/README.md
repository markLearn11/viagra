# 小程序后端服务

基于 FastAPI 构建的小程序后端服务，提供用户管理、聊天功能、MBTI测试、树洞分享等功能。

## 功能特性

- 🔐 用户认证与管理
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
└── README.md           # 项目说明
```

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

### 用户管理
- `POST /api/users/register` - 用户注册
- `GET /api/users/me` - 获取当前用户信息
- `GET /api/users/{user_id}` - 获取用户详情
- `PUT /api/users/{user_id}/deactivate` - 停用用户
- `DELETE /api/users/{user_id}` - 删除用户

### 档案管理
- `POST /api/profiles/` - 创建用户档案
- `GET /api/profiles/user/{user_id}` - 获取用户档案
- `PUT /api/profiles/{profile_id}` - 更新档案
- `DELETE /api/profiles/{profile_id}` - 删除档案

### 聊天功能
- `POST /api/chat/sessions` - 创建聊天会话
- `GET /api/chat/sessions/user/{user_id}` - 获取用户会话列表
- `POST /api/chat/messages` - 发送消息
- `GET /api/chat/sessions/{session_id}/messages` - 获取会话消息
- `GET /api/chat/get-today-tasks` - 获取今日任务（简化版，无需AI）
- `PUT /api/chat/update-task-status` - 更新任务完成状态
- `GET /api/chat/get-today-plan` - 获取今日疗愈计划（完整版）
- `PUT /api/chat/update-plan-status` - 更新计划完成状态
- `POST /api/chat/save-today-plan` - 保存今日计划
- `DELETE /api/chat/delete-today-plan` - 删除今日计划

### MBTI测试
- `GET /api/mbti/questions` - 获取测试题目
- `POST /api/mbti/submit` - 提交测试答案
- `GET /api/mbti/results/user/{user_id}` - 获取用户测试结果

### 树洞功能
- `POST /api/treehole/posts` - 发布树洞帖子
- `GET /api/treehole/posts` - 获取公开帖子列表
- `GET /api/treehole/stats/mood` - 获取心情统计

### 角色管理
- `GET /api/characters/` - 获取角色列表
- `GET /api/characters/popular` - 获取热门角色
- `POST /api/characters/{character_id}/use` - 使用角色

## 微信数据解密

项目使用 [WXBizDataCrypt](file:///Users/anzhi/viagra/backend/app/routers/auth.py#L155-L169) 模块来解密微信小程序的加密数据，如手机号等敏感信息。

详细使用说明请参考 [WXBizDataCrypt_README.md](WXBizDataCrypt_README.md)

## 数据库模型

### 用户表 (User)
- 用户基本信息
- 微信openid
- 会话密钥
- 创建/更新时间

### 用户档案表 (UserProfile)
- 个人详细信息
- 昵称、头像、生日等
- 关联用户表

### 聊天会话表 (ChatSession)
- 会话信息
- 关联用户和角色
- 会话标题和状态

### 聊天消息表 (ChatMessage)
- 消息内容
- 发送者类型
- 关联会话

### MBTI结果表 (MBTIResult)
- 测试结果
- 各维度得分
- 关联用户

### 树洞帖子表 (TreeholePost)
- 帖子内容
- 心情评分
- 匿名设置

### 角色表 (Character)
- AI角色信息
- 性格设定
- 提示模板

## 部署说明

### Docker 部署

```dockerfile
# Dockerfile 示例
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 生产环境配置

1. 使用 PostgreSQL 数据库
2. 配置 Redis 用于限流
3. 设置环境变量
4. 使用 Nginx 反向代理
5. 配置 SSL 证书

## 开发指南

### 添加新功能

1. 在 `app/models.py` 中定义数据模型
2. 在 `app/schemas.py` 中定义API模式
3. 在 `app/routers/` 中创建路由文件
4. 在 `main.py` 中注册路由

### 代码规范

- 使用 Python 类型提示
- 遵循 PEP 8 代码风格
- 编写详细的文档字符串
- 添加适当的错误处理

## 常见问题

### Q: 数据库连接失败
A: 检查 `.env` 文件中的数据库配置，确保数据库服务正在运行。

### Q: 如何重置数据库
A: 删除数据库文件（SQLite）或清空数据库表，然后重新运行 `python init_db.py`。

### Q: API 返回 422 错误
A: 检查请求参数格式是否正确，参考 API 文档中的模式定义。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！