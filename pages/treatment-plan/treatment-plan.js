Page({
  data: {
    planName: '',
    treatmentPlan: '',
    parsedPlan: null,
    isLoading: false,
    streamingContent: '',
    flowData: null
  },

  onLoad(options) {
    const { planName, treatmentPlan, flowData } = options;
    
    // 如果有treatmentPlan参数，说明是旧的调用方式
    if (treatmentPlan) {
      const decodedPlan = decodeURIComponent(treatmentPlan || '');
      this.setData({
        planName: decodeURIComponent(planName || ''),
        treatmentPlan: decodedPlan,
        parsedPlan: null
      });
    }
    // 如果有flowData参数，说明需要在这里获取治疗计划
    else if (flowData) {
      try {
        const decodedFlowData = JSON.parse(decodeURIComponent(flowData));
        this.setData({
          planName: decodeURIComponent(planName || ''),
          flowData: decodedFlowData,
          isLoading: true,
          streamingContent: '正在为您生成个性化治疗计划...'
        });
        
        // 开始获取治疗计划
        this.getTreatmentPlan(decodedFlowData);
      } catch (error) {
        console.error('解析flowData失败:', error);
        this.setData({
          treatmentPlan: '获取治疗计划失败，请重试',
          isLoading: false
        });
      }
    }
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
  },

  // 从flowData构建prompt
  buildPromptFromFlowData(flowData) {
    let prompt = '请为我制定一个个性化的心理治疗计划。\n\n';
    
    if (flowData.userInfo) {
      prompt += '用户信息：\n';
      Object.keys(flowData.userInfo).forEach(key => {
        if (flowData.userInfo[key]) {
          prompt += `${key}: ${flowData.userInfo[key]}\n`;
        }
      });
      prompt += '\n';
    }
    
    if (flowData.messages && flowData.messages.length > 0) {
      prompt += '对话历史：\n';
      flowData.messages.forEach((msg, index) => {
        prompt += `${index + 1}. ${msg.role}: ${msg.content}\n`;
      });
      prompt += '\n';
    }
    
    if (flowData.analysis) {
      prompt += `心理分析结果：${flowData.analysis}\n\n`;
    }
    
    prompt += '请基于以上信息，为我制定一个详细的1个月心理治疗计划。';
    
    return prompt;
  },

  // 获取治疗计划的方法
  async getTreatmentPlan(flowData) {
    try {
      // 构建请求数据
      const requestData = {
        prompt: this.buildPromptFromFlowData(flowData),
        flowData: flowData
      };
      
      // 首先尝试流式API
      const streamResponse = await this.getTreatmentPlanStream(requestData);
      if (streamResponse) {
        return;
      }
      
      // 如果流式API失败，使用普通API
      const response = await this.getTreatmentPlanNormal(requestData);
      if (response && response.data && response.data.treatment_plan) {
        const treatmentPlan = response.data.treatment_plan;
        let formattedPlan = '';
        
        if (typeof treatmentPlan === 'object') {
          // 格式化对象为可读文本
          if (treatmentPlan.weekly_plan) {
            formattedPlan += '## 每周治疗计划\n\n';
            treatmentPlan.weekly_plan.forEach((week, index) => {
              formattedPlan += `### 第${index + 1}周: ${week.title || ''}\n`;
              if (week.tasks && Array.isArray(week.tasks)) {
                week.tasks.forEach(task => {
                  formattedPlan += `• ${task}\n`;
                });
              }
              formattedPlan += '\n';
            });
          }
          
          if (treatmentPlan.daily_practices) {
            formattedPlan += '## 日常练习\n\n';
            treatmentPlan.daily_practices.forEach(practice => {
              formattedPlan += `✓ ${practice}\n`;
            });
          }
          
          if (!formattedPlan) {
            formattedPlan = JSON.stringify(treatmentPlan, null, 2);
          }
        } else {
          formattedPlan = treatmentPlan;
        }
        
        this.setData({
          treatmentPlan: formattedPlan,
          isLoading: false,
          streamingContent: ''
        });
      } else {
        throw new Error('获取治疗计划失败');
      }
    } catch (error) {
      console.error('获取治疗计划失败:', error);
      this.setData({
        treatmentPlan: '获取治疗计划失败，请重试',
        isLoading: false,
        streamingContent: ''
      });
    }
  },

  // 流式获取治疗计划
  async getTreatmentPlanStream(requestData) {
    return new Promise((resolve) => {
      try {
        const requestTask = wx.request({
          url: 'http://127.0.0.1:8000/api/chat/treatment-stream',
          method: 'POST',
          data: requestData,
          enableChunked: true,
          success: (res) => {
            console.log('流式请求成功:', res);
            resolve(true);
          },
          fail: (error) => {
            console.error('流式请求失败:', error);
            resolve(false);
          }
        });
        
        // 监听数据流
        requestTask.onChunkReceived((res) => {
          try {
            // 将ArrayBuffer转换为字符串
            const uint8Array = new Uint8Array(res.data);
            let rawChunk = '';
            
            // 使用TextDecoder处理UTF-8编码
            try {
              const decoder = new TextDecoder('utf-8');
              rawChunk = decoder.decode(uint8Array);
            } catch (e) {
              // 如果TextDecoder不可用，使用备用方法
              rawChunk = String.fromCharCode.apply(null, uint8Array);
            }
            
            // 处理流式数据格式：data: {"content": "内容"}\n\n
            const lines = rawChunk.split('\n');
            let content = '';
            
            for (let line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6); // 移除 "data: " 前缀
                if (jsonStr === '[DONE]') {
                  // 流结束标记
                  break;
                }
                try {
                  const data = JSON.parse(jsonStr);
                  if (data.content) {
                    content += data.content;
                  } else if (data.error) {
                    console.error('流式数据错误:', data.error);
                  }
                } catch (parseError) {
                  console.warn('解析JSON失败:', parseError, 'JSON字符串:', jsonStr);
                }
              }
            }
            
            // 更新流式内容
            if (content) {
              this.setData({
                streamingContent: this.data.streamingContent + content
              });
            }
          } catch (error) {
            console.error('处理流式数据失败:', error);
          }
        });
        
        // 监听流结束
        requestTask.onHeadersReceived(() => {
          setTimeout(() => {
            this.setData({
              treatmentPlan: this.data.streamingContent,
              isLoading: false,
              streamingContent: ''
            });
            resolve(true);
          }, 1000);
        });
        
      } catch (error) {
        console.error('创建流式请求失败:', error);
        resolve(false);
      }
    });
  },

  // 普通API获取治疗计划
  async getTreatmentPlanNormal(requestData) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: 'http://127.0.0.1:8000/api/chat/treatment',
        method: 'POST',
        data: requestData,
        success: resolve,
        fail: reject
      });
    });
  }
});