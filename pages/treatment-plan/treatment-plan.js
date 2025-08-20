Page({
  data: {
    planName: '',
    treatmentPlan: ''
  },

  onLoad(options) {
    const { planName, treatmentPlan } = options;
    this.setData({
      planName: decodeURIComponent(planName || ''),
      treatmentPlan: decodeURIComponent(treatmentPlan || '')
    });
  },

  // 返回上一页
  onBack() {
    wx.navigateBack();
  },

  // 查看今日计划
  onViewTodayPlan() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  }
});