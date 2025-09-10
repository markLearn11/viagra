# 认证系统说明

本系统使用JWT (JSON Web Token) 进行用户认证。

## 认证流程

1. 用户通过以下方式之一登录：
   - 微信登录 (`POST /api/auth/wechat-login`)
   - 手机号验证码登录 (`POST /api/auth/login`)
   - 微信手机号解密登录 (`POST /api/auth/decrypt-phone`)

2. 登录成功后，服务器返回一个JWT token和用户信息：
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "user": {
       "id": 1,
       "phone": "13800138000",
       "nickname": "用户13800138000",
       "avatar_url": null,
       "wechat_openid": "o4N-55S1...",
       "is_active": true,
       "created_at": "2023-01-01T00:00:00",
       "updated_at": "2023-01-01T00:00:00"
     }
   }
   ```

3. 客户端需要将token存储在本地（如localStorage或sessionStorage）。

4. 在后续的API请求中，在HTTP头部添加Authorization字段：
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

## 需要认证的接口

以下接口需要在请求头中包含有效的JWT token：

### 用户管理
- `GET /api/users/me` - 获取当前用户信息
- `GET /api/users/{user_id}` - 获取用户详情
- `PUT /api/users/{user_id}/deactivate` - 停用用户
- `PUT /api/users/{user_id}/activate` - 激活用户

### 用户资料
- `POST /api/profiles/` - 创建用户资料
- `GET /api/profiles/user/{user_id}` - 获取用户资料
- `PUT /api/profiles/user/{user_id}` - 更新用户资料
- `DELETE /api/profiles/user/{user_id}` - 删除用户资料

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
- `POST /api/mbti/submit` - 提交测试答案
- `GET /api/mbti/results/user/{user_id}` - 获取用户测试结果
- `GET /api/mbti/results/{result_id}` - 获取特定测试结果
- `DELETE /api/mbti/results/{result_id}` - 删除测试结果

### 树洞功能
- `POST /api/treehole/posts` - 发布树洞帖子
- `GET /api/treehole/posts/user/{user_id}` - 获取用户帖子
- `PUT /api/treehole/posts/{post_id}` - 更新帖子
- `DELETE /api/treehole/posts/{post_id}` - 删除帖子

### 角色管理
- `POST /api/characters/{character_id}/use` - 使用角色

## Token过期处理

JWT token默认有效期为30分钟。当token过期时，API会返回401 Unauthorized错误。

客户端需要捕获401错误，并引导用户重新登录。

## 安全建议

1. Token应安全存储，避免XSS攻击
2. 使用HTTPS传输所有API请求
3. 定期刷新token（可选）
4. 在用户登出时清除本地存储的token