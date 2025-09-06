// pages/my-profile/my-profile.js
const { base64 } = require('../../utils/util')
const { authApi } = require('../../utils/api')

Page({
  data: {
    userInfo: {
      name: '小瓶',
      avatar: '/static/images/user-avatar.svg',
      tags: [
        { text: '射手座', color: '#8B5CF6' },
        { text: '心理师', color: '#10B981' },
        { text: '我很棒呀自己', color: '#febf00' }
      ],
      stats: {
        days: 8,
        plans: 2,
        achievements: 5
      }
    },
    showPrivacyModal: false
  },

  onLoad() {
    console.log('我的页面加载完成')
    this.initWechatLogin()
    this.checkUserLoginStatus()
  },

  // 返回首页
  goBack() {
    wx.reLaunch({
      url: '/pages/index/index'
    })
  },

  // 跳转到计划页面
  goToPlan() {
    wx.navigateTo({
      url: '/pages/plan/plan'
    })
  },

  // 右侧图标点击事件
  onRightIconTap() {
    wx.showActionSheet({
      itemList: ['编辑资料', '设置', '退出登录'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.showToast({
            title: '编辑资料功能开发中',
            icon: 'none'
          })
        } else if (res.tapIndex === 1) {
          wx.showToast({
            title: '设置功能开发中',
            icon: 'none'
          })
        } else if (res.tapIndex === 2) {
          this.handleLogout()
        }
      }
    })
  },

  // 功能项点击事件
  onFunctionTap(e) {
    const type = e.currentTarget.dataset.type
    console.log('功能项被点击:', type)
    
    switch(type) {
      case 'self-understanding':
        wx.showToast({
          title: '我与自己的和解功能开发中',
          icon: 'none'
        })
        break
      case 'understanding-plan':
        wx.showToast({
          title: '我的和解计划功能开发中',
          icon: 'none'
        })
        break
    }
  },

  // 其他功能项点击事件
  onOtherTap(e) {
    const type = e.currentTarget.dataset.type
    console.log('其他功能项被点击:', type)
    
    switch(type) {
      case 'mbti':
        wx.showToast({
          title: 'MBTI性格测试功能开发中',
          icon: 'none'
        })
        break
      case 'tree-hole':
        wx.showToast({
          title: '我的树洞功能开发中',
          icon: 'none'
        })
        break
      case 'character':
        wx.showToast({
          title: '角色功能开发中',
          icon: 'none'
        })
        break
    }
  },

  // 授权获取手机号
  getPhoneNumber(e) {
    console.log('getPhoneNumber', e)
    if(e.detail.code){
      // 显示隐私条款弹窗
      this.setData({
        showPrivacyModal: true
      })
      
      // 保存授权信息
      this.setData({
        phoneAuthData: {
          encryptedData: e.detail.encryptedData,
          iv: e.detail.iv,
          code: e.detail.code
        }
      })
    }
  },

  // 同意隐私条款
  agreePrivacy() {
    this.setData({
      showPrivacyModal: false
    })
    
    // 处理手机号授权
    if (this.data.phoneAuthData) {
      let encryptedData = this.data.phoneAuthData.encryptedData
      let iv = this.data.phoneAuthData.iv
      var result = base64.CusBASE64.encoder(iv)
      var mobresult = base64.CusBASE64.encoder(encryptedData)
      var code = this.data.phoneAuthData.code
      
      // console.log('mobresult', mobresult)
      // console.log('result', result)
      this.bindPhoneFun(mobresult, result)
      
      // 移除这里的成功提示，在bindPhoneFun中处理
    }
  },

  // 不同意隐私条款
  disagreePrivacy() {
    this.setData({
      showPrivacyModal: false
    })
    
    wx.showToast({
      title: '已取消授权',
      icon: 'none'
    })
  },

  // 打开隐私保护指引页面
  openPrivacyPolicy() {
    wx.navigateTo({
      url: '/pages/privacy-policy/privacy-policy'
    })
  },

  // 打开用户协议页面
  openUserAgreement() {
    wx.navigateTo({
      url: '/pages/user-agreement/user-agreement'
    })
  },

  // 初始化微信登录
  initWechatLogin() {
    wx.login({
      success: (res) => {
        if (res.code) {
          // 缓存微信登录code
          wx.setStorageSync('wechat_code', res.code)
          console.log('微信登录code获取成功:', res.code)
        } else {
          console.error('微信登录code获取失败:', res.errMsg)
        }
      },
      fail: (error) => {
        console.error('微信登录失败:', error)
      }
    })
  },

  // 检查用户登录状态
  checkUserLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo')
    const token = wx.getStorageSync('token')
    
    if (userInfo && token) {
      // 用户已登录，更新页面显示
      this.setData({
        'userInfo.name': userInfo.nickname || '小瓶',
        'userInfo.phone': userInfo.phone || '',
        'userInfo.avatar': userInfo.avatar_url || '/static/images/user-avatar.svg'
      })
      console.log('用户已登录:', userInfo)
    } else {
      console.log('用户未登录')
    }
  },

   // 处理退出登录
   handleLogout() {
     wx.showModal({
       title: '确认退出',
       content: '确定要退出登录吗？',
       success: (modalRes) => {
         if (modalRes.confirm) {
           // 清除本地存储
           wx.removeStorageSync('userInfo')
           wx.removeStorageSync('token')
           wx.removeStorageSync('wechat_code')
           
           // 重置页面数据
           this.setData({
             'userInfo.name': '小瓶',
             'userInfo.phone': '',
             'userInfo.avatar': '/static/images/user-avatar.svg'
           })
           
           // 重新初始化微信登录
           this.initWechatLogin()
           
           wx.showToast({
             title: '已退出登录',
             icon: 'success'
           })
         }
       }
     })
   },

   // 微信登录
   async handleWechatLogin() {
     try {
       wx.showLoading({
         title: '正在登录...'
       })
       
       // 获取用户信息授权
       const userProfile = await this.getUserProfile()
       
       // 获取微信登录code
       const wechatCode = wx.getStorageSync('wechat_code')
       if (!wechatCode) {
         throw new Error('微信登录code已过期，请重新进入页面')
       }
       
       // 调用微信登录接口
       const response = await authApi.wechatLogin(wechatCode, userProfile)
       
       wx.hideLoading()
       
       if (response.success && response.data) {
         // 保存用户信息和token
         wx.setStorageSync('userInfo', response.data.user)
         wx.setStorageSync('token', response.data.token)
         
         // 更新页面显示
         this.setData({
           'userInfo.name': response.data.user.nickname || '小瓶',
           'userInfo.phone': response.data.user.phone || '',
           'userInfo.avatar': response.data.user.avatar_url || '/static/images/user-avatar.svg'
         })
         
         wx.showToast({
           title: '登录成功',
           icon: 'success'
         })
         
         console.log('微信登录成功:', response.data)
       } else {
         throw new Error(response.message || '登录失败')
       }
     } catch (error) {
       wx.hideLoading()
       console.error('微信登录失败:', error)
       
       wx.showModal({
         title: '登录失败',
         content: error.message || '登录失败，请重试',
         showCancel: false,
         confirmText: '确定'
       })
     }
   },

   // 获取用户信息
   getUserProfile() {
     return new Promise((resolve, reject) => {
       wx.getUserProfile({
         desc: '用于完善用户资料',
         success: (res) => {
           resolve(res.userInfo)
         },
         fail: (error) => {
           reject(new Error('用户取消授权'))
         }
       })
     })
   },

   // 绑定手机号
  async bindPhoneFun(encryptedData, iv) {
    try {
      wx.showLoading({
        title: '正在绑定手机号...'
      })
      
      // 获取缓存的微信登录code
      const wechatCode = wx.getStorageSync('wechat_code')
      if (!wechatCode) {
        throw new Error('微信登录code已过期，请重新进入页面')
      }
      
      // 调用手机号解密接口
      const response = await authApi.decryptPhone(wechatCode, encryptedData, iv)
      
      wx.hideLoading()
      
      if (response.success && response.data) {
        // 保存用户信息和token
        wx.setStorageSync('userInfo', response.data.user)
        wx.setStorageSync('token', response.data.token)
        
        // 更新页面用户信息
        this.setData({
          'userInfo.name': response.data.user.nickname || '小瓶',
          'userInfo.phone': response.data.user.phone
        })
        
        wx.showToast({
          title: '手机号绑定成功',
          icon: 'success',
          duration: 2000
        })
        
        console.log('手机号绑定成功:', response.data)
      } else {
        throw new Error(response.message || '手机号绑定失败')
      }
    } catch (error) {
      wx.hideLoading()
      console.error('手机号绑定失败:', error)
      
      wx.showModal({
        title: '绑定失败',
        content: error.message || '手机号绑定失败，请重试',
        showCancel: false,
        confirmText: '确定'
      })
    }
  },
})