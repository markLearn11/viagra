// api.js - 统一API接口封装
const { request, setTokenInfo, clearTokenInfo } = require('./config');

// 认证相关接口
const authApi = {
  // 微信登录
  wechatLogin: async (code, userInfo) => {
    const response = await request({
      url: '/api/auth/wechat-login',
      method: 'POST',
      data: { code, userInfo }
    });
    
    // 存储token信息
    setTokenInfo({
      access_token: response.access_token,
      refresh_token: response.refresh_token,
      user: response.user
    });
    
    // 存储userId
    wx.setStorageSync('userId', response.user.id);
    
    return response;
  },
  
  // 手机号解密
  decryptPhone: async (code, encryptedData, iv) => {
    const response = await request({
      url: '/api/auth/decrypt-phone',
      method: 'POST',
      data: { code, encrypted_data: encryptedData, iv }
    });
    
    // 存储token信息
    setTokenInfo({
      access_token: response.access_token,
      refresh_token: response.refresh_token,
      user: response.user
    });
    
    // 存储userId
    wx.setStorageSync('userId', response.user.id);
    
    return response;
  },
  
  // 验证码登录
  loginWithCode: async (phone, code) => {
    const response = await request({
      url: '/api/auth/login',
      method: 'POST',
      data: { phone, code }
    });
    
    // 存储token信息
    setTokenInfo({
      access_token: response.access_token,
      refresh_token: response.refresh_token,
      user: response.user
    });
    
    // 存储userId
    wx.setStorageSync('userId', response.user.id);
    
    return response;
  },
  
  // 登出
  logout: () => {
    // 清除存储的token信息
    clearTokenInfo();
    wx.removeStorageSync('userId');
    return Promise.resolve({ message: '登出成功' });
  }
};

// 用户相关接口
const userApi = {
  // 获取当前用户信息
  getCurrentUserInfo: () => {
    return request({
      url: '/api/users/me',
      method: 'GET',
      requireAuth: true
    });
  },
  
  // 获取特定用户信息
  getUserInfo: (userId) => {
    return request({
      url: `/api/users/${userId}`,
      method: 'GET',
      requireAuth: true
    });
  },
  
  // 更新用户信息
  updateUserInfo: (userId, userData) => {
    return request({
      url: `/api/users/${userId}`,
      method: 'PUT',
      data: userData,
      requireAuth: true
    });
  },
  
  // 获取当前用户资料
  getCurrentUserProfile: () => {
    const userId = wx.getStorageSync('userId');
    return request({
      url: `/api/profiles/user/${userId}`,
      method: 'GET',
      requireAuth: true
    });
  },
  
  // 更新当前用户资料
  updateCurrentUserProfile: (profileData) => {
    const userId = wx.getStorageSync('userId');
    return request({
      url: `/api/profiles/user/${userId}`,
      method: 'PUT',
      data: profileData,
      requireAuth: true
    });
  }
};

// 聊天相关接口
const chatApi = {
  // 创建聊天会话
  createChatSession: (sessionData) => {
    return request({
      url: '/api/chat/sessions',
      method: 'POST',
      data: sessionData,
      requireAuth: true
    });
  },
  
  // 获取用户聊天会话列表
  getUserChatSessions: (userId, params = {}) => {
    return request({
      url: `/api/chat/sessions/user/${userId}`,
      method: 'GET',
      data: params,
      requireAuth: true
    });
  },
  
  // 获取特定聊天会话
  getChatSession: (sessionId) => {
    return request({
      url: `/api/chat/sessions/${sessionId}`,
      method: 'GET',
      requireAuth: true
    });
  },
  
  // 更新聊天会话
  updateChatSession: (sessionId, title) => {
    return request({
      url: `/api/chat/sessions/${sessionId}`,
      method: 'PUT',
      data: { title },
      requireAuth: true
    });
  },
  
  // 删除聊天会话
  deleteChatSession: (sessionId) => {
    return request({
      url: `/api/chat/sessions/${sessionId}`,
      method: 'DELETE',
      requireAuth: true
    });
  },
  
  // 发送聊天消息
  sendChatMessage: (messageData) => {
    return request({
      url: '/api/chat/messages',
      method: 'POST',
      data: messageData,
      requireAuth: true
    });
  },
  
  // 获取会话消息列表
  getChatMessages: (sessionId, params = {}) => {
    return request({
      url: `/api/chat/sessions/${sessionId}/messages`,
      method: 'GET',
      data: params,
      requireAuth: true
    });
  },
  
  // 删除聊天消息
  deleteChatMessage: (messageId) => {
    return request({
      url: `/api/chat/messages/${messageId}`,
      method: 'DELETE',
      requireAuth: true
    });
  },
  
  // AI聊天
  aiChat: (chatData) => {
    return request({
      url: '/api/chat/ai-chat',
      method: 'POST',
      data: chatData,
      requireAuth: true
    });
  },
  
  // 获取AI分析（流式输出）
  getAIAnalysisStream: (prompt, flowData, onProgress) => {
    return request({
      url: '/api/chat/analyze',
      method: 'POST',
      data: { prompt, flowData },
      requireAuth: true,
      onProgress: onProgress
    });
  },
  
  // 获取治疗计划
  getTreatmentPlan: (treatmentData) => {
    return request({
      url: '/api/chat/treatment',
      method: 'POST',
      data: treatmentData,
      requireAuth: true
    });
  },
  
  // 获取治疗计划列表
  getTreatmentPlans: (userId) => {
    // 确保userId存在
    if (!userId) {
      return Promise.reject(new Error("用户ID不能为空"));
    }
    
    return request({
      url: `/api/chat/get-treatment-plans?user_id=${userId}`,
      method: 'GET',
      requireAuth: true
    });
  },
  
  // 删除治疗计划
  deleteTreatmentPlan: (planId) => {
    return request({
      url: `/api/chat/delete-treatment-plan?plan_id=${planId}`,
      method: 'DELETE',
      requireAuth: true
    });
  }
};

// MBTI测试相关接口
const mbtiApi = {
  // 获取MBTI测试题目
  getQuestions: () => {
    return request({
      url: '/api/mbti/questions',
      method: 'GET'
    });
  },
  
  // 提交MBTI测试答案
  submitAnswers: (answers) => {
    return request({
      url: '/api/mbti/submit',
      method: 'POST',
      data: answers,
      requireAuth: true
    });
  },
  
  // 获取用户MBTI测试结果
  getUserResults: (userId) => {
    return request({
      url: `/api/mbti/results/user/${userId}`,
      method: 'GET',
      requireAuth: true
    });
  },
  
  // 获取特定MBTI测试结果
  getResult: (resultId) => {
    return request({
      url: `/api/mbti/results/${resultId}`,
      method: 'GET',
      requireAuth: true
    });
  },
  
  // 删除MBTI测试结果
  deleteResult: (resultId) => {
    return request({
      url: `/api/mbti/results/${resultId}`,
      method: 'DELETE',
      requireAuth: true
    });
  }
};

// 树洞相关接口
const treeholeApi = {
  // 创建树洞帖子
  createPost: (postData) => {
    return request({
      url: '/api/treehole/posts',
      method: 'POST',
      data: postData,
      requireAuth: true
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
  
  // 获取当前用户的树洞帖子
  getCurrentUserTreeholePosts: (params = {}) => {
    const userId = wx.getStorageSync('userId');
    return request({
      url: `/api/treehole/posts/user/${userId}`,
      method: 'GET',
      data: params,
      requireAuth: true
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
  updateTreeholePost: (postId, postData) => {
    return request({
      url: `/api/treehole/posts/${postId}`,
      method: 'PUT',
      data: postData,
      requireAuth: true
    });
  },
  
  // 删除树洞帖子
  deleteTreeholePost: (postId) => {
    return request({
      url: `/api/treehole/posts/${postId}`,
      method: 'DELETE',
      requireAuth: true
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
  },
  
  // 使用角色
  useCharacter: (characterId) => {
    return request({
      url: `/api/characters/${characterId}/use`,
      method: 'POST',
      requireAuth: true
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