// stream-helper.js - 流式请求处理工具函数

/**
 * 处理流式响应数据
 * @param {ArrayBuffer} data - 接收到的数据块
 * @returns {string} 解析后的文本内容
 */
function decodeStreamChunk(data) {
  try {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(data);
  } catch (error) {
    console.error('解码数据块失败:', error);
    return '';
  }
}

/**
 * 解析SSE格式的行数据
 * @param {string} line - SSE格式的行数据
 * @returns {string|null} 解析后的内容，如果是[DONE]则返回null
 */
function parseSSELine(line) {
  console.log('解析SSE行:', line); // 添加调试日志
  
  if (!line.startsWith('data: ')) {
    return '';
  }
  
  const content = line.substring(6);
  if (content === '[DONE]') {
    return null; // 表示流结束
  }
  
  // 尝试解析JSON格式的内容
  try {
    const parsed = JSON.parse(content);
    console.log('解析JSON内容:', parsed);
    
    // 过滤掉系统消息类型
    if (parsed.type === 'session_id' || 
        parsed.type === 'message_id' || 
        parsed.type === 'done') {
      console.log('过滤系统消息:', parsed.type);
      return ''; // 返回空字符串，不显示这些消息
    }
    
    // 根据不同的数据结构提取文本内容
    if (parsed.content) {
      return parsed.content;
    } else if (parsed.message) {
      return parsed.message;
    } else if (parsed.text) {
      return parsed.text;
    } else if (parsed.data) {
      return parsed.data;
    } else if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
      // OpenAI格式
      return parsed.choices[0].delta.content;
    } else {
      // 如果无法提取文本内容，返回原始内容
      return content;
    }
  } catch (error) {
    // 如果不是JSON格式，直接返回内容
    console.log('非JSON格式内容:', content);
    return content;
  }
}

/**
 * 创建流式请求处理器
 * @param {Object} options - 配置选项
 * @param {string} options.url - 请求URL
 * @param {string} options.method - 请求方法，默认为'POST'
 * @param {Object} options.data - 请求数据
 * @param {Object} options.header - 请求头，默认包含'Content-Type': 'application/json'
 * @param {Function} options.onProgress - 进度回调函数，接收当前累积的内容
 * @param {Function} options.onComplete - 完成回调函数，接收最终内容
 * @param {Function} options.onError - 错误回调函数，接收错误信息
 * @returns {Promise<string>} 返回最终的完整内容
 */
function createStreamRequest(options) {
  return new Promise((resolve, reject) => {
    let accumulatedContent = '';
    
    const requestTask = wx.request({
      url: options.url,
      method: options.method || 'POST',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        ...(options.header || {})
      },
      enableChunked: true, // 启用分块传输
      success: (response) => {
        // 处理完整响应（通常不会走到这里，因为流式请求会通过onChunkReceived处理）
        if (response.data && typeof response.data === 'string') {
          const lines = response.data.split('\n');
          
          for (let line of lines) {
            const content = parseSSELine(line);
            if (content === null) {
              // 流结束
              if (options.onComplete) options.onComplete(accumulatedContent);
              resolve(accumulatedContent);
              return;
            } else if (content) {
              accumulatedContent += content;
              if (options.onProgress) options.onProgress(accumulatedContent);
            }
          }
        }
        
        // 如果没有收到[DONE]标记，也返回结果
        if (options.onComplete) options.onComplete(accumulatedContent);
        resolve(accumulatedContent);
      },
      fail: (error) => {
        console.error('流式请求失败:', error);
        if (options.onError) options.onError(error);
        reject(error);
      }
    });
    
    // 监听数据流
    requestTask.onChunkReceived((res) => {
      try {
        // 解码数据块
        const chunk = decodeStreamChunk(res.data);
        
        // 处理SSE格式数据
        const lines = chunk.split('\n');
        
        for (let line of lines) {
          const content = parseSSELine(line);
          if (content === null) {
            // 流结束
            if (options.onComplete) options.onComplete(accumulatedContent);
            resolve(accumulatedContent);
            return;
          } else if (content) {
            accumulatedContent += content;
            if (options.onProgress) options.onProgress(accumulatedContent);
          }
        }
      } catch (error) {
        console.error('处理数据块失败:', error);
        if (options.onError) options.onError(error);
      }
    });
  });
}

module.exports = {
  decodeStreamChunk,
  parseSSELine,
  createStreamRequest
};