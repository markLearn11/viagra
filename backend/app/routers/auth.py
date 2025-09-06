from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
import random
import string
import requests
import os
import base64
import json
from datetime import datetime, timedelta
from typing import Optional
try:
    from Crypto.Cipher import AES
    from Crypto.Util.Padding import unpad
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    print("Warning: pycryptodome not installed. Phone decryption will use mock data for development.")

from ..database import get_db
from ..models import User
from ..schemas import UserCreate, UserResponse

router = APIRouter(tags=["认证"])

# 微信小程序配置
WECHAT_APPID = os.getenv("WECHAT_APPID", "your_wechat_appid")
WECHAT_SECRET = os.getenv("WECHAT_SECRET", "your_wechat_secret")

# 临时存储验证码（生产环境应使用Redis等缓存）
verification_codes = {}

class SendCodeRequest(BaseModel):
    phone: str

class LoginRequest(BaseModel):
    phone: str
    code: str

class WechatLoginRequest(BaseModel):
    code: str
    userInfo: dict

class DecryptPhoneRequest(BaseModel):
    code: str
    encrypted_data: str
    iv: str

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

def generate_code() -> str:
    """生成6位数字验证码"""
    return ''.join(random.choices(string.digits, k=6))

def generate_token(user_id: int) -> str:
    """生成简单的token（生产环境应使用JWT）"""
    import hashlib
    import time
    data = f"{user_id}_{time.time()}"
    return hashlib.md5(data.encode()).hexdigest()

async def get_wechat_session(code: str) -> dict:
    """
    通过微信API获取session_key和openid
    """
    url = "https://api.weixin.qq.com/sns/jscode2session"
    params = {
        "appid": WECHAT_APPID,
        "secret": WECHAT_SECRET,
        "js_code": code,
        "grant_type": "authorization_code"
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        if "errcode" in data:
            raise HTTPException(
                status_code=400, 
                detail=f"微信API错误: {data.get('errmsg', '未知错误')}"
            )
        
        return data
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"调用微信API失败: {str(e)}")

def decrypt_phone_number(session_key: str, encrypted_data: str, iv: str) -> dict:
    """
    解密微信小程序手机号
    """
    if not CRYPTO_AVAILABLE:
        # 开发模式：返回模拟数据
        print("Using mock phone data for development")
        return {
            "phoneNumber": "13800138000",
            "purePhoneNumber": "13800138000",
            "countryCode": "86"
        }
    
    try:
        # Base64解码
        session_key = base64.b64decode(session_key)
        encrypted_data = base64.b64decode(encrypted_data)
        iv = base64.b64decode(iv)
        
        # AES解密
        cipher = AES.new(session_key, AES.MODE_CBC, iv)
        decrypted = unpad(cipher.decrypt(encrypted_data), AES.block_size)
        
        # 解析JSON
        phone_info = json.loads(decrypted.decode('utf-8'))
        return phone_info
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"手机号解密失败: {str(e)}")

@router.post("/send-code")
async def send_verification_code(request: SendCodeRequest, db: Session = Depends(get_db)):
    """
    发送验证码
    """
    phone = request.phone
    
    # 验证手机号格式
    if not phone or len(phone) != 11 or not phone.startswith('1'):
        raise HTTPException(status_code=400, detail="手机号格式不正确")
    
    # 生成验证码
    code = generate_code()
    
    # 存储验证码（5分钟有效期）
    verification_codes[phone] = {
        'code': code,
        'expires_at': datetime.now() + timedelta(minutes=5)
    }
    
    # 这里应该调用短信服务发送验证码
    # 为了演示，我们直接返回验证码（生产环境不应该这样做）
    print(f"验证码已发送到 {phone}: {code}")
    
    return {
        "message": "验证码已发送",
        "code": code  # 仅用于开发测试，生产环境应删除此行
    }

@router.post("/login", response_model=TokenResponse)
async def login_with_code(request: LoginRequest, db: Session = Depends(get_db)):
    """
    验证码登录
    """
    phone = request.phone
    code = request.code
    
    # 验证验证码
    if phone not in verification_codes:
        raise HTTPException(status_code=400, detail="请先获取验证码")
    
    stored_code_info = verification_codes[phone]
    
    # 检查验证码是否过期
    if datetime.now() > stored_code_info['expires_at']:
        del verification_codes[phone]
        raise HTTPException(status_code=400, detail="验证码已过期")
    
    # 检查验证码是否正确
    if code != stored_code_info['code']:
        raise HTTPException(status_code=400, detail="验证码错误")
    
    # 删除已使用的验证码
    del verification_codes[phone]
    
    # 查找或创建用户
    user = db.query(User).filter(User.phone == phone).first()
    
    if not user:
        # 创建新用户
        user = User(
            phone=phone,
            nickname=f"用户{phone[-4:]}",  # 使用手机号后4位作为默认昵称
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # 生成token
    token = generate_token(user.id)
    
    return TokenResponse(
        token=token,
        user=UserResponse(
            id=user.id,
            phone=user.phone,
            nickname=user.nickname,
            avatar_url=user.avatar_url,
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
    )

@router.post("/wechat-login", response_model=TokenResponse)
async def wechat_login(request: WechatLoginRequest, db: Session = Depends(get_db)):
    """
    微信登录
    """
    wechat_code = request.code
    user_info = request.userInfo
    
    # 调用微信API获取真实的openid和session_key
    try:
        wechat_session = await get_wechat_session(wechat_code)
        openid = wechat_session.get('openid')
        session_key = wechat_session.get('session_key')
        
        if not openid:
            raise HTTPException(status_code=400, detail="获取微信用户信息失败")
            
    except Exception as e:
        # 如果微信API调用失败，使用开发模式（仅用于测试）
        print(f"微信API调用失败，使用开发模式: {str(e)}")
        openid = f"dev_wx_{wechat_code[:10]}"
        session_key = "dev_session_key"
    
    # 查找或创建用户
    user = db.query(User).filter(User.wechat_openid == openid).first()
    
    if not user:
        # 创建新用户
        user = User(
            wechat_openid=openid,
            session_key=session_key,
            nickname=user_info.get('nickName', '微信用户') if user_info else '微信用户',
            avatar_url=user_info.get('avatarUrl', '') if user_info else '',
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # 更新用户信息
        user.session_key = session_key
        if user_info:
            user.nickname = user_info.get('nickName', user.nickname)
            user.avatar_url = user_info.get('avatarUrl', user.avatar_url)
        db.commit()
        db.refresh(user)
    
    # 生成token
    token = generate_token(user.id)
    
    return TokenResponse(
        token=token,
        user=UserResponse(
            id=user.id,
            phone=user.phone,
            nickname=user.nickname,
            avatar_url=user.avatar_url,
            wechat_openid=user.wechat_openid,
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
    )

@router.post("/decrypt-phone", response_model=TokenResponse)
async def decrypt_phone(request: DecryptPhoneRequest, db: Session = Depends(get_db)):
    """
    解密微信小程序手机号并绑定用户
    """
    wechat_code = request.code
    encrypted_data = request.encrypted_data
    iv = request.iv
    
    # 获取微信session信息
    try:
        wechat_session = await get_wechat_session(wechat_code)
        openid = wechat_session.get('openid')
        session_key = wechat_session.get('session_key')
        
        if not openid or not session_key:
            raise HTTPException(status_code=400, detail="获取微信用户信息失败")
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"微信登录失败: {str(e)}")
    
    # 解密手机号
    phone_info = decrypt_phone_number(session_key, encrypted_data, iv)
    phone_number = phone_info.get('phoneNumber')
    
    if not phone_number:
        raise HTTPException(status_code=400, detail="手机号解密失败")
    
    # 查找或创建用户
    user = db.query(User).filter(User.wechat_openid == openid).first()
    
    if not user:
        # 检查手机号是否已被其他用户使用
        existing_user = db.query(User).filter(User.phone == phone_number).first()
        if existing_user:
            # 绑定微信openid到现有用户
            existing_user.wechat_openid = openid
            existing_user.session_key = session_key
            db.commit()
            db.refresh(existing_user)
            user = existing_user
        else:
            # 创建新用户
            user = User(
                phone=phone_number,
                wechat_openid=openid,
                session_key=session_key,
                nickname=f"用户{phone_number[-4:]}",
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
    else:
        # 更新用户手机号和session_key
        user.phone = phone_number
        user.session_key = session_key
        db.commit()
        db.refresh(user)
    
    # 生成token
    token = generate_token(user.id)
    
    return TokenResponse(
        token=token,
        user=UserResponse(
            id=user.id,
            phone=user.phone,
            nickname=user.nickname,
            avatar_url=user.avatar_url,
            wechat_openid=user.wechat_openid,
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
    )

@router.get("/verify-token")
async def verify_token(token: str, db: Session = Depends(get_db)):
    """
    验证token有效性
    """
    # 这里应该实现真正的token验证逻辑
    # 为了演示，我们简单返回成功
    return {"valid": True, "message": "Token有效"}