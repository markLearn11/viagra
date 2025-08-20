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
    hasAiReply: false // 是否已有AI回复
  },

  onLoad() {
    // 页面加载时的逻辑
    console.log('栖溯心理首页加载完成')
    this.checkProfileStatus()
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
  async sendMessage() {
    const { inputValue, sessionId } = this.data
    
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
      timestamp: new Date().toLocaleTimeString()
    }

    this.setData({
      messages: [...this.data.messages, userMessage],
      inputValue: '',
      isLoading: true
    })

    try {
      // 如果没有会话ID，先创建会话
      let currentSessionId = sessionId
      if (!currentSessionId) {
        currentSessionId = await this.createChatSession()
        this.setData({ sessionId: currentSessionId })
      }

      // 调用AI接口
      const response = await request({
        url: '/api/chat/ai-chat',
        method: 'POST',
        data: {
          session_id: currentSessionId,
          message: inputValue,
          character_id: null // 可以根据需要设置角色ID
        }
      })

      // 添加AI回复到聊天列表
      const aiMessage = {
        id: Date.now() + 1,
        content: response.data.reply,
        role: 'assistant',
        timestamp: new Date().toLocaleTimeString()
      }

      this.setData({
        messages: [...this.data.messages, aiMessage],
        isLoading: false,
        hasAiReply: true // 标记已有AI回复
      })

    } catch (error) {
      console.error('发送消息失败:', error)
      wx.showToast({
        title: '发送失败，请重试',
        icon: 'none'
      })
      this.setData({ isLoading: false })
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
      hasAiReply: false // 重置AI回复状态
    })
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