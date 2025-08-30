Page({
  data: {
    planName: '',
    treatmentPlan: '',
    parsedPlan: null,
    isLoading: false,
    flowData: null
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
          isLoading: true
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
    wx.navigateTo({
      url: '/pages/daily-plan/daily-plan'
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
      
      console.log('使用普通HTTP请求获取治疗计划');
      
      // 直接使用普通API，不使用流式请求
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: 'http://127.0.0.1:8000/api/chat/treatment',
          method: 'POST',
          data: requestData,
          header: {
            'Content-Type': 'application/json'
          },
          success: resolve,
          fail: reject
        });
      });
      
      console.log('API响应:', response);
      if(response.statusCode === 200 && response.data){
        const treatmentPlan = response.data.treatmentPlan;
        console.log('原始治疗计划数据:', treatmentPlan);
        const parsed = this.parseTreatmentPlan(treatmentPlan);
        console.log('解析后的治疗计划数据:', parsed);
        this.setData({
          parsedPlan: parsed,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('获取治疗计划失败:', error);
      this.setData({
        treatmentPlan: '获取治疗计划失败，请重试',
        parsedPlan: null,
        isLoading: false
      });
    }
  },

  // // 解析治疗计划文本为结构化数据
  parseTreatmentPlan(data) {
    console.log('开始解析计划文本:', data);
    if (!data) {
      console.log('计划文本为空');
      return null;
    }
    const planText = JSON.parse(data);
    console.log('解析后的计划文本:', planText);
    const newPlan = planText.weeks.map((week, weekIndex) => ({
       ...week,
       expanded: weekIndex === 0,
       items: (week.items || []).map((item, index) => ({
        id: `${weekIndex}-${index}`,
        text: item,
        completed: false
       })),
    }));
    return newPlan;
  },


  // 获取日期字符串
  getDateString(dayNumber) {
    const today = new Date();
    const targetDate = new Date(today.getTime() + (dayNumber - 1) * 24 * 60 * 60 * 1000);
    return `${targetDate.getMonth() + 1}.${targetDate.getDate()}`;
  },

  // 切换日卡片展开状态
  // 修复 toggleDay 方法
  toggleDay(e) {
    console.log('切换日卡片展开状态:', e.currentTarget.dataset);
    const index = e.currentTarget.dataset.index; // 修复：正确获取index值
    
    if (this.data.parsedPlan) {
      const weeks = [...this.data.parsedPlan]; // 修复：直接使用parsedPlan数组
      weeks[index].expanded = !weeks[index].expanded;
      
      this.setData({
        parsedPlan: weeks // 修复：直接更新parsedPlan
      });
    }
  },

  // 切换任务完成状态
  toggleTask(e) {
    const { dayIndex, taskIndex } = e.currentTarget.dataset;
    
    if (this.data.parsedPlan) {
      const weeks = [...this.data.parsedPlan];
      if (weeks && weeks[dayIndex] && weeks[dayIndex].items && weeks[dayIndex].items[taskIndex]) {
        weeks[dayIndex].items[taskIndex].completed = !weeks[dayIndex].items[taskIndex].completed;
        
        this.setData({
          parsedPlan: weeks
        });
      }
    }
  }
});