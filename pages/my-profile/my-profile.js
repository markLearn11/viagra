// pages/my-profile/my-profile.js
const { base64 } = require('../../utils/util')

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
  },

  // 返回首页
  goBack() {
    wx.reLaunch({
      url: '/pages/index/index'
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
          wx.showModal({
            title: '确认退出',
            content: '确定要退出登录吗？',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.showToast({
                  title: '已退出登录',
                  icon: 'success'
                })
              }
            }
          })
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
      // this.bindPhoneFun(mobresult, result)
      
      wx.showToast({
        title: '授权成功',
        icon: 'success'
      })
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

// bindPhoneFun: function(encryptedData, iv) {
//     // codestr ： wx.login返回的code码，可以在wx.login方法进行缓存，然后在授权页面获取缓存
//     wx.getStorage({
//       key: 'regcode',
//       success: function (res) {
//         let codestr = res.data;
//         wx.request({
//           url: 'http://localhost:8000/api/auth/decrypt-phone',
//           method: 'POST',
//           header: {
//             'content-type': 'application/json'
//           },
//           data: {
//             code: codestr,
//             encrypted_data: encryptedData,
//             iv: iv
//           },
//           success: function (response) {
//             console.log('手机号解密成功:', response.data);
//             if (response.data && response.data.pure_phone_number) {
//               // 保存手机号到本地存储
//               wx.setStorageSync('user_phone', response.data.pure_phone_number);
              
//               // 显示成功提示
//               wx.showToast({
//                 title: '手机号授权成功',
//                 icon: 'success',
//                 duration: 2000
//               });
              
//               // 可以在这里更新页面显示或执行其他逻辑
//               // 例如：刷新用户信息
//             }
//           },
//           fail: function (error) {
//             console.error('手机号解密失败:', error);
//             wx.showToast({
//               title: '手机号授权失败',
//               icon: 'error',
//               duration: 2000
//             });
//           }
//         });
//       },
//       fail: function (error) {
//         console.error('获取登录code失败:', error);
//         wx.showToast({
//           title: '请先登录',
//           icon: 'error',
//           duration: 2000
//         });
//       }
//      });
//    },
})