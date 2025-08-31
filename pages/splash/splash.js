// pages/splash/splash.js
Page({
  data: {
    showContent: false,
    animationClass: '',
    countdown: 5
  },

  onLoad() {
    console.log('开屏页面加载完成')
    
    // 延迟显示内容，创建开屏动画效果
    setTimeout(() => {
      this.setData({
        showContent: true,
        animationClass: 'fade-in'
      })
    }, 300)
    
    // 开始倒计时
    this.startCountdown()
  },

  // 跳转到下一页面
  navigateToNext() {
    wx.redirectTo({
        url: '/pages/index/index'
      })
  },

  // 点击跳过
  onSkip() {
    this.navigateToNext()
  },

  // 点击立即体验
  onExperience() {
    this.navigateToNext()
  },

  // 开始倒计时
  startCountdown() {
    const timer = setInterval(() => {
      const countdown = this.data.countdown - 1
      this.setData({ countdown })
      
      if (countdown <= 0) {
        clearInterval(timer)
        this.navigateToNext()
      }
    }, 1000)
  }
})