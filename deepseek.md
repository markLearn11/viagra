# DeepSeek AI 集成说明

## 概述

本项目已成功集成 DeepSeek 大模型，提供智能聊天功能。

## 配置

### 环境变量

在 `.env` 文件中配置以下变量：

```env
# DeepSeek AI 配置
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

### 依赖安装

```bash
pip install openai>=1.0.0
```

## API 接口

### AI 聊天接口

**端点**: `POST /chat/ai-chat`

**请求体**:
```json
{
  "session_id": 1,
  "message": "你好，请介绍一下自己",
  "character_id": null
}
```

**响应**:
```json
{
  "user_message": {
    "id": 1,
    "session_id": 1,
    "role": "user",
    "content": "你好，请介绍一下自己",
    "message_type": "text",
    "created_at": "2024-01-01T00:00:00"
  },
  "ai_message": {
    "id": 2,
    "session_id": 1,
    "role": "assistant",
    "content": "你好！我是一个AI助手...",
    "message_type": "text",
    "created_at": "2024-01-01T00:00:01"
  }
}
```

## 功能特性

1. **智能对话**: 基于 DeepSeek 模型的自然语言对话
2. **上下文记忆**: 自动维护对话历史（最近10条消息）
3. **角色扮演**: 支持通过 `character_id` 指定不同的AI角色
4. **错误处理**: 完善的错误处理和回滚机制
5. **数据持久化**: 所有对话消息自动保存到数据库

## 使用示例

### 1. 创建聊天会话

```bash
curl -X POST "http://localhost:8000/chat/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "与AI的对话"
  }' \
  -G -d "user_id=1"
```

### 2. 发送消息并获取AI回复

```bash
curl -X POST "http://localhost:8000/chat/ai-chat" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": 1,
    "message": "你好，能帮我解答一些问题吗？"
  }'
```

### 3. 获取对话历史

```bash
curl "http://localhost:8000/chat/sessions/1/messages"
```

## 原始调用方法

如需直接使用 DeepSeek API，可参考以下代码：

```python
# Please install OpenAI SDK first: pip3 install openai

from openai import OpenAI

client = OpenAI(api_key="<DeepSeek API Key>", base_url="https://api.deepseek.com")

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[
        {"role": "system", "content": "You are a helpful assistant"},
        {"role": "user", "content": "Hello"},
    ],
    stream=False
)

print(response.choices[0].message.content)
```

## 注意事项

1. **API Key**: 请确保在 `.env` 文件中正确配置 DeepSeek API Key
2. **网络连接**: 确保服务器能够访问 `https://api.deepseek.com`
3. **费用控制**: DeepSeek API 按使用量计费，请合理控制调用频率
4. **错误处理**: 如果 AI 调用失败，用户消息会被回滚，不会保存到数据库