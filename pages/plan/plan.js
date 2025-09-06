// pages/plan/plan.js
Page({
  data: {
    tab: 'Ai',
    weekDays: [],
    allMonthDays: [],
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
      fromPage:''
    },
  },

  onLoad(options) {
    console.log(options)
    this.setData({
      fromPage:options.index
    })
    this.initCalendar();
    this.loadAllPlanData(); // 使用合并后的接口
  },

  onShow() {
    // 页面显示时重新加载数据
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
    const allMonthDays = this.generateThreeMonthsDays();
    
    this.setData({
      weekDays: weekDays,
      allMonthDays: allMonthDays
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

      // 调用合并后的后端API
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: 'http://127.0.0.1:8000/api/chat/get-plan-dashboard-data',
          method: 'GET',
          data: {
            user_id: userInfo.id
          },
          header: {
            'Content-Type': 'application/json'
          },
          success: resolve,
          fail: reject
        });
      });

      if (response.statusCode === 200 && response.data.success) {
        const data = response.data.data;
        
        // 设置本周计划达成统计
        this.setData({
          weeklyStats: {
            completed_count: data.weekly_stats.completed_count,
            total_count: data.weekly_stats.total_count,
            completion_rate: data.weekly_stats.completion_rate
          }
        });

        // 设置今日计划
        this.setData({
          todayPlans: data.today_plans || []
        });

        // 设置前三个疗愈计划
        this.setData({
          allPlans: data.recent_plans || []
        });

        // 设置最近一个月的计划数据（用于日历显示）
        this.setData({
          planData: data.monthly_plan_data || {}
        });

        // 重新生成日历数据以包含新的计划数据
        this.refreshCalendarData();
        
      } else {
        console.error('获取计划数据失败:', response.data.message);
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
    const allMonthDays = this.generateThreeMonthsDays();
    
    this.setData({
      weekDays: weekDays,
      allMonthDays: allMonthDays
    });
  },

  // 设置默认数据
  setDefaultData() {
    // 设置默认的本周统计
    this.setData({
      weeklyStats: {
        completed_count: 12,
        total_count: 31,
        completion_rate: 38.71
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

  // 生成默认计划数据（当API调用失败时使用）
  generateDefaultPlanData() {
    const planData = {};
    const today = new Date();
    
    // 生成最近三个月的随机计划数据
    for (let monthOffset = -1; monthOffset <= 1; monthOffset++) {
      const currentDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
      const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const dateStr = this.formatDate(date);
        
        // 随机生成一些计划数据（约30%的日期有计划）
        if (Math.random() < 0.3) {
          const statuses = ['completed', 'warning', 'pending'];
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          const taskCount = Math.floor(Math.random() * 3) + 1;
          const tasks = [];
          
          for (let i = 0; i < taskCount; i++) {
            tasks.push(`任务${i + 1}`);
          }
          
          planData[dateStr] = {
            status: status,
            tasks: tasks
          };
        }
      }
    }
    
    this.setData({ planData });
  },

  // 生成一周的日期数据
  generateWeekDays(centerDate) {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const planData = this.data.planData || {};
    
    // 生成以今天为中心的7天
    for (let i = -3; i <= 3; i++) {
      const date = new Date(centerDate);
      date.setDate(date.getDate() + i);
      
      const dateStr = this.formatDate(date);
      const day = date.getDate();
      
      let status = 'empty';
      if (this.isSameDay(date, today)) {
        status = 'today';
      } else if (planData[dateStr]) {
        status = planData[dateStr].status;
      }
      
      days.push({
        day: day,
        date: dateStr,
        status: status,
        tasks: planData[dateStr]?.tasks || []
      });
    }
    
    return days;
  },

  // 生成最近三个月的所有日期
  generateThreeMonthsDays() {
    const allDays = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const planData = this.data.planData || {};
    
    // 生成最近三个月的日期
    for (let monthOffset = -1; monthOffset <= 1; monthOffset++) {
      const currentDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const monthName = `${year}年${month + 1}月`;
      
      const monthData = {
        monthName: monthName,
        days: []
      };
      
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = this.formatDate(date);
        
        let status = 'empty';
        if (this.isSameDay(date, today)) {
          status = 'today';
        } else if (planData[dateStr]) {
          status = planData[dateStr].status;
        }
        
        monthData.days.push({
          day: day,
          date: dateStr,
          status: status,
          tasks: planData[dateStr]?.tasks || []
        });
      }
      
      allDays.push(monthData);
    }
    
    return allDays;
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
  },

  // 切换计划完成状态
  onPlanToggle(e) {
    const index = e.currentTarget.dataset.index;
    const todayPlans = [...this.data.todayPlans];
    todayPlans[index].completed = !todayPlans[index].completed;
    this.setData({
      todayPlans: todayPlans
    });
  },
});
