# WXBizDataCrypt 微信数据解密模块

## 简介

[WXBizDataCrypt](file:///Users/anzhi/viagra/backend/app/routers/auth.py#L155-L169) 是一个用于解密微信小程序加密数据的Python模块。它可以解密微信小程序通过 `getPhoneNumber` 等接口获取的加密数据。

## 功能特性

- 解密微信小程序加密数据
- 验证数据完整性（通过appid校验）
- 支持PKCS#7填充解密
- 兼容微信小程序各种加密数据格式

## 安装依赖

模块依赖于 `pycryptodome` 库，已在项目 requirements.txt 中包含：

```
pycryptodome==3.19.0
```

## 使用方法

### 基本用法

```python
from app.WXBizDataCrypt import WXBizDataCrypt

# 初始化
appid = "your_wechat_appid"
session_key = "session_key_from_wechat_api"
pc = WXBizDataCrypt(appid, session_key)

# 解密数据
decrypted_data = pc.decrypt(encrypted_data, iv)
phone_number = decrypted_data.get('phoneNumber', '')
```

### 在认证流程中使用

```python
# 在获取到 session_key, encrypted_data, iv 后
pc = WXBizDataCrypt(WECHAT_APPID, session_key)
decrypted = pc.decrypt(encrypted_data, iv)
phone_number = decrypted.get('phoneNumber', '')
```

## 错误处理

模块可能抛出以下异常：

- `Exception`: 当appid不匹配或数据无效时
- `UnicodeDecodeError`: 当解密数据无法正确解码时
- 其他加密相关的异常

建议在使用时进行适当的异常处理：

```python
try:
    pc = WXBizDataCrypt(appid, session_key)
    decrypted = pc.decrypt(encrypted_data, iv)
    phone_number = decrypted.get('phoneNumber', '')
except Exception as e:
    print(f"解密失败: {str(e)}")
    # 处理解密失败的情况
```

## 测试

项目包含测试文件 `test_wxbizdatacrypt.py` 和 `test_wxbizdatacrypt_full.py`，可以用来验证模块功能。

运行测试：
```bash
cd backend
python test_wxbizdatacrypt_simple.py
python test_wxbizdatacrypt_full.py
```

## 注意事项

1. 确保传入的 `session_key` 是从微信API正确获取的
2. `encrypted_data` 和 `iv` 必须是微信小程序返回的原始数据
3. 模块会自动验证解密数据中的appid是否匹配
4. 如果解密失败，建议记录日志并提供降级方案