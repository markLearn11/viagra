// pages/chat-history/chat-history.js
Page({
  data: {
    chatList: [
      {
        id: 1,
        name: '妈妈',
        tag: '母女',
        tagColor: '#8B5CF6',
        status: '计划进行中',
        statusColor: '#F97316',
        lastTime: '2025.07.03  16:30',
        avatar: '/static/images/avatar-mom.svg'
      },
      {
        id: 2,
        name: '小张',
        tag: '同学',
        tagColor: '#8B5CF6',
        status: '需要关注',
        statusColor: '#EAB308',
        lastTime: '2025.07.03  16:30',
        avatar: '/static/images/avatar-zhang.svg'
      }
    ]
  },

  onLoad() {
    console.log('聊天记录页面加载完成')
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 右侧图标点击事件
  onRightIconTap() {
    wx.showActionSheet({
      itemList: ['清空聊天记录', '导出聊天记录'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.showModal({
            title: '确认清空',
            content: '确定要清空所有聊天记录吗？此操作不可恢复。',
            success: (modalRes) => {
              if (modalRes.confirm) {
                this.setData({
                  chatList: []
                })
                wx.showToast({
                  title: '已清空聊天记录',
                  icon: 'success'
                })
              }
            }
          })
        } else if (res.tapIndex === 1) {
          wx.showToast({
            title: '导出功能开发中',
            icon: 'none'
          })
        }
      }
    })
  },

  // 打开聊天详情
  openChat(e) {
    const chatId = e.currentTarget.dataset.id
    const chatItem = this.data.chatList.find(item => item.id === chatId)
    
    wx.showToast({
      title: `打开与${chatItem.name}的聊天`,
      icon: 'none'
    })
    
    // 这里可以跳转到具体的聊天详情页面
    // wx.navigateTo({
    //   url: `../chat-detail/chat-detail?id=${chatId}`
    // })
  }
})