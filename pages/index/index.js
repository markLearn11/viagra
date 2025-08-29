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
    waitAndSayFlag: false, // 等待并说话标志位
    isSending: false, // 防止重复发送消息
    relationshipsToShow: [], // 显示的关系类型列表

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
      aiSummary: null, // AI生成的简洁总结
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
    ],
    aiSuggestedRelationships: [], // AI推荐的关系类型
    aiAnalysisReasoning: '', // AI分析原因
    selectedRelationships: [], // 已选择的关系类型（多选）
    showConfirmButton: false // 是否显示确认按钮
  },

  // 调用AI接口获取分析结果（流式输出）
  async getAIAnalysis(flowData, onProgress) {
    const analysisPrompt = `请分析以下心理咨询信息：
问题描述：${flowData.problemDescription}
关系类型：${flowData.relationshipType}
事件经过：${flowData.incidentProcess}
补充信息：${flowData.additionalInfo}

请提供专业的心理分析，包括问题的可能原因、情感状态分析等。分析应该客观、专业，并提供建设性的见解。`

    try {
      // 由于微信小程序不支持真正的流式传输，我们先获取完整结果，然后模拟流式显示
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: 'http://localhost:8000/api/chat/analyze',
          method: 'POST',
          data: {
            prompt: analysisPrompt,
            flowData: flowData
          },
          header: {
            'Content-Type': 'application/json'
          },
          success: resolve,
          fail: reject
        })
      })

      // 解析流式响应数据
      let analysisResult = ''
      const responseText = response.data

      if (typeof responseText === 'string') {
        // 解析 Server-Sent Events 格式
        const lines = responseText.split('\n')

        for (let line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.substring(6) // 移除 'data: ' 前缀
              const data = JSON.parse(jsonStr)

              if (data.content) {
                analysisResult += data.content
              }
            } catch (parseError) {
              console.log('解析数据行失败:', line, parseError)
            }
          }
        }
      }

      // 如果获取到了分析结果，模拟流式显示
      if (analysisResult && onProgress) {
        // 模拟流式输出效果
        for (let i = 0; i <= analysisResult.length; i += 3) {
          const partialResult = analysisResult.substring(0, i + 3)
          onProgress(partialResult)
          // 添加延迟模拟流式效果
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      return analysisResult || '感谢你对我的信任，那么以下是我对这些事情的分析...'
    } catch (error) {
      console.error('AI分析接口调用失败:', error)
      return '感谢你对我的信任，那么以下是我对这些事情的分析...'
    }
  },

  // 调用AI接口生成简洁总结
  async generateAISummary(flowData) {
    try {
      console.log('调用AI总结接口，请求数据:', {
        problemDescription: flowData.problemDescription,
        relationshipType: flowData.relationshipType,
        incidentProcess: flowData.incidentProcess,
        additionalInfo: flowData.additionalInfo
      })

      const response = await request({
        url: '/api/chat/ai-summary',
        method: 'POST',
        data: {
          problemDescription: flowData.problemDescription,
          relationshipType: flowData.relationshipType,
          incidentProcess: flowData.incidentProcess,
          additionalInfo: flowData.additionalInfo
        }
      })

      console.log('AI总结接口响应:', response)

      if (response.data) {
        console.log('返回AI总结数据:', response.data)
        return response.data
      }

      // 如果没有返回数据，返回默认总结
      console.log('没有返回数据，使用默认总结')
      return {
        problemSummary: flowData.problemDescription?.substring(0, 15) || '无',
        relationshipSummary: flowData.relationshipType?.substring(0, 15) || '无',
        incidentSummary: flowData.incidentProcess?.substring(0, 15) || '无',
        additionalSummary: flowData.additionalInfo?.substring(0, 15) || '无'
      }
    } catch (error) {
      console.error('AI总结生成失败:', error)
      // 返回默认总结
      return {
        problemSummary: flowData.problemDescription?.substring(0, 15) || '无',
        relationshipSummary: flowData.relationshipType?.substring(0, 15) || '无',
        incidentSummary: flowData.incidentProcess?.substring(0, 15) || '无',
        additionalSummary: flowData.additionalInfo?.substring(0, 15) || '无'
      }
    }
  },

  onLoad() {
    // 页面加载时的逻辑
    console.log('栖溯心理首页加载完成')
    this.checkProfileStatus()
    this.loadMessages()
    this.updateRelationshipsToShow()
    // 清理可能存在的脏数据
    this.cleanSelectedRelationships()
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
    const savedAiSuggestedRelationships = wx.getStorageSync('aiSuggestedRelationships')
    const savedAiAnalysisReasoning = wx.getStorageSync('aiAnalysisReasoning')

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
        currentStep: savedCurrentStep,
        // 如果当前步骤是关系类型选择且有AI推荐的关系类型，显示快捷选择按钮
        showQuickButtons: savedCurrentStep === 2 && savedAiSuggestedRelationships && savedAiSuggestedRelationships.length > 0
      })
    }

    // 恢复AI推荐的关系类型数据
    if (savedAiSuggestedRelationships && savedAiSuggestedRelationships.length > 0) {
      this.setData({
        aiSuggestedRelationships: savedAiSuggestedRelationships
      })
      this.updateRelationshipsToShow()
    }

    if (savedAiAnalysisReasoning) {
      this.setData({
        aiAnalysisReasoning: savedAiAnalysisReasoning
      })
    }
  },

  // 检查输入内容是否涉及他人关系
  checkIfInvolvesOthers(content) {
    const relationshipKeywords = [
      '他', '她', 'TA', '男朋友', '女朋友', '老公', '老婆', '丈夫', '妻子',
      '爸爸', '妈妈', '父亲', '母亲', '朋友', '同事', '同学', '室友',
      '领导', '老板', '同伴', '伙伴', '恋人', '情侣', '家人', '亲人', '男票', '女票'
    ]

    // 情感关键词，通常暗示涉及他人关系
    const emotionalKeywords = [
      '分手', '吵架', '冷战', '误解', '矛盾', '争执', '不理', '生气',
      '伤心', '难过', '失恋', '背叛', '出轨', '离婚', '复合', '和好',
      '闹矛盾', '闹别扭', '感情问题', '关系问题'
    ]

    return relationshipKeywords.some(keyword => content.includes(keyword)) ||
      emotionalKeywords.some(keyword => content.includes(keyword))
  },

  // AI智能关系分析方法
  async analyzeRelationshipType(content) {
    try {
      const response = await request({
        url: '/api/chat/relationship-analysis',
        method: 'POST',
        data: {
          user_input: content
        }
      })

      const { suggested_relationships, confidence, reasoning } = response.data

      // 如果置信度较高且有推荐关系，返回第一个推荐关系
      if (confidence >= 0.6 && suggested_relationships.length > 0) {
        return {
          relationship: suggested_relationships[0],
          suggestions: suggested_relationships,
          confidence: confidence,
          reasoning: reasoning
        }
      }

      // 如果置信度较低但有推荐，返回建议列表供用户选择
      if (suggested_relationships.length > 0) {
        return {
          relationship: null,
          suggestions: suggested_relationships,
          confidence: confidence,
          reasoning: reasoning
        }
      }

      return null
    } catch (error) {
      console.error('AI关系分析失败:', error)
      // 降级到原有的关键词匹配逻辑
      return this.detectRelationshipTypeByKeywords(content)
    }
  },

  // 保留原有的关键词匹配作为降级方案
  detectRelationshipTypeByKeywords(content) {
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
        return {
          relationship: relationType,
          suggestions: [relationType],
          confidence: 0.8,
          reasoning: `检测到关键词：${keyword}`
        }
      }
    }
    return null
  },

  // 更新要显示的关系类型列表
  updateRelationshipsToShow() {
    const { aiSuggestedRelationships, relationshipOptions } = this.data;
    let relationshipsToShow = [];
    
    if (aiSuggestedRelationships && aiSuggestedRelationships.length > 0) {
      relationshipsToShow = aiSuggestedRelationships;
    } else if (relationshipOptions && relationshipOptions.length > 0) {
      // 如果relationshipOptions是对象数组，提取label属性
      if (typeof relationshipOptions[0] === 'object' && relationshipOptions[0].label) {
        relationshipsToShow = relationshipOptions.map(item => item.label);
      } else {
        relationshipsToShow = relationshipOptions;
      }
    }
    
    this.setData({
      relationshipsToShow: relationshipsToShow
    });
  },

  // 清理字符串数组，移除可能的JSON序列化问题
  cleanStringArray(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(item => {
      if (typeof item === 'string') {
        // 移除可能的双引号包装
        return item.replace(/^"|"$/g, '');
      }
      return String(item);
    });
  },

  // 清理selectedRelationships数据
  cleanSelectedRelationships() {
    const { selectedRelationships } = this.data;
    if (Array.isArray(selectedRelationships) && selectedRelationships.length > 0) {
      const cleanedRelationships = this.cleanStringArray(selectedRelationships);
      this.setData({
        selectedRelationships: cleanedRelationships
      });
      console.log('清理selectedRelationships:', selectedRelationships, '->', cleanedRelationships);
    }
  },

  // 快捷按钮选择关系类型（多选）
  onQuickSelectRelation(e) {
    const relationValue = e.currentTarget.dataset.relation;
    let { selectedRelationships } = this.data;

    // 确保selectedRelationships是数组并清理数据
    if (!Array.isArray(selectedRelationships)) {
      selectedRelationships = [];
    } else {
      selectedRelationships = this.cleanStringArray(selectedRelationships);
      // 如果数据被清理了，先更新到页面数据中
      this.setData({
        selectedRelationships: selectedRelationships
      });
    }

    const index = selectedRelationships.indexOf(relationValue);
    let newSelected;

    if (index > -1) {
      // 如果已选中，则取消选择
      newSelected = selectedRelationships.filter(item => item !== relationValue);
    } else {
      // 如果未选中，则添加到选择列表
      newSelected = [...selectedRelationships, relationValue];
    }

    this.setData({
      selectedRelationships: newSelected,
      showConfirmButton: newSelected.length > 0
    });

    console.log('当前选择:', newSelected);
    console.log('relationValue:', relationValue);
    console.log('清理后的selectedRelationships:', selectedRelationships);
    console.log('includes result:', selectedRelationships.includes(relationValue));
  },

  // 确认选择的关系类型（多选）
  onConfirmRelationshipSelection() {
    const { selectedRelationships } = this.data

    if (selectedRelationships && selectedRelationships.length > 0) {
      // 将多个关系类型用逗号连接
      const relationshipText = selectedRelationships.join('、')

      // 调用sendMessage处理选择结果
      this.setData({
        inputValue: relationshipText
      })

      // 发送消息
      this.sendMessage()

      // 重置多选状态
      this.setData({
        selectedRelationships: [],
        showConfirmButton: false
      })
    } else {
      wx.showToast({
        title: '请先选择关系类型',
        icon: 'none',
        duration: 2000
      })
    }
  },

  // 第4步：没有更多信息
  async onNoMoreInfo() {
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

    // 先跳转到第五步并显示加载状态
    this.setData({
      messages: newMessages,
      currentStep: 5,
      inputValue: '',
      isLoading: true
    })

    // 保存到本地存储
    wx.setStorageSync('chatMessages', newMessages)
    wx.setStorageSync('currentStep', 5)

    // 调用AI生成总结
    try {
      console.log('开始生成AI总结，flowData:', flowData)
      const aiSummary = await this.generateAISummary(flowData)
      console.log('AI总结生成成功:', aiSummary)

      // 实现流式输出效果
      await this.displaySummaryWithStream(aiSummary)

    } catch (error) {
      console.error('生成AI总结失败:', error)
      this.setData({
        isLoading: false
      })
    }
  },

  // 流式显示AI总结
  async displaySummaryWithStream(aiSummary) {
    // 先清空aiSummary，准备流式输出
    this.setData({
      'flowData.aiSummary': null
    })

    // 延迟一下，让加载状态显示一会儿
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 逐步显示各个总结项
    const summaryItems = [
      { key: 'problemSummary', label: '问题描述', value: aiSummary.problemSummary },
      { key: 'relationshipSummary', label: '关系类型', value: aiSummary.relationshipSummary },
      { key: 'incidentSummary', label: '事件经过', value: aiSummary.incidentSummary },
      { key: 'additionalSummary', label: '补充信息', value: aiSummary.additionalSummary }
    ]

    // 初始化一个空的aiSummary对象
    let currentSummary = {}

    for (let i = 0; i < summaryItems.length; i++) {
      const item = summaryItems[i]

      // 如果该项有内容，则添加到总结中
      if (item.value && item.value !== '无') {
        currentSummary[item.key] = item.value

        // 更新数据，触发界面更新
        this.setData({
          'flowData.aiSummary': { ...currentSummary },
          isLoading: false
        })

        // 每个项之间延迟一下，创建流式效果
        if (i < summaryItems.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800))
        }
      }
    }

    // 如果没有任何有效内容，显示降级方案
    if (Object.keys(currentSummary).length === 0) {
      this.setData({
        'flowData.aiSummary': null,
        isLoading: false
      })
    }

    // 保存最终数据到本地存储
    const { flowData } = this.data
    wx.setStorageSync('flowData', flowData)
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
      // 调用AI接口获取分析结果（流式输出）
      const analysisResult = await this.getAIAnalysis(flowData, (partialResult) => {
        // 流式更新AI分析结果
        const updatedFlowData = {
          ...this.data.flowData,
          aiAnalysis: partialResult
        }
        this.setData({
          flowData: updatedFlowData
        })
      })

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

  // 获取治疗计划 - 流式版本
  async getTreatmentPlanStream(flowData) {
    const treatmentPrompt = `基于以下心理咨询信息，请制定一个详细的治疗计划：
问题描述：${flowData.problemDescription}
关系类型：${flowData.relationshipType}
事件经过：${flowData.incidentProcess}
补充信息：${flowData.additionalInfo}
AI分析：${flowData.aiAnalysis}

请提供具体的治疗建议和步骤。`

    return new Promise((resolve, reject) => {
      const { buildApiUrl } = require('../../utils/config')

      // 创建请求任务
      const requestTask = wx.request({
        url: buildApiUrl('/api/chat/treatment-stream'),
        method: 'POST',
        data: {
          prompt: treatmentPrompt,
          flowData: flowData
        },
        header: {
          'Content-Type': 'application/json'
        },
        enableChunked: true, // 启用分块传输
        success: (res) => {
          console.log('流式响应成功:', res)
          resolve(res.data)
        },
        fail: (error) => {
          console.error('流式请求失败:', error)
          reject(error)
        }
      })

      // 监听分块数据
      let accumulatedData = ''
      requestTask.onChunkReceived((res) => {
        const chunk = wx.arrayBufferToBase64(res.data)
        const decodedChunk = decodeURIComponent(escape(atob(chunk)))

        // 处理流式数据
        const lines = decodedChunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6)
            if (data === '[DONE]') {
              // 流式传输结束
              try {
                const treatmentPlan = JSON.parse(accumulatedData)
                this.setData({
                  'flowData.treatmentPlan': treatmentPlan,
                  isLoading: false
                })
                resolve(treatmentPlan)
              } catch (e) {
                console.error('解析治疗计划JSON失败:', e)
                reject(e)
              }
              return
            }

            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                accumulatedData += parsed.content
                // 实时更新显示内容
                this.setData({
                  'flowData.streamingContent': accumulatedData
                })
              }
              if (parsed.error) {
                reject(new Error(parsed.error))
                return
              }
            } catch (e) {
              console.error('解析流式数据失败:', e)
            }
          }
        }
      })
    })
  },

  // 获取治疗计划 - 兼容旧版本
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

      // 尝试解析JSON格式的治疗计划
      try {
        const treatmentPlan = JSON.parse(response.data.treatmentPlan)
        return treatmentPlan
      } catch (e) {
        // 如果不是JSON格式，返回原始文本
        return response.data.treatmentPlan
      }
    } catch (error) {
      console.error('治疗计划接口调用失败:', error)
      throw error
    }
  },

  // 选择治疗计划目标
  onSelectTreatmentGoal() {
    const goalMessage = {
      id: Date.now(),
      content: '我想走出困境，帮我制定治疗计划',
      role: 'user',
      timestamp: new Date().toLocaleTimeString(),
      step: 6
    }

    const newMessages = [...this.data.messages, goalMessage]
    const updatedFlowData = {
      ...this.data.flowData,
      goalType: 'treatment'
    }

    this.setData({
      messages: newMessages,
      flowData: updatedFlowData,
      showGoalButtons: false
    })

    // 将流程数据传递给治疗计划页面，立即跳转
    const flowDataStr = JSON.stringify(updatedFlowData);
    wx.navigateTo({
      url: `/pages/treatment-plan/treatment-plan?planName=${encodeURIComponent('个性化治疗计划')}&flowData=${encodeURIComponent(flowDataStr)}`
    });
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
      showWelcome: false,
      waitAndSayFlag: true, // 等待并说话标志位
      currentStep: 1, // 重置为第一步，确保智能判断逻辑正常工作
      flowData: { // 重置流程数据
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
      showQuickButtons: false, // 重置快捷按钮状态
      showGoalButtons: false,
      messages: [], // 清空消息历史
      hasAiReply: false // 重置AI回复状态
    })

    // 清空本地存储
    wx.removeStorageSync('chatMessages')
    wx.removeStorageSync('flowData')
    wx.removeStorageSync('currentStep')

    // wx.showToast({
    //   title: '稍后再说',
    //   icon: 'none',
    //   duration: 1500
    // })
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
  async sendMessage() {
    const { inputValue, currentStep, flowData, isSending } = this.data

    // 防抖：如果正在发送，直接返回
    if (isSending) {
      return
    }

    if (!inputValue.trim()) {
      wx.showToast({
        title: '请输入内容',
        icon: 'none'
      })
      return
    }

    // 设置发送状态，防止重复点击
    this.setData({ isSending: true })

    try {

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

      switch (currentStep) {
        case 1: // 问题描述
          updatedFlowData.problemDescription = inputValue
          // 使用AI智能关系分析
          try {
            const analysisResult = await this.analyzeRelationshipType(inputValue)
            if (analysisResult && analysisResult.suggestions && analysisResult.suggestions.length === 1 && analysisResult.confidence > 0.8) {
              // AI识别到明确的关系类型（单个关系且置信度高），直接跳过第二步
              updatedFlowData.relationshipType = analysisResult.suggestions[0]
              nextStep = 3
              showQuickButtons = false
            } else if (analysisResult && analysisResult.suggestions && analysisResult.suggestions.length > 0) {
              // AI有建议关系（多个关系或置信度较低），进入第二步选择
              this.setData({
                aiSuggestedRelationships: analysisResult.suggestions,
                aiAnalysisReasoning: analysisResult.reasoning
              })
              // 更新要显示的关系类型列表
              this.updateRelationshipsToShow()
              // 保存AI推荐的关系类型到本地存储
              wx.setStorageSync('aiSuggestedRelationships', analysisResult.suggestions)
              wx.setStorageSync('aiAnalysisReasoning', analysisResult.reasoning)
              nextStep = 2
              showQuickButtons = true
            } else if (this.checkIfInvolvesOthers(inputValue)) {
              // 涉及他人但AI无法分析，进入第二步选择
              nextStep = 2
              showQuickButtons = true
            } else {
              // 不涉及他人关系，直接跳到第三步
              nextStep = 3
              showQuickButtons = false
            }
          } catch (error) {
            console.error('AI关系分析失败，使用传统逻辑:', error)
            // 降级到原有逻辑
            const detectedRelationType = this.detectRelationshipTypeByKeywords(inputValue)
            if (detectedRelationType && detectedRelationType.relationship) {
              updatedFlowData.relationshipType = detectedRelationType.relationship
              nextStep = 3
              showQuickButtons = false
            } else if (this.checkIfInvolvesOthers(inputValue)) {
              nextStep = 2
              showQuickButtons = true
            } else {
              nextStep = 3
              showQuickButtons = false
            }
          }
          break
        case 2: // 关系类型
          updatedFlowData.relationshipType = inputValue
          nextStep = 3
          showQuickButtons = false
          // 重置多选状态
          this.setData({
            selectedRelationships: [],
            showConfirmButton: false
          })
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
        showQuickButtons: showQuickButtons,
        isSending: false // 重置发送状态
      })

      // 保存消息到本地存储
      wx.setStorageSync('chatMessages', newMessages)
      wx.setStorageSync('flowData', updatedFlowData)
      wx.setStorageSync('currentStep', nextStep)
    } catch (error) {
      console.error('发送消息失败:', error)
      wx.showToast({
        title: '发送失败，请重试',
        icon: 'none'
      })
      // 发生错误时重置发送状态
      this.setData({ isSending: false })
    }
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
      showGoalButtons: false,
      aiSuggestedRelationships: [], // 重置AI推荐的关系类型
      aiAnalysisReasoning: '', // 重置AI分析原因
      selectedRelationships: [], // 重置已选择的关系类型
      showConfirmButton: false // 重置确认按钮显示状态
    })
    // 清除本地存储的消息和流程数据
    wx.removeStorageSync('chatMessages')
    wx.removeStorageSync('flowData')
    wx.removeStorageSync('currentStep')
    // 清除AI推荐的关系类型数据
    wx.removeStorageSync('aiSuggestedRelationships')
    wx.removeStorageSync('aiAnalysisReasoning')
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

    // 处理治疗计划数据
    let treatmentPlanData = this.data.flowData.treatmentPlan;
    if (typeof treatmentPlanData === 'object') {
      treatmentPlanData = JSON.stringify(treatmentPlanData);
    }

    // 跳转到治疗计划详情页
    wx.navigateTo({
      url: `/pages/treatment-plan/treatment-plan?planName=${encodeURIComponent(this.data.planName)}&treatmentPlan=${encodeURIComponent(treatmentPlanData)}`
    });
  },

  // 抽屉菜单项点击事件
  onDrawerItemTap(e) {
    const type = e.detail.type
    console.log('抽屉菜单项被点击:', type)

    switch (type) {
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