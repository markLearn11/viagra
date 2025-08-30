Page({
  data: {
    planName: '',
    treatmentPlan: '',
    parsedPlan: null,
    isLoading: false,
    streamingContent: '',
    flowData: null,
    isStreaming: false,
    streamingParsedPlan: null
  },

  onLoad(options) {
    const { planName, treatmentPlan, flowData } = options;
    
    // 如果有treatmentPlan参数，说明是旧的调用方式
    if (treatmentPlan) {
      const decodedPlan = decodeURIComponent(treatmentPlan || '');
      console.log('旧调用方式，解析已有的治疗计划:', decodedPlan);
      const parsed = this.parseTreatmentPlan(decodedPlan);
      console.log('旧调用方式解析结果:', parsed);
      this.setData({
        planName: decodeURIComponent(planName || ''),
        treatmentPlan: decodedPlan,
        parsedPlan: parsed
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

  // 保存治疗计划到服务器
  async saveTreatmentPlan(planContent, flowData) {
    try {
      // 获取用户ID（这里需要根据实际的用户认证方式获取）
      const userId = wx.getStorageSync('userId') || 1; // 临时使用默认用户ID
      
      const saveData = {
        user_id: userId,
        plan_name: this.data.planName || '个性化治疗计划',
        plan_content: planContent,
        flow_data: flowData,
        plan_type: 'monthly'
      };
      
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: 'http://127.0.0.1:8000/api/chat/save-treatment-plan',
          method: 'POST',
          data: saveData,
          header: {
            'Content-Type': 'application/json'
          },
          success: resolve,
          fail: reject
        });
      });
      
      if (response.statusCode === 200) {
        console.log('治疗计划保存成功:', response.data);
        wx.showToast({
          title: '计划已保存',
          icon: 'success',
          duration: 2000
        });
        return response.data;
      } else {
        throw new Error('保存失败');
      }
    } catch (error) {
      console.error('保存治疗计划失败:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'error',
        duration: 2000
      });
      return null;
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
      const streamResponse = await this.getTreatmentPlanStream(requestData, (content) => {
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
        
        // 尝试解析为结构化数据
        const parsed = this.parseTreatmentPlan(formattedPlan);
        console.log('解析后的数据:', parsed);
        
        this.setData({
          treatmentPlan: formattedPlan,
          parsedPlan: parsed,
          isLoading: false,
          streamingContent: ''
        });
        
        // 保存治疗计划到服务器
        await this.saveTreatmentPlan(formattedPlan, this.data.flowData);
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
  async getTreatmentPlanStream(requestData, onProgress) {
    return new Promise((resolve) => {
      try {
        const requestTask = wx.request({
          url: 'http://127.0.0.1:8000/api/chat/treatment-stream',
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
            
            // 处理流式数据格式：data: {"content": "内容"}\n\n
            const lines = rawChunk.split('\n');
            let content = '';
            let isStreamEnd = false;
            
            for (let line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6); // 移除 "data: " 前缀
                if (jsonStr === '[DONE]') {
                  // 流结束标记
                  isStreamEnd = true;
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
              const newStreamingContent = this.data.streamingContent + content;
              console.log('流式内容更新:', newStreamingContent.substring(0, 200) + '...');
              
              // 调用onProgress回调
              if (onProgress) {
                onProgress(newStreamingContent);
              }
              
              // 实时解析流式内容
              const streamingParsed = this.parseStreamingContent(newStreamingContent);
              console.log('流式解析结果:', streamingParsed);
              
              this.setData({
                streamingContent: newStreamingContent,
                streamingParsedPlan: streamingParsed,
                isStreaming: true
              });
            }
            
            // 如果流结束，解析最终数据
            if (isStreamEnd) {
              setTimeout(async () => {
                const finalContent = this.data.streamingContent;
                console.log('流式内容完成:', finalContent);
                const parsed = this.parseTreatmentPlan(finalContent);
                console.log('流式解析后的数据:', parsed);
                
                this.setData({
                  treatmentPlan: finalContent,
                  parsedPlan: parsed,
                  isLoading: false,
                  isStreaming: false,
                  streamingContent: '',
                  streamingParsedPlan: null
                });
                
                // 保存治疗计划到服务器
                await this.saveTreatmentPlan(finalContent, this.data.flowData);
                
                resolve(true);
              }, 500);
            }
          } catch (error) {
            console.error('处理流式数据失败:', error);
          }
        });
        
        // 注意：流结束的处理已经移到onChunkReceived中的[DONE]标记处理
        
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
  },

  // 实时解析流式内容
  parseStreamingContent(streamingText) {
    console.log('开始实时解析:', streamingText.substring(0, 100) + '...');
    if (!streamingText || streamingText.trim().length === 0) {
      return null;
    }

    try {
      // 尝试解析JSON格式
      if (streamingText.trim().startsWith('{')) {
        console.log('检测到JSON格式，尝试解析');
        
        // 尝试解析完整JSON
        try {
          const jsonPlan = JSON.parse(streamingText);
          console.log('完整JSON解析成功:', jsonPlan);
          if (jsonPlan.weeks) {
            return this.convertWeeksToDays(jsonPlan.weeks);
          }
        } catch (e) {
          console.log('完整JSON解析失败，尝试部分解析:', e.message);
          
          // 尝试解析部分JSON结构
          const partialResult = this.parsePartialJSON(streamingText);
          if (partialResult) {
            return partialResult;
          }
        }
      }

      // 实时解析文本格式
      console.log('使用文本格式解析');
      return this.parseStreamingTextPlan(streamingText);
    } catch (error) {
      console.warn('实时解析失败:', error);
      return null;
    }
  },

  // 解析部分JSON结构
  parsePartialJSON(jsonText) {
    try {
      console.log('尝试部分JSON解析，文本长度:', jsonText.length);
      
      // 查找weeks数组的开始
      const weeksMatch = jsonText.match(/"weeks"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
      if (weeksMatch) {
        console.log('找到weeks数组片段');
        
        let weeksContent = weeksMatch[1];
        const weeks = [];
        
        // 使用更精确的方法解析week对象
        let braceCount = 0;
        let currentWeek = '';
        let inString = false;
        let escapeNext = false;
        
        for (let i = 0; i < weeksContent.length; i++) {
          const char = weeksContent[i];
          
          if (escapeNext) {
            escapeNext = false;
            currentWeek += char;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            currentWeek += char;
            continue;
          }
          
          if (char === '"' && !escapeNext) {
            inString = !inString;
          }
          
          if (!inString) {
            if (char === '{') {
              braceCount++;
            } else if (char === '}') {
              braceCount--;
            }
          }
          
          currentWeek += char;
          
          // 当找到完整的week对象时
          if (braceCount === 0 && currentWeek.trim().startsWith('{') && currentWeek.trim().endsWith('}')) {
            try {
              const week = JSON.parse(currentWeek.trim());
              weeks.push(week);
              console.log(`解析week ${weeks.length}:`, week);
              currentWeek = '';
            } catch (e) {
              console.log(`week解析失败:`, e.message, '内容:', currentWeek.trim());
              currentWeek = '';
            }
          }
        }
        
        if (weeks.length > 0) {
          console.log('部分weeks解析成功，共', weeks.length, '个week');
          return this.convertWeeksToDays(weeks);
        }
      }
      
      // 如果没有找到weeks，尝试查找其他可能的结构
      console.log('未找到weeks结构，尝试其他解析方式');
      return null;
    } catch (error) {
      console.log('部分JSON解析失败:', error);
      return null;
    }
  },

  // 实时解析文本格式的治疗计划
  parseStreamingTextPlan(planText) {
    const days = [];
    const lines = planText.split('\n').filter(line => line.trim());
    
    let currentDay = null;
    let dayCounter = 1;
    
    lines.forEach(line => {
      line = line.trim();
      
      // 检测日期标题
      if (line.includes('第') && line.includes('天')) {
        if (currentDay) {
          days.push(currentDay);
        }
        
        const theme = line.split(/第\d+天/).pop()?.trim() || '情绪调节主导';
        currentDay = {
          day: dayCounter,
          theme: theme,
          date: this.getDateString(dayCounter),
          description: '生活中有许多事情是我们无法改变的，比如过去的经历、他人的行为等。',
          tasks: [],
          expanded: dayCounter === 1,
          isStreaming: true // 标记为流式数据
        };
        dayCounter++;
      }
      // 检测任务项
      else if (line.startsWith('•') || line.startsWith('✓') || line.startsWith('-')) {
        if (currentDay) {
          const taskText = line.replace(/^[•✓-]\s*/, '').trim();
          if (taskText) {
            currentDay.tasks.push({
              id: `${currentDay.day}-${currentDay.tasks.length}`,
              text: taskText,
              completed: false
            });
          }
        }
      }
      // 检测其他可能的内容格式
      else if (line.length > 10 && currentDay && !line.includes('第') && !line.includes('天')) {
        // 可能是任务描述，添加到当前天的任务中
        if (currentDay.tasks.length === 0 || line.includes(':') || line.includes('：')) {
          currentDay.tasks.push({
            id: `${currentDay.day}-${currentDay.tasks.length}`,
            text: line,
            completed: false
          });
        }
      }
    });
    
    // 添加当前正在构建的天（即使不完整）
    if (currentDay) {
      days.push(currentDay);
    }
    
    // 如果还没有解析到任何天数据，但有内容，创建一个临时的天
    if (days.length === 0 && planText.trim().length > 0) {
      days.push({
        day: 1,
        theme: '正在生成中...',
        date: this.getDateString(1),
        description: '正在为您生成个性化治疗计划...',
        tasks: [{
          id: '1-0',
          text: planText.trim(),
          completed: false
        }],
        expanded: true,
        isStreaming: true
      });
    }
    
    return { days };
  },

  // 解析治疗计划文本为结构化数据
  parseTreatmentPlan(planText) {
    console.log('开始解析计划文本:', planText);
    if (!planText) {
      console.log('计划文本为空');
      return null;
    }
    
    try {
      // 尝试解析为JSON格式
      if (planText.trim().startsWith('{')) {
        console.log('尝试解析为JSON格式');
        const jsonPlan = JSON.parse(planText);
        if (jsonPlan.weeks) {
          console.log('找到weeks数据，转换为日计划');
          return this.convertWeeksToDays(jsonPlan.weeks);
        }
      }
      
      // 解析文本格式
      console.log('解析为文本格式');
      const result = this.parseTextPlan(planText);
      console.log('文本解析结果:', result);
      return result;
    } catch (error) {
      console.error('解析治疗计划失败:', error);
      console.log('回退到文本解析');
      return this.parseTextPlan(planText);
    }
  },

  // 将周计划转换为日计划
  convertWeeksToDays(weeks) {
    const days = [];
    let dayCounter = 1;
    
    weeks.forEach((week, weekIndex) => {
      // 每周分为7天
      for (let i = 0; i < 7; i++) {
        const dayData = {
          day: dayCounter,
          theme: week.title || `第${weekIndex + 1}周`,
          date: this.getDateString(dayCounter),
          description: '生活中有许多事情是我们无法改变的，比如过去的经历、他人的行为等。',
          tasks: (week.items || []).map((task, taskIndex) => ({
            id: `${dayCounter}-${taskIndex}`,
            text: task,
            completed: false
          })),
          expanded: dayCounter === 1 // 默认展开第一天
        };
        days.push(dayData);
        dayCounter++;
        
        if (dayCounter > 28) break; // 最多28天
      }
    });
    
    return { days };
  },

  // 解析文本格式的计划
  parseTextPlan(planText) {
    const days = [];
    const lines = planText.split('\n').filter(line => line.trim());
    
    let currentDay = null;
    let dayCounter = 1;
    
    lines.forEach(line => {
      line = line.trim();
      
      // 检测日期标题
      if (line.includes('第') && line.includes('天')) {
        if (currentDay) {
          days.push(currentDay);
        }
        
        const theme = line.split(/第\d+天/).pop()?.trim() || '情绪调节主导';
        currentDay = {
          day: dayCounter,
          theme: theme,
          date: this.getDateString(dayCounter),
          description: '生活中有许多事情是我们无法改变的，比如过去的经历、他人的行为等。',
          tasks: [],
          expanded: dayCounter === 1
        };
        dayCounter++;
      }
      // 检测任务项
      else if (line.startsWith('•') || line.startsWith('✓') || line.startsWith('-')) {
        if (currentDay) {
          const task = line.replace(/^[•✓-]\s*/, '').trim();
          if (task) {
            currentDay.tasks.push({
              id: `task_${currentDay.day}_${currentDay.tasks.length}`,
              text: task,
              completed: false
            });
          }
        }
      }
    });
    
    if (currentDay) {
      days.push(currentDay);
    }
    
    // 如果没有解析到天数据，创建默认数据
    if (days.length === 0) {
      for (let i = 1; i <= 7; i++) {
        days.push({
          day: i,
          theme: i === 1 ? '告别情绪主导' : '转移生活中心',
          date: this.getDateString(i),
          description: '生活中有许多事情是我们无法改变的，比如过去的经历、他人的行为等。',
          tasks: [
            { id: `task_${i}_0`, text: '接受已经发生的事情，学会勇敢面对', completed: false },
            { id: `task_${i}_1`, text: '原谅自己，妥善处理坏情绪', completed: false },
            { id: `task_${i}_2`, text: '保持沟通，避免陷入自我怀疑', completed: false },
            { id: `task_${i}_3`, text: '培养一个长期的兴趣爱好，将注意力转移', completed: false },
            { id: `task_${i}_4`, text: '放过自己，学会在其中自洽', completed: false }
          ],
          expanded: i === 1
        });
      }
    }
    
    return { days };
  },

  // 获取日期字符串
  getDateString(dayNumber) {
    const today = new Date();
    const targetDate = new Date(today.getTime() + (dayNumber - 1) * 24 * 60 * 60 * 1000);
    return `${targetDate.getMonth() + 1}.${targetDate.getDate()}`;
  },

  // 切换日卡片展开状态
  toggleDay(e) {
    const index = e.currentTarget.dataset.index;
    
    // 处理流式数据的展开/折叠
    if (this.data.isStreaming && this.data.streamingParsedPlan) {
      const streamingDays = this.data.streamingParsedPlan.days;
      streamingDays[index].expanded = !streamingDays[index].expanded;
      
      this.setData({
        'streamingParsedPlan.days': streamingDays
      });
    }
    // 处理最终数据的展开/折叠
    else if (this.data.parsedPlan) {
      const days = this.data.parsedPlan.days;
      days[index].expanded = !days[index].expanded;
      
      this.setData({
        'parsedPlan.days': days
      });
    }
  },

  // 切换任务完成状态
  toggleTask(e) {
    const { dayIndex, taskIndex } = e.currentTarget.dataset;
    
    // 优先使用流式数据，如果没有则使用最终数据
    if (this.data.streamingParsedPlan && this.data.isStreaming) {
      const streamingDays = this.data.streamingParsedPlan.days;
      if (streamingDays && streamingDays[dayIndex] && streamingDays[dayIndex].tasks[taskIndex]) {
        streamingDays[dayIndex].tasks[taskIndex].completed = !streamingDays[dayIndex].tasks[taskIndex].completed;
        this.setData({
          streamingParsedPlan: {
            ...this.data.streamingParsedPlan,
            days: streamingDays
          }
        });
      }
    } else if (this.data.parsedPlan) {
      const days = this.data.parsedPlan.days;
      if (days && days[dayIndex] && days[dayIndex].tasks[taskIndex]) {
        days[dayIndex].tasks[taskIndex].completed = !days[dayIndex].tasks[taskIndex].completed;
        this.setData({
          parsedPlan: {
            ...this.data.parsedPlan,
            days: days
          }
        });
      }
    }
  }
});