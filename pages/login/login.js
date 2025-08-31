// login.js
const { request } = require('../../utils/config.js')

Page({
  data: {
    loading: false
  },

  onLoad() {
    console.log('登录页面加载完成')
  },

  // 微信登录（临时跳转版本）
  wechatLogin() {
    // 设置临时用户信息，确保其他页面能正常工作
    const tempUserInfo = {
      id: 1, // 临时用户ID
      openid: 'temp_openid_' + Date.now(),
      nickname: '临时用户',
      avatar_url: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true
    }
    
    // 保存到本地存储
    wx.setStorageSync('userInfo', tempUserInfo)
    wx.setStorageSync('token', 'temp_token_' + Date.now())
    
    wx.showToast({
      title: '登录成功',
      icon: 'success',
      duration: 1000
    })
    
    setTimeout(() => {
      wx.redirectTo({
        url: '/pages/index/index'
      })
    }, 1000)
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