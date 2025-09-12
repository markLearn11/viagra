const { isUserLoggedIn } = require("../../utils/check-auth");

Page({
  data: {
    planName: '',
    treatmentPlan: '',
    parsedPlan: null,
    isLoading: false,
    flowData: null,
    createdAt: null,
    relationshipType: ''
  },

  onLoad(options) {
    // 检查用户登录状态
    if (!isUserLoggedIn()) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 1500
      });
      
      // 延迟跳转到登录页面
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/my-profile/my-profile'
        });
      }, 1500);
      return;
    }
    
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
    // wx.navigateBack();
    wx.navigateTo({
      url: '/pages/index/index'
    });
    this.setData({
      currentStep: 0
    });
    wx.setStorageSync('currentStep', 0);
  },

  // 查看今日计划
  onViewTodayPlan() {
    console.log('onViewTodayPlan 被调用');
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
          timeout: 1200000, // 设置120秒超时
          success: resolve,
          fail: reject
        });
      });
      
      console.log('API响应:', response);
      if(response.statusCode === 200 && response.data){
        const responseData = response.data;
        const treatmentPlan = responseData.treatmentPlan;
        const createdAt = responseData.created_at;
        const planName = responseData.plan_name;
        const relationshipType = responseData.relationship_type;
        
        console.log('原始治疗计划数据:', treatmentPlan);
        console.log('创建时间:', createdAt);
        console.log('计划名称:', planName);
        console.log('人物关系:', relationshipType);
        
        const parsed = this.parseTreatmentPlan(treatmentPlan);
        console.log('解析后的治疗计划数据:', parsed);
        
        this.setData({
          parsedPlan: parsed,
          treatmentPlan: treatmentPlan,
          planName: planName || '心理治疗计划',
          createdAt: createdAt,
          relationshipType: relationshipType,
          isLoading: false
        });
        
        // 自动保存治疗计划到服务器
        await this.saveTreatmentPlan(treatmentPlan, flowData);
      }
    } catch (error) {
      console.error('获取治疗计划失败:', error);
      let errorMessage = '获取治疗计划失败，请重试';
      
      // 根据错误类型提供更具体的错误信息
      if (error.errMsg && error.errMsg.includes('timeout')) {
        errorMessage = '请求超时，请检查网络连接后重试';
      } else if (error.errMsg && error.errMsg.includes('fail')) {
        errorMessage = '网络连接失败，请检查网络后重试';
      }
      
      this.setData({
        treatmentPlan: errorMessage,
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
    
    let planText;
    try {
      // 尝试解析JSON
      planText = JSON.parse(data);
      console.log('解析后的计划文本:', planText);
    } catch (error) {
      console.error('JSON解析失败:', error);
      console.log('原始数据:', data);
      
      // 尝试提取JSON部分
      let cleanData = data.trim();
      
      // 如果包含代码块标记，提取其中的JSON
      if (cleanData.includes('```json')) {
        const start = cleanData.indexOf('```json') + 7;
        const end = cleanData.indexOf('```', start);
        if (end !== -1) {
          cleanData = cleanData.substring(start, end).trim();
        }
      } else if (cleanData.includes('```')) {
        const start = cleanData.indexOf('```') + 3;
        const end = cleanData.indexOf('```', start);
        if (end !== -1) {
          cleanData = cleanData.substring(start, end).trim();
        }
      }
      
      // 查找JSON对象的开始和结束
      const jsonStart = cleanData.indexOf('{');
      const jsonEnd = cleanData.lastIndexOf('}') + 1;
      
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        cleanData = cleanData.substring(jsonStart, jsonEnd);
      }
      
      try {
        planText = JSON.parse(cleanData);
        console.log('清理后解析成功:', planText);
      } catch (secondError) {
        console.error('二次解析也失败:', secondError);
        return null;
      }
    }
    const newPlan = planText.weeks.map((week, weekIndex) => ({
       ...week,
        startTime:week.items[0].date.slice(5),
        endTime:week.items[week.items.length-1].date.slice(5),
       expanded: weekIndex === 0,
       items: (week.items || []).map((item, index) => ({
        id: `${weekIndex}-${index}`,
        text: item.text,
        date:item.date,
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
  },

  // 手动保存治疗计划
  async onSavePlan() {
    if (!this.data.treatmentPlan) {
      wx.showToast({
        title: '暂无计划可保存',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    wx.showLoading({
      title: '保存中...'
    });

    try {
      const result = await this.saveTreatmentPlan(this.data.treatmentPlan, this.data.flowData);
      if (result) {
        wx.showToast({
          title: '保存成功',
          icon: 'success',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('手动保存失败:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'error',
        duration: 2000
      });
    } finally {
      wx.hideLoading();
    }
  }
});