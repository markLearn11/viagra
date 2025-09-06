// api-example.js - API使用示例

// 导入API模块
const { authApi, userApi, chatApi, mbtiApi, treeholeApi, characterApi } = require('./api');

// 示例：用户登录
async function loginExample() {
  try {
    // 微信登录
    const loginCode = 'wx_login_code'; // 通过wx.login获取
    const userInfo = {
      nickName: '用户昵称',
      avatarUrl: '头像URL'
    };
    
    const loginResult = await authApi.wechatLogin(loginCode, userInfo);
    console.log('登录成功:', loginResult);
    
    // 保存用户信息和token
    wx.setStorageSync('userInfo', loginResult.data.user);
    wx.setStorageSync('token', loginResult.data.token);
    wx.setStorageSync('userId', loginResult.data.user.id);
    
    return loginResult.data;
  } catch (error) {
    console.error('登录失败:', error);
    return null;
  }
}

// 示例：获取用户信息
async function getUserInfoExample() {
  try {
    const userId = wx.getStorageSync('userId');
    if (!userId) {
      console.error('用户未登录');
      return null;
    }
    
    const userInfoResult = await userApi.getUserInfo(userId);
    console.log('获取用户信息成功:', userInfoResult);
    
    return userInfoResult.data;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
}

// 示例：获取治疗计划（普通版本）
async function getTreatmentPlanExample(flowData) {
  try {
    const prompt = `基于以下心理咨询信息，请制定一个详细的治疗计划：
问题描述：${flowData.problemDescription}
关系类型：${flowData.relationshipType}
事件经过：${flowData.incidentProcess}
补充信息：${flowData.additionalInfo}
AI分析：${flowData.aiAnalysis}

请提供具体的治疗建议和步骤。`;
    
    const result = await chatApi.getTreatmentPlan(prompt, flowData);
    console.log('获取治疗计划成功:', result);
    
    return result.data;
  } catch (error) {
    console.error('获取治疗计划失败:', error);
    return null;
  }
}

// 示例：获取治疗计划（流式版本）
async function getTreatmentPlanStreamExample(flowData) {
  try {
    const prompt = `基于以下心理咨询信息，请制定一个详细的治疗计划：
问题描述：${flowData.problemDescription}
关系类型：${flowData.relationshipType}
事件经过：${flowData.incidentProcess}
补充信息：${flowData.additionalInfo}
AI分析：${flowData.aiAnalysis}

请提供具体的治疗建议和步骤。`;
    
    // 定义进度回调函数
    const onProgress = (content) => {
      console.log('收到流式数据:', content.length);
      // 这里可以更新UI显示
    };
    
    const result = await chatApi.getTreatmentPlanStream(prompt, flowData, onProgress);
    console.log('流式获取治疗计划完成:', result);
    
    return result;
  } catch (error) {
    console.error('流式获取治疗计划失败:', error);
    return null;
  }
}

// 示例：保存治疗计划
async function saveTreatmentPlanExample(planContent, flowData) {
  try {
    const userId = wx.getStorageSync('userId') || 1;
    const planName = '个性化治疗计划';
    
    const result = await chatApi.saveTreatmentPlan(userId, planName, planContent, flowData);
    console.log('保存治疗计划成功:', result);
    
    return result.data;
  } catch (error) {
    console.error('保存治疗计划失败:', error);
    return null;
  }
}

// 示例：获取MBTI测试题目
async function getMBTIQuestionsExample() {
  try {
    const result = await mbtiApi.getMBTIQuestions();
    console.log('获取MBTI测试题目成功:', result);
    
    return result.data.questions;
  } catch (error) {
    console.error('获取MBTI测试题目失败:', error);
    return null;
  }
}

// 示例：提交MBTI测试答案
async function submitMBTITestExample(answers) {
  try {
    const userId = wx.getStorageSync('userId') || 1;
    
    const result = await mbtiApi.submitMBTITest(userId, answers);
    console.log('提交MBTI测试答案成功:', result);
    
    return result.data;
  } catch (error) {
    console.error('提交MBTI测试答案失败:', error);
    return null;
  }
}

// 示例：创建树洞帖子
async function createTreeholePostExample(postData) {
  try {
    const userId = wx.getStorageSync('userId') || 1;
    
    const result = await treeholeApi.createTreeholePost(userId, postData);
    console.log('创建树洞帖子成功:', result);
    
    return result.data;
  } catch (error) {
    console.error('创建树洞帖子失败:', error);
    return null;
  }
}

// 示例：获取树洞帖子列表
async function getTreeholePostsExample() {
  try {
    // 可以传入筛选参数
    const params = {
      skip: 0,
      limit: 20,
      mood_score: null, // 可选的心情评分筛选
      tags: null // 可选的标签筛选
    };
    
    const result = await treeholeApi.getTreeholePosts(params);
    console.log('获取树洞帖子列表成功:', result);
    
    return result.data;
  } catch (error) {
    console.error('获取树洞帖子列表失败:', error);
    return null;
  }
}

// 导出示例函数
module.exports = {
  loginExample,
  getUserInfoExample,
  getTreatmentPlanExample,
  getTreatmentPlanStreamExample,
  saveTreatmentPlanExample,
  getMBTIQuestionsExample,
  submitMBTITestExample,
  createTreeholePostExample,
  getTreeholePostsExample
};