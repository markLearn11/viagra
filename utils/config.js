// config.js - 应用配置文件
// const BASE_URL = 'http://localhost:8000'; // 开发环境
const BASE_URL = 'http://121.196.244.75:8000'; // 生产环境

/**
 * 获取存储的token信息
 * @returns {Object|null} token信息对象
 */
function getTokenInfo() {
  // 首先检查新的tokenInfo存储方式
  const tokenInfo = wx.getStorageSync('tokenInfo');
  console.log('getTokenInfo: tokenInfo from storage:', tokenInfo ? `${tokenInfo.substring(0, 50)}...` : 'null');
  if (tokenInfo) {
    try {
      const parsedTokenInfo = JSON.parse(tokenInfo);
      console.log('getTokenInfo: parsed tokenInfo:', parsedTokenInfo);
      return parsedTokenInfo;
    } catch (e) {
      console.error('getTokenInfo: failed to parse tokenInfo:', e);
    }
  }
  
  // 如果没有tokenInfo，检查旧的token存储方式
  const token = wx.getStorageSync('token');
  const userInfo = wx.getStorageSync('userInfo');
  console.log('getTokenInfo: checking legacy token storage - token:', token ? `${token.substring(0, 10)}...` : 'null', 'userInfo:', userInfo);
  if (token && userInfo) {
    // 尝试从旧的token中提取信息
    try {
      // 如果旧的token是对象格式
      const parsedToken = typeof token === 'string' ? JSON.parse(token) : token;
      const legacyTokenInfo = {
        access_token: parsedToken.access_token || parsedToken.token || token,
        refresh_token: parsedToken.refresh_token || null,
        user: userInfo
      };
      console.log('getTokenInfo: constructed legacy tokenInfo:', legacyTokenInfo);
      return legacyTokenInfo;
    } catch (e) {
      console.error('getTokenInfo: failed to construct legacy tokenInfo:', e);
      // 如果无法解析，直接使用token字符串
      return {
        access_token: token,
        refresh_token: null,
        user: userInfo
      };
    }
  }
  
  console.log('getTokenInfo: no token found');
  return null;
}

/**
 * 存储token信息
 * @param {Object} tokenInfo - token信息对象
 */
function setTokenInfo(tokenInfo) {
  console.log('setTokenInfo: storing tokenInfo:', tokenInfo);
  wx.setStorageSync('tokenInfo', JSON.stringify(tokenInfo));
}

/**
 * 清除token信息
 */
function clearTokenInfo() {
  console.log('clearTokenInfo: clearing token info');
  wx.removeStorageSync('tokenInfo');
  // 同时清除旧的token存储方式
  wx.removeStorageSync('token');
  wx.removeStorageSync('userInfo');
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
    console.log('isTokenExpired: token exp:', payload.exp, 'current time:', currentTime, 'expired:', payload.exp < currentTime);
    return payload.exp < currentTime;
  } catch (e) {
    console.error('isTokenExpired: failed to parse token:', e);
    return true;
  }
}

/**
 * 刷新token
 * @returns {Promise<string|null>} 新的access_token或null
 */
async function refreshToken() {
  const tokenInfo = getTokenInfo();
  console.log('refreshToken: tokenInfo:', tokenInfo);
  if (!tokenInfo || !tokenInfo.refresh_token) {
    console.log('refreshToken: no refresh_token found');
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
          console.log('refreshToken: refresh token response:', res);
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
  console.log('getValidAccessToken: tokenInfo:', tokenInfo);
  if (!tokenInfo || !tokenInfo.access_token) {
    console.log('getValidAccessToken: no access_token found');
    return null;
  }

  // 检查access_token是否过期
  if (isTokenExpired(tokenInfo.access_token)) {
    console.log('getValidAccessToken: access_token expired, trying to refresh');
    // access_token过期，尝试刷新
    return await refreshToken();
  }

  console.log('getValidAccessToken: returning valid access_token');
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
    console.log('buildHeaders: authentication required');
    const token = await getValidAccessToken();
    console.log('buildHeaders: token from getValidAccessToken:', token ? `${token.substring(0, 10)}...` : 'null');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('buildHeaders: Authorization header set');
    } else {
      console.log('buildHeaders: no token available, Authorization header not set');
    }
  } else {
    console.log('buildHeaders: authentication not required');
  }
  
  console.log('buildHeaders: final headers:', headers);
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
  console.log('request: fullUrl:', fullUrl, 'method:', method, 'requireAuth:', requireAuth);

  // 合并默认header和传入的header
  const defaultHeader = {
    ...(await buildHeaders(requireAuth)),
    ...header
  };
  console.log('request: final headers:', defaultHeader);

  return new Promise((resolve, reject) => {
    wx.request({
      url: fullUrl,
      method,
      data,
      header: defaultHeader,
      timeout,
      success(res) {
        console.log('request: success response:', res);
        // 处理成功的响应
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          // 处理错误响应
          reject(new Error(res.data?.detail || `请求失败: ${res.statusCode}`));
        }
      },
      fail(err) {
        console.error('request: fail:', err);
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