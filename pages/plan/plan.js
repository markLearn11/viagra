// pages/plan/plan.js
const { aiChatApi, chatApi, getPlanDashboardData } = require('../../utils/api');
const { isUserLoggedIn } = require('../../utils/check-auth');

Page({
  data: {
    tab: 'Ai',
    weekDays: [],
    allWeekDays: [], // 三周数据
    isExpanded: false,
    currentMonth: 0, // 相对于当前月份的偏移量
    // 计划数据，从后端获取
    planData: {},
    todayPlans: [], // 今日前三个计划
    allPlans: [], // 所有疗愈计划
    // 本周计划达成统计
    weeklyStats: {
      completed_count: 0,
      total_count: 0,
      completion_rate: 0,
      dateList: [], // 添加日期列表
      daily_stats: {} // 添加每日统计
    },
    // AI对话相关数据
    chatMessages: [], // 聊天消息列表
    inputValue: '', // 输入框内容
    isLoading: false, // 是否正在加载AI回复
    scrollTop: 0, // 滚动位置
    currentSessionId: null, // 当前会话ID
    // 添加一个标志位，避免重复加载数据
    isDataLoaded: false,
  },

  onLoad(options) {
    console.log(options)
    
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
    
    this.setData({
      fromPage:options.index
    })
    this.initCalendar();
    this.loadAllPlanData(); // 使用合并后的接口
  },

  onShow() {
    // 页面显示时重新加载数据，但避免在onLoad后立即重复加载
    // 只有当数据未加载或需要刷新时才加载
    if (!this.data.isDataLoaded) {
      this.loadAllPlanData();
    }
  },

  // 添加一个方法来重置数据加载状态，以便可以重新加载数据
  resetDataLoadedFlag() {
    this.setData({
      isDataLoaded: false
    });
  },

  // 如果需要手动刷新数据，可以调用此方法
  refreshAllPlanData() {
    // 重置标志位并重新加载数据
    this.resetDataLoadedFlag();
    this.loadAllPlanData();
  },

  // 返回上一页
  goBack() {
    if(this.data.fromPage=='稍后再说'){
      wx.navigateTo({
        url: `../index/index?index=${'稍后再说'}`
      })
    }else{
      wx.navigateBack();
    }
  },

  // tab切换事件
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      tab: tab
    });
  },

  // 输入框内容变化
  onInputChange(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },

  // 发送消息
  async onSendMessage() {
    const message = this.data.inputValue.trim();
    if (!message) {
      wx.showToast({
        title: '请输入消息内容',
        icon: 'none'
      });
      return;
    }

    // 获取用户信息
    let userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || !userInfo.id) {
      userInfo = {
        id: 1,
        name: '默认用户'
      };
      wx.setStorageSync('userInfo', userInfo);
    }

    // 添加用户消息到聊天列表
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: message,
      time: this.formatTime(new Date())
    };

    const newMessages = [...this.data.chatMessages, userMessage];
    this.setData({
      chatMessages: newMessages,
      inputValue: '',
      isLoading: true
    });

    // 滚动到底部
    this.scrollToBottom();

    try {
      // 调用AI对话接口
      const response = await aiChatApi.streamChat(
        message,
        userInfo.id,
        {
          sessionId: this.data.currentSessionId,
          systemPrompt: "你是一个友善、有帮助的AI助手，专门为用户提供心理健康相关的建议和支持。请用中文回复，语气要温和、理解和支持。",
          onProgress: (content) => {
            // 实时更新AI回复内容
            this.updateAIMessage(content);
          },
          onComplete: (finalContent) => {
            // 流式回复完成
            this.setData({
              isLoading: false
            });
            console.log('AI回复完成:', finalContent);
          },
          onError: (error) => {
            console.error('AI对话失败:', error);
            this.setData({
              isLoading: false
            });
            wx.showToast({
              title: '发送失败，请重试',
              icon: 'none'
            });
          }
        }
      );

      // 如果返回了会话ID，保存它
      if (response && response.session_id) {
        this.setData({
          currentSessionId: response.session_id
        });
      }

    } catch (error) {
      console.error('发送消息失败:', error);
      this.setData({
        isLoading: false
      });
      wx.showToast({
        title: '发送失败，请重试',
        icon: 'none'
      });
    }
  },

  // 更新AI消息内容（流式更新）
  updateAIMessage(content) {
    console.log('收到流式内容:', content); // 添加调试日志
    
    const messages = [...this.data.chatMessages];
    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage && lastMessage.type === 'ai') {
      // 更新最后一条AI消息
      lastMessage.content = content;
    } else {
      // 创建新的AI消息
      const aiMessage = {
        id: Date.now(),
        type: 'ai',
        content: content,
        time: this.formatTime(new Date())
      };
      messages.push(aiMessage);
    }
    
    this.setData({
      chatMessages: messages
    });
    
    // 滚动到底部
    this.scrollToBottom();
  },

  // 滚动到底部
  scrollToBottom() {
    this.setData({
      scrollTop: this.data.chatMessages.length * 100
    });
  },

  // 格式化时间
  formatTime(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  // 日期点击事件
  onDayTap(e) {
    const day = e.currentTarget.dataset.day;
    console.log('点击了日期:', day);
    // 这里可以添加日期点击的具体逻辑
  },

  // 初始化日历
  initCalendar() {
    this.loadPlanData(); // 从后端加载计划数据
    const today = new Date();
    const weekDays = this.generateWeekDays(today);
    const allWeekDays = this.generateThreeWeeksDays(); // 改为三周
    
    this.setData({
      weekDays: weekDays,
      allWeekDays: allWeekDays
    });
  },

  // 从后端加载计划数据
  async loadPlanData() {
    try {
      // 从本地存储获取用户ID
      let userInfo = wx.getStorageSync('userInfo');
      
      // 如果用户信息不存在，创建默认用户信息
      if (!userInfo || !userInfo.id) {
        console.log('用户信息不存在，使用默认用户ID');
        userInfo = {
          id: 1, // 使用默认用户ID
          name: '默认用户'
        };
        // 保存到本地存储
        wx.setStorageSync('userInfo', userInfo);
      }
    } catch (error) {
      console.error('加载计划数据出错:', error);
      this.generateDefaultPlanData();
    }
  },

  // 合并后的数据加载方法
  async loadAllPlanData() {
    try {
      // 设置数据加载标志位
      this.setData({
        isDataLoaded: true
      });

      // 从本地存储获取用户ID
      let userInfo = wx.getStorageSync('userInfo');
      
      // 如果用户信息不存在，创建默认用户信息
      if (!userInfo || !userInfo.id) {
        console.log('用户信息不存在，使用默认用户ID');
        userInfo = {
          id: 1, // 使用默认用户ID
          name: '默认用户'
        };
        // 保存到本地存储
        wx.setStorageSync('userInfo', userInfo);
      }

      // 调用封装后的后端API
      const response = await getPlanDashboardData(userInfo.id);

      if (response.success) {
        const data = response.data;
        
        // 设置本周计划达成统计（包含新的daily_stats）
        this.setData({
          weeklyStats: {
            completed_count: data.weekly_stats.completed_count,
            total_count: data.weekly_stats.total_count,
            completion_rate: data.weekly_stats.total_count > 0 ? 
              Math.round((data.weekly_stats.completed_count / data.weekly_stats.total_count) * 100) : 0,
            dateList: data.weekly_stats.dateList || [],
            daily_stats: data.weekly_stats.daily_stats || {}
          }
        });

        // 设置今日计划
        this.setData({
          todayPlans: data.today_plans.slice(0, 3) || []
        });

        // 设置所有疗愈计划
        this.setData({
          allPlans: data.all_plans.slice(0, 2) || []
        });

        // 重新生成日历数据以包含新的计划数据
        this.refreshCalendarData();
        
      } else {
        console.error('获取计划数据失败:', response.message);
        this.setDefaultData();
      }
    } catch (error) {
      console.error('加载计划数据出错:', error);
      this.setDefaultData();
    }
  },

  // 刷新日历数据
  refreshCalendarData() {
    const today = new Date();
    const weekDays = this.generateWeekDays(today);
    const allWeekDays = this.generateThreeWeeksDays(); // 改为三周
    
    this.setData({
      weekDays: weekDays,
      allWeekDays: allWeekDays
    });
  },

  // 设置默认数据
  setDefaultData() {
    // 设置默认的本周统计
    this.setData({
      weeklyStats: {
        completed_count: 12,
        total_count: 31,
        completion_rate: 38.71,
        dateList: [],
        daily_stats: {}
      }
    });

    // 设置默认的今日计划
    const defaultTodayPlans = [
      {
        id: 'default_1',
        text: '培养一个兴趣爱好，坚持每日打卡这个兴趣',
        completed: false
      },
      {
        id: 'default_2',
        text: '分散注意力，不让自己被情绪左右',
        completed: false
      },
      {
        id: 'default_3',
        text: '保持沟通，避免陷入自我怀疑',
        completed: false
      }
    ];
    this.setData({
      todayPlans: defaultTodayPlans
    });

    // 设置默认的前三个计划
    this.setData({
      allPlans: []
    });

    // 生成默认的计划数据
    this.generateDefaultPlanData();
  },

  // 生成默认计划数据（基于接口返回的daily_stats）
  generateDefaultPlanData() {
    const planData = {};
    const dailyStats = this.data.weeklyStats.daily_stats || {};
    
    // 遍历daily_stats中的每一天数据
    Object.keys(dailyStats).forEach(dateStr => {
      const dayData = dailyStats[dateStr];
      
      // 根据接口数据生成计划数据
      if (dayData && dayData.total > 0) {
        // 根据完成状态确定状态
        let status;
        if (dayData.is_completed) {
          status = 'completed';
        } else if (this.isOverdue(new Date(dateStr))) {
          status = 'overdue';
        } else {
          status = 'warning'; // 有计划但未完成
        }
        
        // 生成任务列表（这里可以根据实际接口数据结构调整）
        const tasks = [];
        if (dayData.tasks && Array.isArray(dayData.tasks)) {
          tasks.push(...dayData.tasks);
        } else {
          // 如果没有具体的任务列表，生成默认任务
          for (let i = 0; i < dayData.total; i++) {
            tasks.push(`任务${i + 1}`);
          }
        }
        
        planData[dateStr] = {
          status: status,
          tasks: tasks,
          total: dayData.total,
          completed: dayData.completed || 0,
          is_completed: dayData.is_completed
        };
      }
    });
    
    this.setData({ planData });
  },

  // 生成一周的日期数据（使用daily_stats）
  generateWeekDays(centerDate) {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyStats = this.data.weeklyStats.daily_stats || {};
    
    // 生成以今天为中心的7天
    for (let i = -3; i <= 3; i++) {
      const date = new Date(centerDate);
      date.setDate(date.getDate() + i);
      
      const dateStr = this.formatDate(date);
      const day = date.getDate();
      
      let status = 'empty';
      if (this.isSameDay(date, today)) {
        status = 'today';
      } else if (dailyStats[dateStr]) {
        // 根据daily_stats判断状态
        const dayData = dailyStats[dateStr];
        if (dayData.total > 0) {
          if (dayData.is_completed) {
            status = 'completed';
          } else if (dayData.completed > 0) {
            status = 'warning'; // 部分完成
          } else if (this.isOverdue(date)) {
            status = 'overdue'; // 过时没打卡
          } else {
            status = 'pending'; // 有待完成的任务
          }
        }
      }
      
      days.push({
        day: day,
        date: dateStr,
        status: status,
        tasks: dailyStats[dateStr]?.tasks || [],
        total: dailyStats[dateStr]?.total || 0,
        completed: dailyStats[dateStr]?.completed || 0
      });
    }
    
    return days;
  },

  // 生成最近三周的所有日期（使用daily_stats）
  generateThreeWeeksDays() {
    const allDays = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyStats = this.data.weeklyStats.daily_stats || {};
    
    // 生成最近三周的日期，按正确顺序：前两周 + 当前周
    for (let weekOffset = -2; weekOffset <= 0; weekOffset++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + weekOffset * 7);
      
      // 修正周名称显示
      let weekName = '';
      if (weekOffset === -2) {
        weekName = '前两周';
      } else if (weekOffset === -1) {
        weekName = '前一周';
      } else {
        weekName = '本周';
      }
      
      const weekData = {
        weekName: weekName,
        days: []
      };
      
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayOffset);
        const dateStr = this.formatDate(date);
        const day = date.getDate();
        
        let status = 'empty';
        if (this.isSameDay(date, today)) {
          status = 'today';
        } else if (dailyStats[dateStr]) {
          // 根据daily_stats判断状态
          const dayData = dailyStats[dateStr];
          if (dayData.total > 0) {
            if (dayData.is_completed) {
              status = 'completed';
            } else if (dayData.completed > 0) {
              status = 'warning'; // 部分完成
            } else if (this.isOverdue(date)) {
              status = 'overdue'; // 过时没打卡
            } else {
              status = 'pending'; // 有待完成的任务
            }
          }
        }
        
        weekData.days.push({
          day: day,
          date: dateStr,
          status: status,
          tasks: dailyStats[dateStr]?.tasks || [],
          total: dailyStats[dateStr]?.total || 0,
          completed: dailyStats[dateStr]?.completed || 0
        });
      }
      
      allDays.push(weekData);
    }
    
    return allDays;
  },

  // 判断是否过时（超过今天且未完成）
  isOverdue(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 过时条件：1. 日期小于今天 2. 有任务 3. 未完成
    return date < today;
  },

  // 格式化日期为YYYY-MM-DD
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 判断是否为同一天
  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  },

  // 展开按钮点击事件
  onExpandTap() {
    this.setData({
      isExpanded: !this.data.isExpanded
    });
    
    // 如果展开，重新生成日历数据
    if (this.data.isExpanded) {
      this.refreshCalendarData();
    }
  },

  // 切换计划完成状态
  onPlanToggle(e) {
    const index = e.currentTarget.dataset.index;
    const todayPlans = [...this.data.todayPlans.slice(0, 3)];
    todayPlans[index].completed = !todayPlans[index].completed;
    this.setData({
      todayPlans: todayPlans
    });
  },

  // 点击查看今日疗愈计划，跳转到daily-plan页面
  onViewTodayPlan() {
    wx.navigateTo({
      url: '../daily-plan/daily-plan'
    });
  },
});
