// profile.js
Page({
  data: {
    nickname: '',
    gender: '',
    birthday: '',
    bloodType: '',
    occupation: '',
    currentStatus: '',
    maritalStatus: '',
    hasChildren: '',
    showDatePicker: false,
    datePickerValue: [25, 0, 0],
    datePickerRange: [[], [], []]
  },

  onLoad() {
    console.log('我的档案页面加载完成')
    // 从本地存储读取已保存的档案信息
    const savedProfile = wx.getStorageSync('userProfile')
    if (savedProfile) {
      this.setData({
        nickname: savedProfile.nickname || '',
        gender: savedProfile.gender || '',
        birthday: savedProfile.birthday || '',
        bloodType: savedProfile.bloodType || '',
        occupation: savedProfile.occupation || '',
        currentStatus: savedProfile.currentStatus || '',
        maritalStatus: savedProfile.maritalStatus || '',
        hasChildren: savedProfile.hasChildren || ''
      })
    }
  },

  // 返回上一页
  goBack() {
    wx.reLaunch({
      url: '/pages/index/index'
    })
  },

  // 昵称输入处理
  onNicknameInput(e) {
    this.setData({
      nickname: e.detail.value
    })
  },

  // 昵称输入失焦验证
  onNicknameBlur(e) {
    const nickname = e.detail.value.trim()
    if (nickname && (nickname.length < 1 || nickname.length > 10)) {
      wx.showToast({
        title: '昵称长度应为1-10个字',
        icon: 'none'
      })
    }
  },

  // 显示性别选择器
  showGenderPicker() {
    const that = this
    wx.showActionSheet({
      itemList: ['男', '女', '其他'],
      success(res) {
        const genders = ['男', '女', '其他']
        that.setData({
          gender: genders[res.tapIndex]
        })
        wx.showToast({
          title: '性别已设置',
          icon: 'success',
          duration: 1000
        })
      }
    })
  },

  // 显示日期选择器
  showDatePicker() {
    const that = this
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    
    // 生成年份、月份、日期数组
    const years = []
    const months = []
    const days = []
    
    // 生成年份选项 (当前年份-80 到 当前年份-10)
    for (let i = currentYear - 80; i <= currentYear - 10; i++) {
      years.push(i)
    }
    
    // 生成月份选项
    for (let i = 1; i <= 12; i++) {
      months.push(i)
    }
    
    // 生成日期选项 (默认31天，后续会根据选择的年月调整)
    for (let i = 1; i <= 31; i++) {
      days.push(i)
    }
    
    // 设置默认选中的日期
    let defaultYear = currentYear - 25
    let defaultMonth = 1
    let defaultDay = 1
    
    if (that.data.birthday) {
      const birthdayParts = that.data.birthday.split('-')
      defaultYear = parseInt(birthdayParts[0])
      defaultMonth = parseInt(birthdayParts[1])
      defaultDay = parseInt(birthdayParts[2])
    }
    
    const yearIndex = years.indexOf(defaultYear)
    const monthIndex = months.indexOf(defaultMonth)
    const dayIndex = days.indexOf(defaultDay)
    
    that.setData({
      datePickerValue: [yearIndex >= 0 ? yearIndex : 25, monthIndex >= 0 ? monthIndex - 1 : 0, dayIndex >= 0 ? dayIndex - 1 : 0],
      datePickerRange: [years, months, days],
      showDatePicker: true
    })
  },
  
  // 日期选择器改变事件
  onDatePickerChange(e) {
    const value = e.detail.value
    const years = this.data.datePickerRange[0]
    const months = this.data.datePickerRange[1]
    const days = this.data.datePickerRange[2]
    
    // 确保所有值都存在，如果不存在则使用默认值
    const selectedYear = years[value[0]] || years[0]
    const selectedMonth = months[value[1]] || months[0]
    const selectedDay = days[value[2]] || days[0]
    
    // 检查选择的日期是否有效
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
    const validDay = selectedDay <= daysInMonth ? selectedDay : daysInMonth
    
    // 更新picker的值，确保显示正确
    this.setData({
      datePickerValue: value
    })
  },
  
  // 确认日期选择
  onDatePickerConfirm() {
    const value = this.data.datePickerValue
    const years = this.data.datePickerRange[0]
    const months = this.data.datePickerRange[1]
    const days = this.data.datePickerRange[2]
    
    const selectedYear = years[value[0]] || years[0]
    const selectedMonth = months[value[1]] || months[0]
    const selectedDay = days[value[2]] || days[0]
    
    // 检查选择的日期是否有效
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
    const validDay = selectedDay <= daysInMonth ? selectedDay : daysInMonth
    
    const birthday = selectedYear + '-' + 
      (selectedMonth < 10 ? '0' + selectedMonth : selectedMonth) + '-' + 
      (validDay < 10 ? '0' + validDay : validDay)
    
    this.setData({
      birthday: birthday,
      showDatePicker: false
    })
    
    wx.showToast({
      title: '生日已设置',
      icon: 'success',
      duration: 1000
    })
  },
  
  // 取消日期选择
  onDatePickerCancel() {
    this.setData({
      showDatePicker: false
    })
  },

  // 显示血型选择器
  showBloodTypePicker() {
    const that = this
    wx.showActionSheet({
      itemList: ['A型', 'B型', 'AB型', 'O型', '不知道'],
      success(res) {
        const bloodTypes = ['A型', 'B型', 'AB型', 'O型', '不知道']
        that.setData({
          bloodType: bloodTypes[res.tapIndex]
        })
        wx.showToast({
          title: '血型已设置',
          icon: 'success',
          duration: 1000
        })
      }
    })
  },

  // 显示职业选择器
  showOccupationPicker() {
    const that = this
    wx.showActionSheet({
      itemList: ['学生', '上班族', '自由职业', '退休', '其他'],
      success(res) {
        const occupations = ['学生', '上班族', '自由职业', '退休', '其他']
        that.setData({
          occupation: occupations[res.tapIndex]
        })
        wx.showToast({
          title: '职业已设置',
          icon: 'success',
          duration: 1000
        })
      }
    })
  },

  // 显示当前状态选择器
  showStatusPicker() {
    const that = this
    wx.showActionSheet({
      itemList: ['工作中', '学习中', '休息中', '求职中', '其他'],
      success(res) {
        const statuses = ['工作中', '学习中', '休息中', '求职中', '其他']
        that.setData({
          currentStatus: statuses[res.tapIndex]
        })
        wx.showToast({
          title: '状态已设置',
          icon: 'success',
          duration: 1000
        })
      }
    })
  },

  // 显示婚姻状态选择器
  showMaritalPicker() {
    const that = this
    wx.showActionSheet({
      itemList: ['未婚', '已婚', '离异', '丧偶', '其他'],
      success(res) {
        const maritalStatuses = ['未婚', '已婚', '离异', '丧偶', '其他']
        that.setData({
          maritalStatus: maritalStatuses[res.tapIndex]
        })
        wx.showToast({
          title: '婚姻状态已设置',
          icon: 'success',
          duration: 1000
        })
      }
    })
  },

  // 显示孩子情况选择器
  showChildrenPicker() {
    const that = this
    wx.showActionSheet({
      itemList: ['无孩子', '有1个孩子', '有2个孩子', '有3个或更多孩子'],
      success(res) {
        const childrenOptions = ['无孩子', '有1个孩子', '有2个孩子', '有3个或更多孩子']
        that.setData({
          hasChildren: childrenOptions[res.tapIndex]
        })
        wx.showToast({
          title: '孩子情况已设置',
          icon: 'success',
          duration: 1000
        })
      }
    })
  },

  // 保存档案信息
  saveProfile() {
    const { nickname, gender, birthday, bloodType, occupation, currentStatus, maritalStatus, hasChildren } = this.data
    
    // 检查必填信息
    if (!nickname) {
      wx.showToast({
        title: '请填写昵称',
        icon: 'none'
      })
      return
    }
    
    // 保存到本地存储
    wx.setStorageSync('userProfile', {
      nickname,
      gender,
      birthday,
      bloodType,
      occupation,
      currentStatus,
      maritalStatus,
      hasChildren,
      updateTime: new Date().getTime()
    })
    
    wx.showToast({
      title: '档案保存成功',
      icon: 'success',
      duration: 1500,
      success() {
        setTimeout(() => {
          wx.reLaunch({
            url: '/pages/index/index'
          })
        }, 1500)
      }
    })
  },

  // 导航栏右侧图标点击事件
  onRightIconTap() {
    console.log('右侧菜单被点击')
    // 可以添加菜单展开逻辑
  }
})