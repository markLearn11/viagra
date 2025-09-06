// api.js - 统一API接口封装
const { request, buildApiUrl } = require('./config');

// 认证相关接口
const authApi = {
  // 微信登录
  wechatLogin: (code, userInfo) => {
    return request({
      url: '/api/auth/wechat-login',
      method: 'POST',
      data: { code, userInfo }
    });
  },
  
  // 手机号解密
  decryptPhone: (code, encryptedData, iv) => {
    return request({
      url: '/api/auth/decrypt-phone',
      method: 'POST',
      data: { code, encrypted_data: encryptedData, iv }
    });
  }
};

// 用户相关接口
const userApi = {
  // 获取用户信息
  getUserInfo: (userId) => {
    return request({
      url: `/api/users/${userId}`,
      method: 'GET'
    });
  },
  
  // 更新用户信息
  updateUserInfo: (userId, userData) => {
    return request({
      url: `/api/users/${userId}`,
      method: 'PUT',
      data: userData
    });
  },
  
  // 获取用户资料
  getUserProfile: (userId) => {
    return request({
      url: `/api/profiles/user/${userId}`,
      method: 'GET'
    });
  },
  
  // 更新用户资料
  updateUserProfile: (userId, profileData) => {
    return request({
      url: `/api/profiles/user/${userId}`,
      method: 'PUT',
      data: profileData
    });
  }
};

// 聊天相关接口
const chatApi = {
  // 获取聊天会话列表
  getChatSessions: (userId) => {
    return request({
      url: '/api/chat/sessions',
      method: 'GET',
      data: { user_id: userId }
    });
  },
  
  // 获取特定聊天会话
  getChatSession: (sessionId) => {
    return request({
      url: `/api/chat/sessions/${sessionId}`,
      method: 'GET'
    });
  },
  
  // 创建聊天会话
  createChatSession: (userId, sessionData) => {
    return request({
      url: '/api/chat/sessions',
      method: 'POST',
      data: { user_id: userId, ...sessionData }
    });
  },
  
  // 获取聊天消息
  getChatMessages: (sessionId) => {
    return request({
      url: `/api/chat/sessions/${sessionId}/messages`,
      method: 'GET'
    });
  },
  
  // 发送聊天消息
  sendChatMessage: (sessionId, userId, content) => {
    return request({
      url: `/api/chat/sessions/${sessionId}/messages`,
      method: 'POST',
      data: { user_id: userId, content }
    });
  },
  
  // AI分析（普通版本）
  getAIAnalysis: (prompt, flowData) => {
    return request({
      url: '/api/chat/analyze',
      method: 'POST',
      data: { prompt, flowData }
    });
  },
  
  // AI分析（流式版本）
  getAIAnalysisStream: (prompt, flowData, onProgress) => {
    const { createStreamRequest } = require('./stream-helper');
    
    return createStreamRequest({
      url: buildApiUrl('/api/chat/analyze-stream'),
      method: 'POST',
      data: { prompt, flowData },
      onProgress,
      onError: (error) => console.error('AI分析流式请求失败:', error)
    });
  },
  
  // 获取治疗计划（普通版本）
  getTreatmentPlan: (prompt, flowData) => {
    return request({
      url: '/api/chat/treatment',
      method: 'POST',
      data: { prompt, flowData }
    });
  },
  
  // 获取治疗计划（流式版本）
  getTreatmentPlanStream: (prompt, flowData, onProgress) => {
    const { createStreamRequest } = require('./stream-helper');
    
    return createStreamRequest({
      url: buildApiUrl('/api/chat/treatment-stream'),
      method: 'POST',
      data: { prompt, flowData },
      onProgress,
      onError: (error) => console.error('治疗计划流式请求失败:', error)
    });
  },
  
  // 保存治疗计划
  saveTreatmentPlan: (userId, planName, planContent, flowData, planType = 'monthly') => {
    return request({
      url: '/api/chat/save-treatment-plan',
      method: 'POST',
      data: {
        user_id: userId,
        plan_name: planName,
        plan_content: planContent,
        flow_data: flowData,
        plan_type: planType
      }
    });
  },
  
  // 获取所有治疗计划
  getTreatmentPlans: (userId) => {
    return request({
      url: `/api/chat/get-treatment-plans?user_id=${userId}`,
      method: 'GET'
    });
  },
  
  // 获取今日计划
  getTodayPlan: (userId, date) => {
    return request({
      url: '/api/chat/get-today-plan',
      method: 'GET',
      data: { user_id: userId, date }
    });
  },
  
  // 生成今日计划（流式版本）
  getTodayPlanStream: (requestData, onProgress) => {
    const { createStreamRequest } = require('./stream-helper');
    
    return createStreamRequest({
      url: buildApiUrl('/api/chat/today-plan-detailed'),
      method: 'POST',
      data: requestData,
      onProgress,
      onError: (error) => console.error('今日计划流式请求失败:', error)
    });
  }
};

// MBTI测试相关接口
const mbtiApi = {
  // 获取MBTI测试题目
  getMBTIQuestions: () => {
    return request({
      url: '/api/mbti/questions',
      method: 'GET'
    });
  },
  
  // 提交MBTI测试答案
  submitMBTITest: (userId, answers) => {
    return request({
      url: '/api/mbti/submit',
      method: 'POST',
      data: { user_id: userId, answers }
    });
  },
  
  // 获取用户的MBTI测试结果
  getUserMBTIResults: (userId) => {
    return request({
      url: `/api/mbti/results/user/${userId}`,
      method: 'GET'
    });
  },
  
  // 获取特定的MBTI测试结果
  getMBTIResult: (resultId) => {
    return request({
      url: `/api/mbti/results/${resultId}`,
      method: 'GET'
    });
  }
};

// 树洞相关接口
const treeholeApi = {
  // 创建树洞帖子
  createTreeholePost: (userId, postData) => {
    return request({
      url: '/api/treehole/posts',
      method: 'POST',
      data: { user_id: userId, ...postData }
    });
  },
  
  // 获取树洞帖子列表
  getTreeholePosts: (params = {}) => {
    return request({
      url: '/api/treehole/posts',
      method: 'GET',
      data: params
    });
  },
  
  // 获取用户的树洞帖子
  getUserTreeholePosts: (userId, params = {}) => {
    return request({
      url: `/api/treehole/posts/user/${userId}`,
      method: 'GET',
      data: params
    });
  },
  
  // 获取特定的树洞帖子
  getTreeholePost: (postId) => {
    return request({
      url: `/api/treehole/posts/${postId}`,
      method: 'GET'
    });
  },
  
  // 更新树洞帖子
  updateTreeholePost: (postId, userId, postData) => {
    return request({
      url: `/api/treehole/posts/${postId}`,
      method: 'PUT',
      data: { user_id: userId, ...postData }
    });
  },
  
  // 删除树洞帖子
  deleteTreeholePost: (postId, userId) => {
    return request({
      url: `/api/treehole/posts/${postId}`,
      method: 'DELETE',
      data: { user_id: userId }
    });
  }
};

// 角色相关接口
const characterApi = {
  // 获取角色列表
  getCharacters: () => {
    return request({
      url: '/api/characters',
      method: 'GET'
    });
  },
  
  // 获取特定角色
  getCharacter: (characterId) => {
    return request({
      url: `/api/characters/${characterId}`,
      method: 'GET'
    });
  }
};

// 导出所有API模块
module.exports = {
  authApi,
  userApi,
  chatApi,
  mbtiApi,
  treeholeApi,
  characterApi
};