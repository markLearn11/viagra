// pages/settings/settings.js
const { authApi } = require("../../utils/api.js");
const { clearTokenInfo } = require("../../utils/config.js");

Page({
  data: {
    // 页面数据
  },
  onUserAgreementTap() {
    wx.navigateTo({
      url: "/pages/user-agreement/user-agreement",
    });
  },
  onPrivacyPolicyTap() {
     wx.navigateTo({
      url: "/pages/privacy-policy/privacy-policy",
    });
  },
  goBack() {
    wx.navigateBack()
  },
  
  // 退出登录
  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success(res) {
        if (res.confirm) {
          // 调用登出接口
          authApi.logout().then(() => {
            // 清除本地存储的所有用户相关数据
            clearTokenInfo();
            wx.removeStorageSync('userInfo');
            wx.removeStorageSync('userId');
            wx.removeStorageSync('userProfile');
            wx.removeStorageSync('token');
            wx.removeStorageSync('chatMessages');
            wx.removeStorageSync('flowData');
            wx.removeStorageSync('currentStep');
            wx.removeStorageSync('aiSuggestedRelationships');
            wx.removeStorageSync('aiAnalysisReasoning');
            wx.removeStorageSync('selectedRelationships');
            wx.removeStorageSync('showConfirmButton');
            wx.removeStorageSync('todayTasks');
            
            // 显示退出成功提示
            wx.showToast({
              title: '退出成功',
              icon: 'success',
              duration: 1500
            });
            
            // 延迟跳转到首页
            setTimeout(() => {
              wx.redirectTo({
                url: '/pages/index/index'
              });
            }, 1500);
          }).catch((error) => {
            console.error('登出失败:', error);
            wx.showToast({
              title: '退出失败',
              icon: 'none',
              duration: 1500
            });
          });
        }
      }
    });
  }

});