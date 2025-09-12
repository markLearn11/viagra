# 认证系统说明

本系统使用JWT (JSON Web Token) 进行用户认证，支持访问令牌和刷新令牌机制。

## 认证流程

1. 用户通过以下方式之一登录：
   - 微信登录 (`POST /api/auth/wechat-login`)
   - 手机号验证码登录 (`POST /api/auth/login`)
   - 微信手机号解密登录 (`POST /api/auth/decrypt-phone`)

2. 登录成功后，服务器返回访问令牌、刷新令牌和用户信息：
   ```json
   {
     "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "token_type": "bearer",
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

3. 客户端需要将token信息存储在本地（如localStorage或sessionStorage）。

4. 在后续的API请求中，在HTTP头部添加Authorization字段：
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

## Token刷新机制

系统实现了双令牌机制来提升用户体验：
- 访问令牌（access_token）：有效期30分钟，用于API认证
- 刷新令牌（refresh_token）：有效期24小时，用于获取新的访问令牌

当访问令牌过期时，前端会自动使用刷新令牌获取新的访问令牌，无需用户重新登录。

## 需要认证的接口

以下接口需要在请求头中包含有效的JWT token：

### 认证相关
- `POST /api/auth/refresh-token` - 刷新访问令牌

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

## 安全建议

1. Token应安全存储，避免XSS攻击
2. 使用HTTPS传输所有API请求
3. 定期刷新token（已自动实现）
4. 在用户登出时清除本地存储的token