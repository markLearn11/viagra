Page({
  data: {
    planName: '',
    treatmentPlan: '',
    parsedPlan: null,
    isLoading: false,
    streamingContent: '',
    flowData: null,
    isStreaming: false,
    streamingParsedPlan: null,
    userId: 1 // 这里应该从全局状态或用户信息中获取
  },

  onLoad(options) {
    console.log('Daily plan page loaded');
    // 获取当前日期
    const today = new Date();
    const currentDate = today.getFullYear() + '-' + 
      String(today.getMonth() + 1).padStart(2, '0') + '-' + 
      String(today.getDate()).padStart(2, '0');
    
    this.setData({
      currentDate: currentDate,
      planName: '今日疗愈计划',
      isLoading: true,
      streamingContent: '正在为您生成今日疗愈计划...'
    });
    
    // 开始获取今日计划
    this.getTodayPlan();
  },

  onShow() {
    console.log('Daily plan page shown');
    // 每次显示页面时重新加载数据
    if (!this.data.parsedPlan && !this.data.isLoading) {
      this.getTodayPlan();
    }
  },

  onBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  onViewAllPlans() {
    wx.navigateTo({
      url: '/pages/treatment-plan/treatment-plan'
    });
  },

  // 获取今日计划
  async getTodayPlan() {
    try {
      // 构建请求数据
      const requestData = {
        user_id: this.data.userId,
        date: this.data.currentDate
      };
      
      // 首先尝试流式API
      const streamResponse = await this.getTodayPlanStream(requestData, (content) => {
        // 流式显示回调
        this.setData({
          streamingContent: content,
          isStreaming: true
        });
        
        // 实时解析流式内容
        const streamingParsed = this.parseStreamingContent(content);
        if (streamingParsed) {
          this.setData({
            streamingParsedPlan: streamingParsed
          });
        }
      });
      if (streamResponse) {
        return;
      }
      
      // 如果流式API失败，使用普通API
      const response = await this.getTodayPlanNormal(requestData);
      if (response && response.data && response.data.daily_plan) {
        const dailyPlan = response.data.daily_plan;
        let formattedPlan = '';
        
        if (typeof dailyPlan === 'object') {
          // 格式化对象为可读文本
          if (dailyPlan.theme) {
            formattedPlan += `## ${dailyPlan.theme}\n\n`;
          }
          if (dailyPlan.description) {
            formattedPlan += `${dailyPlan.description}\n\n`;
          }
          if (dailyPlan.tasks && Array.isArray(dailyPlan.tasks)) {
            formattedPlan += '## 今日任务\n\n';
            dailyPlan.tasks.forEach(task => {
              formattedPlan += `• ${task}\n`;
            });
          }
          
          if (!formattedPlan) {
            formattedPlan = JSON.stringify(dailyPlan, null, 2);
          }
        } else {
          formattedPlan = dailyPlan;
        }
        
        // 尝试解析为结构化数据
        const parsed = this.parseTreatmentPlan(formattedPlan);
        console.log('解析后的数据:', parsed);
        
        this.setData({
          treatmentPlan: formattedPlan,
          parsedPlan: parsed,
          isLoading: false,
          streamingContent: ''
        });
      } else {
        throw new Error('获取今日计划失败');
      }
    } catch (error) {
      console.error('获取今日计划失败:', error);
      this.setData({
        treatmentPlan: '获取今日计划失败，请重试',
        isLoading: false,
        streamingContent: ''
      });
    }
  },

  // 流式获取今日计划
  async getTodayPlanStream(requestData, onProgress) {
    return new Promise((resolve) => {
      try {
        const requestTask = wx.request({
          url: 'http://127.0.0.1:8000/api/chat/today-plan-detailed',
          method: 'POST',
          data: requestData,
          enableChunked: true,
          success: (res) => {
            console.log('流式请求成功:', res);
            // 如果请求成功但没有收到[DONE]标记，也需要处理最终数据
            setTimeout(() => {
              if (this.data.streamingContent && this.data.isLoading) {
                console.log('流式请求完成，处理最终数据');
                const finalContent = this.data.streamingContent;
                const parsed = this.parseTreatmentPlan(finalContent);
                
                this.setData({
                  treatmentPlan: finalContent,
                  parsedPlan: parsed,
                  isLoading: false,
                  streamingContent: ''
                });
              }
            }, 2000);
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
            
            console.log('收到数据块:', rawChunk);
            
            // 处理SSE格式的数据
            const lines = rawChunk.split('\n');
            for (let line of lines) {
              line = line.trim();
              if (line.startsWith('data: ')) {
                const data = line.substring(6);
                if (data === '[DONE]') {
                  console.log('流式传输完成');
                  // 处理最终数据
                  const finalContent = this.data.streamingContent;
                  const parsed = this.parseTreatmentPlan(finalContent);
                  
                  this.setData({
                    treatmentPlan: finalContent,
                    parsedPlan: parsed,
                    isLoading: false,
                    isStreaming: false,
                    streamingContent: ''
                  });
                  return;
                }
                
                try {
                  const jsonData = JSON.parse(data);
                  if (jsonData.content) {
                    // 累积内容
                    const newContent = this.data.streamingContent + jsonData.content;
                    onProgress(newContent);
                  }
                } catch (e) {
                  // 如果不是JSON格式，直接作为文本处理
                  const newContent = this.data.streamingContent + data;
                  onProgress(newContent);
                }
              }
            }
          } catch (e) {
            console.error('处理数据块失败:', e);
          }
        });
      } catch (error) {
        console.error('创建流式请求失败:', error);
        resolve(false);
      }
    });
  },

  // 普通获取今日计划
  async getTodayPlanNormal(requestData) {
    return wx.request({
      url: 'http://127.0.0.1:8000/api/chat/today-plan-detailed',
      method: 'POST',
      data: requestData
    });
  },

  parseStreamingContent(streamingText) {
    try {
      // 尝试解析JSON格式的流式内容
      const jsonMatch = streamingText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const jsonContent = jsonMatch[1];
        const parsed = this.parsePartialJSON(jsonContent);
        if (parsed && parsed.days) {
          return {
            days: parsed.days.map(day => ({
              ...day,
              expanded: true, // 默认展开
              isStreaming: true
            }))
          };
        }
      }
      
      // 尝试解析文本格式的流式内容
      const textParsed = this.parseStreamingTextPlan(streamingText);
      if (textParsed && textParsed.days) {
        return textParsed;
      }
      
      return null;
    } catch (error) {
      console.error('解析流式内容失败:', error);
      return null;
    }
  },

  parsePartialJSON(jsonText) {
    try {
      // 尝试直接解析
      return JSON.parse(jsonText);
    } catch (e) {
      // 如果解析失败，尝试修复不完整的JSON
      try {
        // 移除末尾可能不完整的部分
        let fixedJson = jsonText.trim();
        
        // 如果以逗号结尾，移除它
        if (fixedJson.endsWith(',')) {
          fixedJson = fixedJson.slice(0, -1);
        }
        
        // 尝试补全缺失的括号
        let openBraces = (fixedJson.match(/{/g) || []).length;
        let closeBraces = (fixedJson.match(/}/g) || []).length;
        let openBrackets = (fixedJson.match(/\[/g) || []).length;
        let closeBrackets = (fixedJson.match(/\]/g) || []).length;
        
        // 补全缺失的括号
        while (closeBraces < openBraces) {
          fixedJson += '}';
          closeBraces++;
        }
        while (closeBrackets < openBrackets) {
          fixedJson += ']';
          closeBrackets++;
        }
        
        return JSON.parse(fixedJson);
      } catch (e2) {
        console.error('修复JSON失败:', e2);
        return null;
      }
    }
  },

  parseStreamingTextPlan(planText) {
    try {
      // 解析文本格式的计划
      const lines = planText.split('\n');
      const days = [];
      let currentDay = null;
      let currentTasks = [];
      
      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        // 匹配日期标题
        const dayMatch = line.match(/^#+\s*(今日计划|第\d+天)[：:]?\s*(.*)$/);
        if (dayMatch) {
          // 保存前一天的数据
          if (currentDay) {
            currentDay.tasks = currentTasks;
            days.push(currentDay);
          }
          
          // 开始新的一天
          currentDay = {
            day: 1,
            theme: dayMatch[2] || '今日疗愈',
            description: '',
            date: this.data.currentDate,
            tasks: [],
            expanded: true,
            isStreaming: true
          };
          currentTasks = [];
        }
        // 匹配任务项
        else if (line.match(/^[•·\-\*]\s+/) || line.match(/^\d+[\.)、]\s+/)) {
          const taskText = line.replace(/^[•·\-\*\d\.)、]\s*/, '');
          if (taskText) {
            currentTasks.push({
              id: Date.now() + Math.random(),
              text: taskText,
              completed: false
            });
          }
        }
        // 如果没有明确的日期标题，创建默认的今日计划
        else if (!currentDay && line.length > 0) {
          currentDay = {
            day: 1,
            theme: '今日疗愈计划',
            description: line,
            date: this.data.currentDate,
            tasks: [],
            expanded: true,
            isStreaming: true
          };
        }
      }
      
      // 保存最后一天的数据
      if (currentDay) {
        currentDay.tasks = currentTasks;
        days.push(currentDay);
      }
      
      return days.length > 0 ? { days } : null;
    } catch (error) {
      console.error('解析文本计划失败:', error);
      return null;
    }
  },

  parseTreatmentPlan(planText) {
    try {
      // 首先尝试解析JSON格式
      const jsonMatch = planText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.days) {
          return {
            days: parsed.days.map(day => ({
              ...day,
              expanded: true // 默认展开
            }))
          };
        }
      }
      
      // 尝试解析文本格式
      return this.parseTextPlan(planText);
    } catch (error) {
      console.error('解析治疗计划失败:', error);
      return null;
    }
  },

  parseTextPlan(planText) {
    try {
      const lines = planText.split('\n');
      const days = [];
      let currentDay = null;
      let currentTasks = [];
      
      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        // 匹配日期标题
        const dayMatch = line.match(/^#+\s*(今日计划|第\d+天)[：:]?\s*(.*)$/);
        if (dayMatch) {
          // 保存前一天的数据
          if (currentDay) {
            currentDay.tasks = currentTasks;
            days.push(currentDay);
          }
          
          // 开始新的一天
          currentDay = {
            day: 1,
            theme: dayMatch[2] || '今日疗愈',
            description: '',
            date: this.data.currentDate,
            tasks: [],
            expanded: true
          };
          currentTasks = [];
        }
        // 匹配任务项
        else if (line.match(/^[•·\-\*]\s+/) || line.match(/^\d+[\.)、]\s+/)) {
          const taskText = line.replace(/^[•·\-\*\d\.)、]\s*/, '');
          if (taskText) {
            currentTasks.push({
              id: Date.now() + Math.random(),
              text: taskText,
              completed: false
            });
          }
        }
        // 如果没有明确的日期标题，创建默认的今日计划
        else if (!currentDay && line.length > 0) {
          currentDay = {
            day: 1,
            theme: '今日疗愈计划',
            description: line,
            date: this.data.currentDate,
            tasks: [],
            expanded: true
          };
        }
      }
      
      // 保存最后一天的数据
      if (currentDay) {
        currentDay.tasks = currentTasks;
        days.push(currentDay);
      }
      
      return days.length > 0 ? { days } : null;
    } catch (error) {
      console.error('解析文本计划失败:', error);
      return null;
    }
  },

  toggleDay(e) {
    const { index } = e.currentTarget.dataset;
    const key = this.data.isStreaming ? 'streamingParsedPlan.days' : 'parsedPlan.days';
    const days = this.data.isStreaming ? this.data.streamingParsedPlan.days : this.data.parsedPlan.days;
    
    if (days && days[index]) {
      const updateKey = `${key}[${index}].expanded`;
      this.setData({
        [updateKey]: !days[index].expanded
      });
    }
  },

  toggleTask(e) {
    const { dayIndex, taskIndex } = e.currentTarget.dataset;
    const key = this.data.isStreaming ? 'streamingParsedPlan.days' : 'parsedPlan.days';
    const days = this.data.isStreaming ? this.data.streamingParsedPlan.days : this.data.parsedPlan.days;
    
    if (days && days[dayIndex] && days[dayIndex].tasks && days[dayIndex].tasks[taskIndex]) {
      const updateKey = `${key}[${dayIndex}].tasks[${taskIndex}].completed`;
      this.setData({
        [updateKey]: !days[dayIndex].tasks[taskIndex].completed
      });
    }
  }
});