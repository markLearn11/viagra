// config.js - 应用配置文件
const BASE_URL = 'http://localhost:8000'; // 开发环境
// const BASE_URL = 'https://yourdomain.com'; // 生产环境

/**
 * 获取存储的token信息
 * @returns {Object|null} token信息对象
 */
function getTokenInfo() {
  const tokenInfo = wx.getStorageSync('tokenInfo');
  return tokenInfo ? JSON.parse(tokenInfo) : null;
}

/**
 * 存储token信息
 * @param {Object} tokenInfo - token信息对象
 */
function setTokenInfo(tokenInfo) {
  wx.setStorageSync('tokenInfo', JSON.stringify(tokenInfo));
}

/**
 * 清除token信息
 */
function clearTokenInfo() {
  wx.removeStorageSync('tokenInfo');
}

/**
 * 检查token是否过期
 * @param {string} token - JWT token
 * @returns {boolean} 是否过期
 */
function isTokenExpired(token) {
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (e) {
    return true;
  }
}

/**
 * 刷新token
 * @returns {Promise<string|null>} 新的access_token或null
 */
async function refreshToken() {
  const tokenInfo = getTokenInfo();
  if (!tokenInfo || !tokenInfo.refresh_token) {
    return null;
  }

  try {
    const response = await new Promise((resolve, reject) => {
      wx.request({
        url: `${BASE_URL}/api/auth/refresh-token`,
        method: 'POST',
        data: {
          refresh_token: tokenInfo.refresh_token
        },
        success(res) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else {
            reject(new Error(res.data?.detail || `刷新token失败: ${res.statusCode}`));
          }
        },
        fail(err) {
          reject(new Error(`网络错误: ${err.errMsg}`));
        }
      });
    });

    // 更新存储的token信息
    setTokenInfo({
      access_token: response.access_token,
      refresh_token: response.refresh_token,
      user: response.user
    });

    // 同时更新userId
    if (response.user && response.user.id) {
      wx.setStorageSync('userId', response.user.id);
    }

    return response.access_token;
  } catch (error) {
    console.error('刷新token失败:', error);
    // 刷新失败，清除token信息
    clearTokenInfo();
    return null;
  }
}

/**
 * 获取有效的access_token
 * @returns {Promise<string|null>} 有效的access_token或null
 */
async function getValidAccessToken() {
  const tokenInfo = getTokenInfo();
  if (!tokenInfo || !tokenInfo.access_token) {
    return null;
  }

  // 检查access_token是否过期
  if (isTokenExpired(tokenInfo.access_token)) {
    // access_token过期，尝试刷新
    return await refreshToken();
  }

  return tokenInfo.access_token;
}

/**
 * 构建请求头
 * @param {boolean} requireAuth - 是否需要认证
 * @returns {Promise<Object>} 请求头对象
 */
async function buildHeaders(requireAuth = false) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (requireAuth) {
    const token = await getValidAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  return headers;
}

/**
 * 构建完整的API URL
 * @param {string} path - API路径
 * @returns {string} 完整的API URL
 */
function buildApiUrl(path) {
  // 确保路径以 / 开头
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  return BASE_URL + path;
}

/**
 * 统一请求封装
 * @param {Object} options - 请求选项
 * @returns {Promise} 请求Promise
 */
async function request(options) {
  const {
    url,
    method = 'GET',
    data = {},
    header = {},
    requireAuth = false, // 新增参数，控制是否需要认证
    timeout = 15000,
    onProgress
  } = options;

  // 构建完整URL
  const fullUrl = url.startsWith('http') ? url : buildApiUrl(url);

  // 合并默认header和传入的header
  const defaultHeader = {
    ...(await buildHeaders(requireAuth)),
    ...header
  };

  return new Promise((resolve, reject) => {
    wx.request({
      url: fullUrl,
      method,
      data,
      header: defaultHeader,
      timeout,
      success(res) {
        // 处理成功的响应
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          // 处理错误响应
          reject(new Error(res.data?.detail || `请求失败: ${res.statusCode}`));
        }
      },
      fail(err) {
        // 处理网络错误
        reject(new Error(`网络错误: ${err.errMsg}`));
      }
    });
  });
}

module.exports = {
  BASE_URL,
  buildApiUrl,
  request,
  getTokenInfo,
  setTokenInfo,
  clearTokenInfo,
  getValidAccessToken
};