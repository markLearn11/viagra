// index.js
// 获取应用实例
const app = getApp()
const { request } = require('../../utils/config')

Page({
  data: {
    showDrawer: false, // 控制抽屉显示状态
    hasProfile: false, // 控制是否已填写个人资料
    showWelcome: true, // 控制欢迎界面显示状态
    userProfile: {}, // 用户资料信息
    inputValue: '', // 输入框内容
    messages: [], // 聊天消息列表
    isLoading: false, // AI回复加载状态
    sessionId: null, // 当前聊天会话ID
    hasAiReply: false, // 是否已有AI回复
    planName: '', // 治疗计划名称
    
    // 多步骤对话流程状态
    currentStep: 1, // 当前步骤：1-问题描述，2-关系类型，3-详细情况，4-补充信息，5-总结确认，6-目标设定
    flowData: {
      problemDescription: '', // 问题描述
      relationshipType: '', // 关系类型
      relationshipDuration: '', // 关系持续时长
      incidentTime: '', // 事件发生时间
      incidentProcess: '', // 事件经过
      additionalInfo: '', // 补充信息
      summary: '', // 总结信息
      aiAnalysis: '', // AI分析结果
      goalType: '', // 目标类型：treatment（治疗计划）或 emotional（情绪发泄）
      treatmentPlan: '' // 治疗计划内容
    },
    showQuickButtons: false, // 是否显示快捷选择按钮
    showGoalButtons: false, // 是否显示目标选择按钮
    relationshipOptions: [
      { key: 'partner', label: '伴侣/配偶' },
      { key: 'father', label: '爸爸' },
      { key: 'mother', label: '妈妈' },
      { key: 'friend', label: '朋友' },
      { key: 'colleague', label: '同事' },
      { key: 'classmate', label: '同学' },
      { key: 'other', label: '其他亲密关系' }
    ]
  },

  // 调用AI接口获取分析结果
  async getAIAnalysis(flowData) {
    const analysisPrompt = `请分析以下心理咨询信息：
问题描述：${flowData.problemDescription}
关系类型：${flowData.relationshipType}
事件经过：${flowData.incidentProcess}
补充信息：${flowData.additionalInfo}

请提供专业的心理分析，包括问题的可能原因、情感状态分析等。分析应该客观、专业，并提供建设性的见解。`

    try {
      const response = await request({
        url: '/api/chat/analyze',
        method: 'POST',
        data: {
          prompt: analysisPrompt,
          flowData: flowData
        }
      })
      
      return response.data.analysis || '感谢你对我的信任，那么以下是我对这些事情的分析...'
    } catch (error) {
      console.error('AI分析接口调用失败:', error)
      throw error
    }
  },

  onLoad() {
    // 页面加载时的逻辑
    console.log('栖溯心理首页加载完成')
    this.checkProfileStatus()
    this.loadMessages()
  },

  onShow() {
    // 页面显示时重新检查资料状态
    this.checkProfileStatus()
  },

  // 检查用户是否已填写个人资料
  checkProfileStatus() {
    // 从本地存储中获取用户资料信息
    const userProfile = wx.getStorageSync('userProfile')
    if (userProfile && userProfile.nickname) {
      this.setData({
        hasProfile: true,
        showWelcome: false, // 已有资料时不显示欢迎界面
        userProfile: userProfile // 保存用户资料信息
      })
    } else {
      this.setData({
        hasProfile: false,
        showWelcome: true, // 无资料时显示欢迎界面
        userProfile: {} // 清空用户资料信息
      })
    }
  },

  // 从本地存储加载消息
  loadMessages() {
    const savedMessages = wx.getStorageSync('chatMessages')
    const savedFlowData = wx.getStorageSync('flowData')
    const savedCurrentStep = wx.getStorageSync('currentStep')
    
    if (savedMessages && savedMessages.length > 0) {
      this.setData({
        messages: savedMessages
      })
    }
    
    if (savedFlowData) {
      this.setData({
        flowData: savedFlowData
      })
    }
    
    if (savedCurrentStep) {
      this.setData({
        currentStep: savedCurrentStep
      })
    }
  },

  // 检查输入内容是否涉及他人关系
  checkIfInvolvesOthers(content) {
    const relationshipKeywords = [
      '他', '她', 'TA', '男朋友', '女朋友', '老公', '老婆', '丈夫', '妻子',
      '爸爸', '妈妈', '父亲', '母亲', '朋友', '同事', '同学', '室友',
      '领导', '老板', '同伴', '伙伴', '恋人', '情侣', '家人', '亲人','男票','女票'
    ]
    return relationshipKeywords.some(keyword => content.includes(keyword))
  },

  // 自动识别关系类型
  detectRelationshipType(content) {
    const relationshipMap = {
      '男朋友': '伴侣/配偶',
      '女朋友': '伴侣/配偶', 
      '老公': '伴侣/配偶',
      '老婆': '伴侣/配偶',
      '丈夫': '伴侣/配偶',
      '妻子': '伴侣/配偶',
      '恋人': '伴侣/配偶',
      '情侣': '伴侣/配偶',
      '爸爸': '爸爸',
      '父亲': '爸爸',
      '妈妈': '妈妈', 
      '母亲': '妈妈',
      '朋友': '朋友',
      '同事': '同事',
      '同学': '同学',
      '室友': '同学',
      '领导': '同事',
      '老板': '同事',
      '男票': '伴侣/配偶',
      '女票': '伴侣/配偶'
    }
    
    for (const [keyword, relationType] of Object.entries(relationshipMap)) {
      if (content.includes(keyword)) {
        return relationType
      }
    }
    return null
  },

  // 快捷按钮选择关系类型
  onQuickSelectRelation(e) {
    const relationKey = e.currentTarget.dataset.key
    const relation = this.data.relationshipOptions.find(item => item.key === relationKey)
    
    if (relation) {
      this.setData({
        inputValue: relation.label
      })
    }
  },

  // 第4步：没有更多信息
  onNoMoreInfo() {
    const { flowData, messages } = this.data
    
    // 添加系统消息表示用户选择没有更多信息
    const systemMessage = {
      id: Date.now(),
      content: '没有了，我已经说完了',
      role: 'user',
      timestamp: new Date().toLocaleTimeString(),
      step: 4
    }
    
    const newMessages = [...messages, systemMessage]
    
    this.setData({
      messages: newMessages,
      currentStep: 5,
      inputValue: ''
    })
    
    // 保存到本地存储
    wx.setStorageSync('chatMessages', newMessages)
    wx.setStorageSync('currentStep', 5)
  },

  // 第4步：有更多信息要补充
  onHasMoreInfo() {
    // 保持在第4步，等待用户输入补充信息
    wx.showToast({
      title: '请在下方输入补充信息',
      icon: 'none',
      duration: 2000
    })
  },

  // 第5步：确认总结正确
  async onConfirmSummary() {
    const { messages, flowData } = this.data
    
    const confirmMessage = {
      id: Date.now(),
      content: '对的，是这样的',
      role: 'user',
      timestamp: new Date().toLocaleTimeString(),
      step: 5
    }
    
    const newMessages = [...messages, confirmMessage]
    
    this.setData({
      messages: newMessages,
      isLoading: true,
      inputValue: ''
    })
    
    try {
      // 调用AI接口获取分析结果
      const analysisResult = await this.getAIAnalysis(flowData)
      
      const updatedFlowData = {
        ...flowData,
        aiAnalysis: analysisResult
      }
      
      this.setData({
        flowData: updatedFlowData,
        currentStep: 6, // 进入第6步目标设定
        isLoading: false
      })
      
      // 保存到本地存储
      wx.setStorageSync('chatMessages', newMessages)
      wx.setStorageSync('flowData', updatedFlowData)
      wx.setStorageSync('currentStep', 6)
    } catch (error) {
      console.error('获取AI分析失败:', error)
      this.setData({
        isLoading: false
      })
      wx.showToast({
        title: '分析失败，请重试',
        icon: 'none'
      })
    }
  },

  // 第5步：需要纠正总结
  onCorrectSummary() {
    const { messages } = this.data
    
    const correctMessage = {
      id: Date.now(),
      content: '不对，我需要纠正',
      role: 'user',
      timestamp: new Date().toLocaleTimeString(),
      step: 5
    }
    
    const newMessages = [...messages, correctMessage]
    
    // 回到第1步重新开始
    this.setData({
      messages: newMessages,
      currentStep: 1,
      planName: '',
      flowData: {
        problemDescription: '',
        relationshipType: '',
        relationshipDuration: '',
        incidentTime: '',
        incidentProcess: '',
        additionalInfo: '',
        summary: '',
        aiAnalysis: '',
        goalType: '',
        treatmentPlan: ''
      },
      showQuickButtons: false,
      showGoalButtons: false,
      inputValue: ''
    })
    
    // 保存到本地存储
    wx.setStorageSync('chatMessages', newMessages)
    wx.setStorageSync('currentStep', 1)
    wx.setStorageSync('flowData', {
      problemDescription: '',
      relationshipType: '',
      relationshipDuration: '',
      incidentTime: '',
      incidentProcess: '',
      additionalInfo: '',
      summary: '',
      goalType: ''
    })
    
    wx.showToast({
      title: '请重新描述你的问题',
      icon: 'none',
      duration: 2000
    })
  },

  // 获取治疗计划
  async getTreatmentPlan(flowData) {
    const treatmentPrompt = `基于以下心理咨询信息，请制定一个详细的治疗计划：
问题描述：${flowData.problemDescription}
关系类型：${flowData.relationshipType}
事件经过：${flowData.incidentProcess}
补充信息：${flowData.additionalInfo}
AI分析：${flowData.aiAnalysis}

请提供具体的治疗建议和步骤。`

    try {
      const response = await request({
        url: '/api/chat/treatment',
        method: 'POST',
        data: {
          prompt: treatmentPrompt,
          flowData: flowData
        },
        timeout: 120000 // 治疗计划生成需要更长时间，设置为120秒
      })
      
      if (!response.data.treatmentPlan) {
        throw new Error('AI生成的治疗计划为空')
      }
      
      return response.data.treatmentPlan
    } catch (error) {
      console.error('治疗计划接口调用失败:', error)
      throw error
    }
  },

  // 选择治疗计划目标
  async onSelectTreatmentGoal() {
    const goalMessage = {
      id: Date.now(),
      content: '我想走出困境，帮我制定治疗计划',
      role: 'user',
      timestamp: new Date().toLocaleTimeString(),
      step: 6
    }
    
    const newMessages = [...this.data.messages, goalMessage]
    const updatedFlowData = { ...this.data.flowData, goalType: 'treatment' }
    
    this.setData({
      messages: newMessages,
      flowData: updatedFlowData,
      currentStep: 8, // 跳转到第八步
      isLoading: true,
      showGoalButtons: false
    })
    
    try {
      // 调用API获取治疗计划
      const treatmentPlan = await this.getTreatmentPlan(updatedFlowData)
      
      const finalFlowData = {
        ...updatedFlowData,
        treatmentPlan: treatmentPlan
      }
      
      this.setData({
        flowData: finalFlowData,
        isLoading: false
      })
      
      // 保存到本地存储
      wx.setStorageSync('chatMessages', newMessages)
      wx.setStorageSync('flowData', finalFlowData)
      wx.setStorageSync('currentStep', 8)
    } catch (error) {
      console.error('获取治疗计划失败:', error)
      this.setData({
        isLoading: false
      })
      wx.showToast({
        title: '获取治疗计划失败，请重试',
        icon: 'none'
      })
    }
  },

  // 选择情绪发泄目标
  onSelectEmotionalGoal() {
    const goalMessage = {
      id: Date.now(),
      content: '我只想说出来，发泄一下情绪',
      role: 'user',
      timestamp: new Date().toLocaleTimeString(),
      step: 6
    }
    
    const newMessages = [...this.data.messages, goalMessage]
    const updatedFlowData = { ...this.data.flowData, goalType: 'emotional' }
    
    this.setData({
      messages: newMessages,
      flowData: updatedFlowData,
      hasAiReply: true,
      showGoalButtons: false
    })
    
    // 保存到本地存储
    wx.setStorageSync('chatMessages', newMessages)
    wx.setStorageSync('flowData', updatedFlowData)
    wx.setStorageSync('currentStep', 7) // 流程结束
  },

  // 跳过欢迎界面
  onSkipWelcome() {
    this.setData({
      showWelcome: false
    })
    wx.showToast({
      title: '稍后再说',
      icon: 'none',
      duration: 1500
    })
  },

  // 开始设置个人资料
  onStartProfile() {
    wx.navigateTo({
      url: '../profile/profile'
    })
  },

  // 输入框聚焦事件
  onInputFocus() {
    console.log('输入框获得焦点')
  },

  // 输入框失焦事件
  onInputBlur() {
    console.log('输入框失去焦点')
  },

  // 输入内容变化
  onInputChange(e) {
    this.setData({
      inputValue: e.detail.value
    })
  },

  // 发送消息
  sendMessage() {
    const { inputValue, currentStep, flowData } = this.data
    
    if (!inputValue.trim()) {
      wx.showToast({
        title: '请输入内容',
        icon: 'none'
      })
      return
    }

    // 添加用户消息到聊天列表
    const userMessage = {
      id: Date.now(),
      content: inputValue,
      role: 'user',
      timestamp: new Date().toLocaleTimeString(),
      step: currentStep
    }

    const newMessages = [...this.data.messages, userMessage]
    
    // 根据当前步骤处理用户输入
    const updatedFlowData = { ...flowData }
    let nextStep = currentStep
    let showQuickButtons = false
    
    switch(currentStep) {
      case 1: // 问题描述
        updatedFlowData.problemDescription = inputValue
        // 检查是否涉及他人关系
        const detectedRelationType = this.detectRelationshipType(inputValue)
        if (detectedRelationType) {
          // 自动识别到关系类型，直接跳过第二步
          updatedFlowData.relationshipType = detectedRelationType
          nextStep = 3
          showQuickButtons = false
        } else if (this.checkIfInvolvesOthers(inputValue)) {
          // 涉及他人但无法确定具体关系，进入第二步选择
          nextStep = 2
          showQuickButtons = true
        } else {
          // 不涉及他人关系，直接跳到第三步
          nextStep = 3
          showQuickButtons = false
        }
        break
      case 2: // 关系类型
        updatedFlowData.relationshipType = inputValue
        nextStep = 3
        showQuickButtons = false
        break
      case 3: // 详细情况
        updatedFlowData.incidentProcess = inputValue
        nextStep = 4
        break
      case 4: // 补充信息
        updatedFlowData.additionalInfo = inputValue
        nextStep = 5
        break
      case 5: // 总结确认后进入目标设定
        updatedFlowData.summary = inputValue
        nextStep = 6
        showQuickButtons = false
        break
      case 6: // 目标设定完成后结束流程
        updatedFlowData.goalType = inputValue
        // 流程结束，可以进入正常对话模式
        this.setData({
          hasAiReply: true
        })
        break
    }
    
    this.setData({
      messages: newMessages,
      inputValue: '',
      currentStep: nextStep,
      flowData: updatedFlowData,
      showQuickButtons: showQuickButtons
    })

    // 保存消息到本地存储
    wx.setStorageSync('chatMessages', newMessages)
    wx.setStorageSync('flowData', updatedFlowData)
    wx.setStorageSync('currentStep', nextStep)
  },

  // 创建聊天会话
  async createChatSession() {
    try {
      const response = await request({
        url: '/api/chat/sessions?user_id=1', // user_id作为查询参数
        method: 'POST',
        data: {
          title: '心理咨询对话' // 只有title在请求体中
        }
      })
      return response.data.id
    } catch (error) {
      console.error('创建会话失败:', error)
      throw error
    }
  },

  // 处理输入框确认事件（回车发送）
  onInputConfirm() {
    this.sendMessage()
  },

  // 跳转到档案页面
  goToProfile() {
    wx.navigateTo({
      url: '../profile/profile'
    })
  },

  // 清空聊天记录
  clearMessages() {
    this.setData({
      messages: [],
      sessionId: null,
      hasAiReply: false, // 重置AI回复状态
      currentStep: 1, // 重置流程步骤
      flowData: {
        problemDescription: '',
        relationshipType: '',
        relationshipDuration: '',
        incidentTime: '',
        incidentProcess: '',
        additionalInfo: '',
        summary: '',
        aiAnalysis: '',
        goalType: '',
        treatmentPlan: ''
      },
      showQuickButtons: false,
      showGoalButtons: false
    })
    // 清除本地存储的消息和流程数据
    wx.removeStorageSync('chatMessages')
    wx.removeStorageSync('flowData')
    wx.removeStorageSync('currentStep')
    wx.showToast({
      title: '聊天记录已清空',
      icon: 'success'
    })
  },

  // 导航栏左侧图标点击事件
  onLeftIconTap() {
    console.log('左侧图标被点击')
    this.setData({
      showDrawer: true
    })
  },

  // 导航栏右侧图标点击事件
  onRightIconTap() {
    wx.navigateTo({
      url: '/pages/my-profile/my-profile'
    });
  },

  // 关闭抽屉
  onDrawerClose() {
    this.setData({
      showDrawer: false
    })
  },

  // 处理计划名称输入
  onPlanNameInput(e) {
    this.setData({
      planName: e.detail.value
    });
  },

  // 确认计划名称，跳转到治疗计划详情页
  onConfirmPlanName() {
    if (!this.data.planName.trim()) {
      wx.showToast({
        title: '请输入计划名称',
        icon: 'none'
      });
      return;
    }

    // 跳转到治疗计划详情页
    wx.navigateTo({
      url: `/pages/treatment-plan/treatment-plan?planName=${encodeURIComponent(this.data.planName)}&treatmentPlan=${encodeURIComponent(this.data.flowData.treatmentPlan)}`
    });
  },

  // 抽屉菜单项点击事件
  onDrawerItemTap(e) {
    const type = e.detail.type
    console.log('抽屉菜单项被点击:', type)
    
    switch(type) {
      case 'profile':
        wx.navigateTo({
          url: '../profile/profile'
        })
        break
      case 'history':
         wx.navigateTo({
           url: '../chat-history/chat-history'
         })
         break
      case 'settings':
        wx.showToast({
          title: '设置功能开发中',
          icon: 'none'
        })
        break
      case 'about':
        wx.showToast({
          title: '关于我们功能开发中',
          icon: 'none'
        })
        break
    }
  }
})