// index.js
// 获取应用实例
const app = getApp()

Page({
  data: {
    showDrawer: false, // 控制抽屉显示状态
    hasProfile: false, // 控制是否已填写个人资料
    showWelcome: true, // 控制欢迎界面显示状态
    userProfile: {} // 用户资料信息
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
    console.log('输入内容:', e.detail.value)
  },

  // 跳转到档案页面
  goToProfile() {
    wx.navigateTo({
      url: '../profile/profile'
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