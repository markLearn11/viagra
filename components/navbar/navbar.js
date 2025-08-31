// components/navbar/navbar.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    title: {
      type: String,
      value: '栖溯心理'
    },
    showBackArrow: {
      type: Boolean,
      value: false
    },
    rightIcon: {
      type: String,
      value: '/static/images/menu.svg'
    },
    showRightIcon: {
      type: Boolean,
      value: true
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
    onLeftIconTap() {
      this.triggerEvent('leftIconTap')
    },
    
    onRightIconTap() {
      this.triggerEvent('rightIconTap')
    }
  }
})