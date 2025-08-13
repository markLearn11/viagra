// index.js
// 获取应用实例
const app = getApp()

Page({
  data: {
    // 页面数据
  },

  onLoad() {
    // 页面加载时的逻辑
    console.log('栖溯心理首页加载完成')
  },

  // 跳过认识环节
  onSkip() {
    wx.showToast({
      title: '稍后再说',
      icon: 'none',
      duration: 1500
    })
    // 可以跳转到主功能页面或保持当前页面
  },

  // 开始认识流程
  onStart() {
    wx.showToast({
      title: '开始认识流程',
      icon: 'success',
      duration: 1500
    })
    // 这里可以跳转到认识流程页面
    // wx.navigateTo({
    //   url: '../profile/profile'
    // })
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

  // 跳转到我的档案页面
  goToProfile() {
    wx.navigateTo({
      url: '../profile/profile'
    })
  }
})