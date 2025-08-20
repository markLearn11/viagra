// config.js - 应用配置文件

// API配置
const API_CONFIG = {
  // 开发环境 - 使用localhost（需要在开发者工具中关闭域名校验）
  development: {
    baseURL: 'http://localhost:8000', // 开发环境使用localhost
    timeout: 60000  // 增加到60秒，适应AI请求
  },
  // 生产环境
  production: {
    baseURL: 'https://your-domain.com', // 替换为实际的生产域名
    timeout: 60000  // 增加到60秒，适应AI请求
  }
}

// 获取当前环境
function getCurrentEnv() {
  // 可以通过版本号或其他方式判断环境
  const accountInfo = wx.getAccountInfoSync()
  return accountInfo.miniProgram.envVersion === 'release' ? 'production' : 'development'
}

// 获取API配置
function getApiConfig() {
  const env = getCurrentEnv()
  return API_CONFIG[env]
}

// 构建完整的API URL
function buildApiUrl(path) {
  const config = getApiConfig()
  // 如果baseURL为空，直接返回路径（相对路径）
  if (!config.baseURL) {
    return path
  }
  return config.baseURL + path
}

// 封装网络请求
function request(options) {
  const config = getApiConfig()
  
  return new Promise((resolve, reject) => {
    wx.request({
      url: buildApiUrl(options.url),
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        ...options.header
      },
      timeout: options.timeout || config.timeout,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res)
        } else {
          reject(res)
        }
      },
      fail: (err) => {
        console.error('网络请求失败:', err)
        reject(err)
      }
    })
  })
}

// 导出配置和工具函数
module.exports = {
  API_CONFIG,
  getCurrentEnv,
  getApiConfig,
  buildApiUrl,
  request
}