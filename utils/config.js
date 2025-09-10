// config.js - 应用配置文件
const BASE_URL = 'http://localhost:8000'; // 开发环境
// const BASE_URL = 'https://yourdomain.com'; // 生产环境

/**
 * 获取存储的token
 * @returns {string|null} token
 */
function getToken() {
  return wx.getStorageSync('token');
}

/**
 * 构建请求头
 * @param {boolean} requireAuth - 是否需要认证
 * @returns {Object} 请求头对象
 */
function buildHeaders(requireAuth = false) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (requireAuth) {
    const token = getToken();
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
function request(options) {
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
    ...buildHeaders(requireAuth),
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
  getToken
};