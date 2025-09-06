# API接口封装使用说明

## 简介

本项目对网络请求进行了统一封装，提供了一套简洁易用的API接口，方便开发者进行网络请求操作。主要包含以下几个模块：

- `config.js` - 基础配置和请求封装
- `api.js` - 按功能模块分类的API接口
- `stream-helper.js` - 流式请求处理工具
- `api-example.js` - API使用示例

## 使用方法

### 1. 基本使用

```javascript
// 导入需要的API模块
const { authApi, userApi, chatApi } = require('../../utils/api');

// 在页面中使用
Page({
  data: {
    userInfo: null
  },
  
  onLoad() {
    // 获取用户信息
    this.getUserInfo();
  },
  
  async getUserInfo() {
    try {
      const userId = wx.getStorageSync('userId');
      if (!userId) {
        console.error('用户未登录');
        return;
      }
      
      const result = await userApi.getUserInfo(userId);
      this.setData({
        userInfo: result.data
      });
    } catch (error) {
      console.error('获取用户信息失败:', error);
      wx.showToast({
        title: '获取用户信息失败',
        icon: 'error'
      });
    }
  }
});
```

### 2. 处理流式请求

```javascript
// 导入聊天API
const { chatApi } = require('../../utils/api');

Page({
  data: {
    flowData: {},
    analysisResult: '',
    isLoading: false
  },
  
  // 获取AI分析（流式输出）
  async getAIAnalysis() {
    this.setData({ isLoading: true });
    
    try {
      const prompt = `请分析以下心理咨询信息：...`;
      
      // 定义进度回调函数
      const onProgress = (content) => {
        this.setData({
          analysisResult: content
        });
      };
      
      // 调用流式API
      const result = await chatApi.getAIAnalysisStream(
        prompt, 
        this.data.flowData, 
        onProgress
      );
      
      // 处理最终结果
      this.setData({
        analysisResult: result,
        isLoading: false
      });
    } catch (error) {
      console.error('获取AI分析失败:', error);
      this.setData({ isLoading: false });
      wx.showToast({
        title: '获取分析失败',
        icon: 'error'
      });
    }
  }
});
```

## API模块说明

### 1. 认证相关 (authApi)

- `wechatLogin(code, userInfo)` - 微信登录
- `decryptPhone(code, encryptedData, iv)` - 手机号解密

### 2. 用户相关 (userApi)

- `getUserInfo(userId)` - 获取用户信息
- `updateUserInfo(userId, userData)` - 更新用户信息
- `getUserProfile(userId)` - 获取用户资料
- `updateUserProfile(userId, profileData)` - 更新用户资料

### 3. 聊天相关 (chatApi)

- `getChatSessions(userId)` - 获取聊天会话列表
- `getChatSession(sessionId)` - 获取特定聊天会话
- `createChatSession(userId, sessionData)` - 创建聊天会话
- `getChatMessages(sessionId)` - 获取聊天消息
- `sendChatMessage(sessionId, userId, content)` - 发送聊天消息
- `getAIAnalysis(prompt, flowData)` - AI分析（普通版本）
- `getAIAnalysisStream(prompt, flowData, onProgress)` - AI分析（流式版本）
- `getTreatmentPlan(prompt, flowData)` - 获取治疗计划（普通版本）
- `getTreatmentPlanStream(prompt, flowData, onProgress)` - 获取治疗计划（流式版本）
- `saveTreatmentPlan(userId, planName, planContent, flowData, planType)` - 保存治疗计划
- `getTreatmentPlans(userId)` - 获取所有治疗计划
- `getTodayPlan(userId, date)` - 获取今日计划
- `getTodayPlanStream(requestData, onProgress)` - 生成今日计划（流式版本）

### 4. MBTI测试相关 (mbtiApi)

- `getMBTIQuestions()` - 获取MBTI测试题目
- `submitMBTITest(userId, answers)` - 提交MBTI测试答案
- `getUserMBTIResults(userId)` - 获取用户的MBTI测试结果
- `getMBTIResult(resultId)` - 获取特定的MBTI测试结果

### 5. 树洞相关 (treeholeApi)

- `createTreeholePost(userId, postData)` - 创建树洞帖子
- `getTreeholePosts(params)` - 获取树洞帖子列表
- `getUserTreeholePosts(userId, params)` - 获取用户的树洞帖子
- `getTreeholePost(postId)` - 获取特定的树洞帖子
- `updateTreeholePost(postId, userId, postData)` - 更新树洞帖子
- `deleteTreeholePost(postId, userId)` - 删除树洞帖子

### 6. 角色相关 (characterApi)

- `getCharacters()` - 获取角色列表
- `getCharacter(characterId)` - 获取特定角色

## 流式请求处理工具

`stream-helper.js` 提供了处理流式请求的工具函数：

- `decodeStreamChunk(data)` - 解码数据块
- `parseSSELine(line)` - 解析SSE格式的行数据
- `createStreamRequest(options)` - 创建流式请求处理器

## 环境配置

在 `config.js` 中可以配置不同环境的API地址和超时时间：

```javascript
const API_CONFIG = {
  // 开发环境
  development: {
    baseURL: 'http://localhost:8000',
    timeout: 60000
  },
  // 生产环境
  production: {
    baseURL: 'https://your-domain.com',
    timeout: 60000
  }
}
```

## 注意事项

1. 使用流式请求时，需要提供 `onProgress` 回调函数来处理实时数据
2. 所有API接口都返回Promise，可以使用async/await或then/catch处理
3. 请求失败时会自动打印错误日志，但需要在业务代码中处理错误提示
4. 在生产环境中，请确保修改 `config.js` 中的生产环境API地址