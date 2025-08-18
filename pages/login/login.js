// login.js
const { request } = require('../../utils/config.js')

Page({
  data: {
    loading: false
  },

  onLoad() {
    console.log('登录页面加载完成')
    // 检查是否已经登录
    this.checkLoginStatus()
  },

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token')
    const userInfo = wx.getStorageSync('userInfo')
    
    if (token && userInfo) {
      // 已登录，直接跳转到首页
      wx.switchTab({
        url: '/pages/index/index'
      })
    }
  },

  // 微信登录（临时跳转版本）
  wechatLogin() {
    wx.redirectTo({
      url: '/pages/index/index'
    })
  },
  // 微信授权登录
  wechatLogin1() {
    const { loading } = this.data
    
    if (loading) {
      return
    }

    this.setData({
      loading: true
    })

    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        console.log('获取用户信息成功', res.userInfo)
        
        // 获取微信登录code
        wx.login({
          success: (loginRes) => {
            if (loginRes.code) {
              this.requestWechatLogin(loginRes.code, res.userInfo)
            } else {
              this.setData({ loading: false })
              wx.showToast({
                title: '微信登录失败',
                icon: 'none'
              })
            }
          },
          fail: () => {
            this.setData({ loading: false })
            wx.showToast({
              title: '获取登录凭证失败',
              icon: 'none'
            })
          }
        })
      },
      fail: () => {
        this.setData({ loading: false })
        wx.showToast({
          title: '需要授权才能登录',
          icon: 'none'
        })
      }
    })
  },

  // 微信登录请求
  async requestWechatLogin(code, userInfo) {
    try {
      const res = await request({
        url: '/api/auth/wechat-login',
        method: 'POST',
        data: {
          code: code,
          userInfo: userInfo
        }
      })
      
      const { token, user } = res.data
      
      // 保存用户信息和token
      wx.setStorageSync('token', token)
      wx.setStorageSync('userInfo', user)
      
      wx.showToast({
        title: '登录成功',
        icon: 'success'
      })
      
      // 跳转到首页
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }, 1500)
      
    } catch (error) {
      console.error('微信登录失败:', error)
      wx.showToast({
        title: error.data?.message || '登录失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({
        loading: false
      })
    }
  }
})