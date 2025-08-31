const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}` 
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

// Base64 编码工具
const base64 = {
  CusBASE64: {
    encoder: function(str) {
      return wx.arrayBufferToBase64(new TextEncoder().encode(str))
    },
    decoder: function(base64Str) {
      const buffer = wx.base64ToArrayBuffer(base64Str)
      return new TextDecoder().decode(buffer)
    }
  }
}

module.exports = {
  formatTime,
  base64
}