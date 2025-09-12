// components/drawer/drawer.js
const { chatApi } = require('../../utils/api');

Component({
  /**
   * 组件的属性列表
   */
  properties: {
    show: {
      type: Boolean,
      value: false
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    total: 0,
    planList: [],
    touchStartX: 0,
    touchStartY: 0,
    currentSwipeIndex: -1
  },

  /**
   * 组件的生命周期
   */
  lifetimes: {
    attached() {
      // 组件实例进入页面节点树时执行
      this.loadTreatmentPlans();
    }
  },

  /**
   * 组件的观察者
   */
  observers: {
    'show': function(show) {
      // 当抽屉显示时，重新加载数据
      if (show) {
        this.loadTreatmentPlans();
      }
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 加载治疗计划数据
    async loadTreatmentPlans() {
      try {
        console.log('开始加载治疗计划数据');
        
        // 获取用户ID
        const userInfo = wx.getStorageSync('userInfo');
        console.log('获取到的用户信息:', userInfo);
        
        const userId = userInfo ? userInfo.id : null;
        console.log('用户ID:', userId);
        
        // 检查用户是否已登录
        if (!userId) {
          console.warn('用户未登录，无法获取治疗计划');
          this.setData({
            total: 0,
            planList: []
          });
          return;
        }
        
        // 检查token是否存在
        const token = wx.getStorageSync('token');
        console.log('获取到的token:', token ? `${token.substring(0, 10)}...` : '未找到token');
        
        if (!token) {
          console.warn('用户未登录或token缺失，无法获取治疗计划');
          this.setData({
            total: 0,
            planList: []
          });
          return;
        }
        
        // 使用封装的API接口获取治疗计划
        console.log('调用API获取治疗计划，用户ID:', userId);
        const response = await chatApi.getTreatmentPlans(userId);
        console.log('API响应:', response);
        
        if (response && response.plans) {
          console.log('获取治疗计划列表成功:', response);
          
          // 格式化数据以匹配组件需要的格式
          const formattedPlans = response.plans.map(plan => ({
            id: plan.id,
            title: plan.title,
            date: plan.date,
            relationship: plan.relationship,
            progress: plan.progress === 'active' ? '进行中' : '已结束',
            created_at: plan.created_at,
            plan_type: plan.plan_type,
            flow_data: plan.flow_data
          }));
          
          this.setData({
            total: response.total || response.plans.length,
            planList: formattedPlans
          });
        } else {
          console.warn('获取治疗计划列表返回空数据');
          this.setData({
            total: 0,
            planList: []
          });
        }
      } catch (error) {
        console.error('获取治疗计划列表失败:', error);
        
        // 检查是否是认证错误
        if (error.message && (error.message.includes('401') || error.message.includes('无法验证凭据'))) {
          console.error('认证失败，请重新登录');
          // 可以触发重新登录流程
          wx.showToast({
            title: '请重新登录',
            icon: 'none'
          });
        }
        
        // 如果获取失败，可以显示默认数据或错误提示
        this.setData({
          total: 0,
          planList: []
        });
      }
    },

    // 点击遮罩层关闭抽屉
    onMaskTap() {
      this.hideDeleteButton();
      this.closeDrawer();
    },

    // 点击抽屉内容区域，阻止事件冒泡
    onDrawerTap() {
      // 阻止事件冒泡到遮罩层
    },

    // 点击关闭按钮
    onClose() {
      this.closeDrawer();
    },

    // 关闭抽屉
    closeDrawer() {
      this.triggerEvent('close');
    },

    // 点击菜单项
    onItemTap(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.planList[index];
      this.triggerEvent('itemTap', { item, index });
    },

    onTouchStart(e) {
      const touch = e.touches[0];
      this.setData({
        touchStartX: touch.clientX,
        touchStartY: touch.clientY
      });
    },

    onTouchMove(e) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - this.data.touchStartX;
      const deltaY = touch.clientY - this.data.touchStartY;
      
      // 判断是否为左滑手势（水平滑动距离大于垂直滑动距离，且向左滑动）
      if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX < -30) {
        const index = e.currentTarget.dataset.index;
        this.showDeleteButton(index);
      }
    },

    onTouchEnd(e) {
      // 重置触摸起始位置
      this.setData({
        touchStartX: 0,
        touchStartY: 0
      });
    },

    showDeleteButton(index) {
      const planList = this.data.planList.map((item, i) => {
        return {
          ...item,
          showDelete: i === index
        };
      });
      
      this.setData({
        planList,
        currentSwipeIndex: index
      });
    },

    hideDeleteButton() {
      const planList = this.data.planList.map(item => {
        return {
          ...item,
          showDelete: false
        };
      });
      
      this.setData({
        planList,
        currentSwipeIndex: -1
      });
    },



    onDeletePlan(e) {
      const { id, index } = e.currentTarget.dataset;
      
      wx.showModal({
        title: '确认删除',
        content: '确定要删除这个治疗计划吗？删除后无法恢复。',
        success: (res) => {
          if (res.confirm) {
            this.deleteTreatmentPlan(id, index);
          }
        }
      });
    },

    async deleteTreatmentPlan(planId, index) {
      try {
        const response = await chatApi.deleteTreatmentPlan(planId);

        if (response && response.success) {
          // 重新获取治疗计划列表
          await this.loadTreatmentPlans();

          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        } else {
          throw new Error('删除失败');
        }
      } catch (error) {
        console.error('删除治疗计划失败:', error);
        wx.showToast({
          title: '删除失败',
          icon: 'error'
        });
      }
    }
  }
})