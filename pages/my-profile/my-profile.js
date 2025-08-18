// pages/my-profile/my-profile.js
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
    }
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
  }
})