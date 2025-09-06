// auth-helper.js
// 用户登录状态检查和相关工具函数

/**
 * 检查用户是否已登录
 * @returns {boolean} 是否已登录
 */
function isUserLoggedIn() {
  // 检查本地存储中是否有用户信息和token
  const userInfo = wx.getStorageSync('userInfo');
  const token = wx.getStorageSync('token');
  
  return !!(userInfo && userInfo.id && token);
}

/**
 * 检查登录状态并提示登录
 * @param {boolean} showToast 是否显示提示，默认为true
 * @returns {boolean} 是否已登录
 */
function checkLoginStatus(showToast = true) {
  const isLoggedIn = isUserLoggedIn();
  
  if (!isLoggedIn && showToast) {
    wx.showToast({
      title: '请先登录',
      icon: 'none',
      duration: 1500
    });
    
    // 延迟跳转到登录页面
    setTimeout(() => {
      wx.navigateTo({
        url: '/pages/my-profile/my-profile'
      });
    }, 1500);
  }
  
  return isLoggedIn;
}

/**
 * 跳转到登录页面
 */
function navigateToLogin() {
  wx.navigateTo({
    url: '/pages/login/login'
  });
}

module.exports = {
  isUserLoggedIn,
  checkLoginStatus,
  navigateToLogin
};