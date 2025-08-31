Page({
  data: {
    planName: '',
    treatmentPlan: '',
    parsedPlan: null,
    isLoading: false,
    flowData: null,
    todayPlan: null,
    isStreaming: false,
    streamingContent: ''
  },

  onShow() {
    // 每次进入页面都获取最新的今日计划
    this.loadTodayPlan();
  },

  // 加载今日计划的统一方法
  async loadTodayPlan() {
    try {
      const userId = wx.getStorageSync('userId') || 1;
      
      this.setData({
        isLoading: true
      });

      // 先尝试从服务器获取已保存的今日计划
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: 'http://127.0.0.1:8000/api/chat/get-today-plan',
          method: 'GET',
          data: {
            user_id: userId,
            date: this.getDateString()
          },
          header: {
            'Content-Type': 'application/json'
          },
          success: resolve,
          fail: reject
        });
      });
      console.log('获取今日计划响应:', response);
      if (response.statusCode === 200 && response.data && response.data.plan_content) {
        // 如果服务器有今日计划，直接使用
        const parsed = this.parseTreatmentPlan(response.data.plan_content);
        this.setData({
          treatmentPlan: response.data.plan_content,
          parsedPlan: parsed,
          planName: response.data.plan_name || '今日疗愈计划',
          isLoading: false
        });
      } else if (response.statusCode === 200 && response.data && response.data.message === "未找到今日计划") {
        // 如果没有今日计划，调用流式接口生成
        console.log('未找到今日计划，开始生成新计划');
        await this.generateTodayPlanStream();
      } else {
        // 其他情况显示提示信息
        this.setData({
          treatmentPlan: '暂无今日计划，请先生成治疗计划',
          isLoading: false
        });
      }
    } catch (error) {
      console.error('获取今日计划失败:', error);
      this.setData({
        treatmentPlan: '获取今日计划失败，请重试',
        isLoading: false
      });
      wx.showToast({
        title: '获取计划失败',
        icon: 'none',
        duration: 2000
      });
    }
  },



  // 流式生成今日计划
  async generateTodayPlanStream() {
    try {
      // 获取用户的flowData（这里需要从存储中获取或使用默认值）
      const flowData = wx.getStorageSync('flowData') || {
        age: '25',
        gender: '未知',
        occupation: '未知',
        emotional_state: '需要疗愈',
        main_concerns: '情绪调节',
        desired_improvements: '改善心理状态'
      };

      this.setData({
        isLoading: true,
        isStreaming: true,
        streamingContent: '',
        treatmentPlan: '正在为您生成今日疗愈计划...'
      });

      const requestData = {
        flowData: flowData
      };

      // 调用流式接口
      const streamSuccess = await this.getTodayPlanStream(requestData);
      
      if (!streamSuccess) {
        // 如果流式接口失败，显示错误信息
        this.setData({
          treatmentPlan: '生成今日计划失败，请重试',
          isLoading: false,
          isStreaming: false
        });
        wx.showToast({
          title: '生成失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('生成今日计划失败:', error);
      this.setData({
        treatmentPlan: '生成今日计划失败，请重试',
        isLoading: false,
        isStreaming: false
      });
      wx.showToast({
        title: '生成失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 流式获取今日计划
  async getTodayPlanStream(requestData) {
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
                  isStreaming: false,
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
            // 将ArrayBuffer转换为字符串（正确处理UTF-8编码）
            const uint8Array = new Uint8Array(res.data);
            const decoder = new TextDecoder('utf-8');
            const rawChunk = decoder.decode(uint8Array);
            
            console.log('接收到原始数据块:', rawChunk);
            
            // 解析Server-Sent Events格式
            const lines = rawChunk.split('\n');
            let content = '';
            let isStreamEnd = false;
            
            for (let line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.substring(6).trim();
                  if (jsonStr === '[DONE]') {
                    isStreamEnd = true;
                    break;
                  }
                  const data = JSON.parse(jsonStr);
                  if (data.content) {
                    content += data.content;
                  }
                  if (data.error) {
                    console.error('流式响应错误:', data.error);
                    return;
                  }
                } catch (parseError) {
                  console.log('解析流式数据失败:', line, parseError);
                }
              }
            }
            
            // 更新流式内容
            if (content) {
              const newStreamingContent = this.data.streamingContent + content;
              console.log('流式内容更新:', newStreamingContent.substring(0, 200) + '...');
              
              // 实时解析流式内容
              const streamingParsed = this.parseStreamingContent(newStreamingContent);
              
              this.setData({
                streamingContent: newStreamingContent,
                parsedPlan: streamingParsed,
                treatmentPlan: newStreamingContent,
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
                  streamingContent: ''
                });
                
                // 保存今日计划到服务器
                await this.saveTodayPlan(finalContent, requestData.flowData);
                
                resolve(true);
              }, 500);
            }
          } catch (error) {
            console.error('处理流式数据失败:', error);
          }
        });
        
      } catch (error) {
        console.error('创建流式请求失败:', error);
        resolve(false);
      }
    });
  },

  // 解析流式内容
  parseStreamingContent(content) {
    if (!content) return null;
    
    try {
      // 尝试解析JSON格式
      if (content.trim().startsWith('{')) {
        const jsonContent = JSON.parse(content);
        if (jsonContent.practices) {
          return this.convertPracticesToDays(jsonContent.practices);
        }
      }
      
      // 解析文本格式
      return this.parseTextPlan(content);
    } catch (error) {
      // 如果解析失败，返回基本结构
      return {
        practices: [{
          id: 1,
          timeSlot: '全天',
          title: '正在生成中...',
          duration: '全天',
          description: content.substring(0, 100) + '...',
          tasks: [{
            id: 'task_1_0',
            text: content.substring(0, 50) + '...',
            completed: false
          }],
          expanded: true
        }]
      };
    }
  },

  // 保存今日计划到服务器
  async saveTodayPlan(planContent, flowData) {
    try {
      // 获取用户ID（这里需要根据实际的用户认证方式获取）
      const userId = wx.getStorageSync('userId') || 1; // 临时使用默认用户ID
      
      const saveData = {
        user_id: userId,
        plan_name: this.data.planName || '今日疗愈计划',
        plan_content: planContent,
        flow_data: flowData,
        plan_type: 'daily'
      };
      
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: 'http://127.0.0.1:8000/api/chat/save-today-plan',
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
        console.log('今日计划保存成功:', response.data);
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
      console.error('保存今日计划失败:', error);
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

  // 查看所有计划
  onViewAllPlans() {
    wx.navigateTo({
      url: '/pages/treatment-plan/treatment-plan'
    });
  },











  // 解析治疗计划文本为结构化数据
  parseTreatmentPlan(data) {
    console.log('开始解析计划文本:', data);
    if (!data) {
      console.log('计划文本为空');
      return null;
    }
    
    try {
      const planText = JSON.parse(data);
      console.log('解析后的计划文本:', planText);
      
      if (planText.practices) {
        // 今日计划格式：包含practices数组
        const newPlan = planText.practices.map((practice, index) => ({
          ...practice,
          expanded: index === 0,
          items: (practice.tasks || practice.items || []).map((item, itemIndex) => ({
            id: `${index}-${itemIndex}`,
            text: item.text || item,
            date: item.date,
            completed: false
          }))
        }));
        return newPlan;
      } else if (planText.weeks) {
        // 周计划格式：包含weeks数组
        const newPlan = planText.weeks.map((week, weekIndex) => ({
          ...week,
          expanded: weekIndex === 0,
          items: (week.items || []).map((item, index) => ({
            id: `${weekIndex}-${index}`,
            text: item.text,
            date: item.date,
            completed: false
          }))
        }));
        return newPlan;
      } else {
        // 旧格式处理
        return this.convertPracticesToDays(planText);
      }
    } catch (error) {
      console.log('JSON解析失败，尝试文本解析:', error);
      return this.parseTextPlan(data);
    }
  },

  // 将练习转换为今日计划
  convertPracticesToDays(practices) {
    const todayPractices = [];
    
    practices.forEach((practice, index) => {
      const practiceData = {
        id: index + 1,
        timeSlot: practice.timeSlot || '全天',
        title: practice.title || `练习${index + 1}`,
        duration: practice.duration || '15-30分钟',
        description: practice.description || '心理疗愈练习',
        tasks: (practice.tasks || []).map((task, taskIndex) => ({
          id: `${index + 1}-${taskIndex}`,
          text: task,
          completed: false
        })),
        expanded: index === 0 // 默认展开第一个练习
      };
      todayPractices.push(practiceData);
    });
    
    return { practices: todayPractices };
  },

  // 解析文本格式的计划
  parseTextPlan(planText) {
    const practices = [];
    const lines = planText.split('\n').filter(line => line.trim());
    
    let currentPractice = null;
    let practiceCounter = 1;
    
    lines.forEach(line => {
      line = line.trim();
      
      // 检测时间段标题
      if (line.includes('晨间') || line.includes('午间') || line.includes('晚间') || line.includes('练习')) {
        if (currentPractice) {
          practices.push(currentPractice);
        }
        
        const timeSlot = line.includes('晨间') ? '晨间' : line.includes('午间') ? '午间' : '晚间';
        currentPractice = {
          id: practiceCounter,
          timeSlot: timeSlot,
          title: line,
          duration: '15-30分钟',
          description: '心理疗愈练习',
          tasks: [],
          expanded: practiceCounter === 1
        };
        practiceCounter++;
      }
      // 检测任务项
      else if (line.startsWith('•') || line.startsWith('✓') || line.startsWith('-')) {
        if (currentPractice) {
          const task = line.replace(/^[•✓-]\s*/, '').trim();
          if (task) {
            currentPractice.tasks.push({
              id: `task_${currentPractice.id}_${currentPractice.tasks.length}`,
              text: task,
              completed: false
            });
          }
        }
      }
    });
    
    if (currentPractice) {
      practices.push(currentPractice);
    }
    
    // 如果没有解析到练习数据，创建默认数据
    if (practices.length === 0) {
      practices.push({
        id: 1,
        timeSlot: '全天',
        title: '今日疗愈计划',
        duration: '全天',
        description: planText || '暂无具体计划',
        tasks: [{
          id: 'task_1_0',
          text: planText || '暂无具体任务',
          completed: false
        }],
        expanded: true
      });
    }
    
    return { practices };
  },

  // 获取日期字符串
  getDateString() {
    const today = new Date();
    return `${today.getMonth() + 1}.${today.getDate()}`;
  },

  // 切换练习卡片展开状态
  toggleDay(e) {
    console.log('切换日卡片展开状态:', e.currentTarget.dataset);
    const index = e.currentTarget.dataset.index;
    
    if (this.data.parsedPlan) {
      const plans = [...this.data.parsedPlan];
      plans[index].expanded = !plans[index].expanded;
      
      this.setData({
        parsedPlan: plans
      });
    }
  },

  // 切换任务完成状态
  toggleTask(e) {
    const { dayIndex, taskIndex } = e.currentTarget.dataset;
    
    if (this.data.parsedPlan) {
      const plans = [...this.data.parsedPlan];
      if (plans && plans[dayIndex] && plans[dayIndex].items && plans[dayIndex].items[taskIndex]) {
        plans[dayIndex].items[taskIndex].completed = !plans[dayIndex].items[taskIndex].completed;
        
        this.setData({
          parsedPlan: plans
        });
      }
    }
  }
});