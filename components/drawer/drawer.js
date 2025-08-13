// components/drawer/drawer.js
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

  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 点击遮罩层关闭抽屉
    onMaskTap() {
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
      const type = e.currentTarget.dataset.type;
      this.triggerEvent('itemTap', { type });
      this.closeDrawer();
    }
  }
})