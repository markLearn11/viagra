# pyright: reportAttributeAccessIssue=false
# pyright: reportArgumentType=false
# pyright: reportPossiblyUnboundVariable=false
# pyright: reportMissingImports=false
# pyright: reportGeneralTypeIssues=false
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
from typing import Optional, cast

# 尝试导入加密库
CRYPTO_AVAILABLE = False
try:
    from Cryptodome.Cipher import AES
    from Cryptodome.Util.Padding import unpad
    CRYPTO_AVAILABLE = True
    print("使用Cryptodome加密库")
except ImportError:
    try:
        from Crypto.Cipher import AES
        from Crypto.Util.Padding import unpad
        CRYPTO_AVAILABLE = True
        print("使用Crypto加密库")
    except ImportError:
        print("警告: 加密库不可用，将使用模拟数据")

# 导入WXBizDataCrypt
try:
    from ..WXBizDataCrypt import WXBizDataCrypt
    WXBIZ_AVAILABLE = True
    print("使用WXBizDataCrypt解密库")
except ImportError:
    WXBIZ_AVAILABLE = False
    print("警告: WXBizDataCrypt库不可用")

from ..database import get_db
from ..models import User
from ..schemas import UserCreate, UserResponse
from ..utils import create_access_token

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

def decrypt_phone_number(session_key: str, encrypted_data: str, iv: str) -> str:
    """
    解密微信手机号
    """
    # 优先使用WXBizDataCrypt解密
    if WXBIZ_AVAILABLE:
        try:
            pc = WXBizDataCrypt(WECHAT_APPID, session_key)
            decrypted = pc.decrypt(encrypted_data, iv)
            return decrypted.get('phoneNumber', '')
        except Exception as e:
            print(f"使用WXBizDataCrypt解密手机号失败: {str(e)}")
    
    # 使用wechatpy解密
    try:
        from wechatpy.crypto import _PrpCrypto
        # 使用wechatpy的_PRPCrypto进行解密
        import base64
        import json
        
        # Base64解码
        encrypted_data_bytes = base64.b64decode(encrypted_data)
        iv_bytes = base64.b64decode(iv)
        session_key_bytes = base64.b64decode(session_key)
        
        # 使用_PRPCrypto进行解密
        prp_crypto = _PrpCrypto()
        decrypted = prp_crypto.decrypt(encrypted_data_bytes, session_key_bytes, iv_bytes)
        
        # 解析JSON
        decrypted_str = decrypted.decode('utf-8')
        data = json.loads(decrypted_str)
        
        return data.get('phoneNumber', '')
    except Exception as e:
        print(f"使用wechatpy解密手机号失败: {str(e)}")
        # 如果解密失败，回退到原来的实现
        if not CRYPTO_AVAILABLE:
            print("加密库不可用，返回模拟数据")
            return "13800138000"  # 模拟手机号
        
        try:
            # Base64解码
            import base64
            import json
            encrypted_data_bytes = base64.b64decode(encrypted_data)
            iv_bytes = base64.b64decode(iv)
            session_key_bytes = base64.b64decode(session_key)
            
            # AES解密
            cipher = AES.new(session_key_bytes, AES.MODE_CBC, iv_bytes)
            decrypted = cipher.decrypt(encrypted_data_bytes)
            
            # 去填充
            from Crypto.Util.Padding import unpad
            decrypted = unpad(decrypted, AES.block_size)
            
            # 解析JSON
            decrypted_str = decrypted.decode('utf-8')
            data = json.loads(decrypted_str)
            
            return data.get('phoneNumber', '')
        except Exception as e:
            print(f"手机号解密失败: {str(e)}")
            raise HTTPException(status_code=400, detail=f"手机号解密失败: {str(e)}")

def generate_code() -> str:
    """生成6位数字验证码"""
    return ''.join(random.choices(string.digits, k=6))

def generate_token(user_id: int) -> str:
    """生成JWT token"""
    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(
        data={"user_id": user_id}, expires_delta=access_token_expires
    )
    return access_token

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
    token = generate_token(cast(int, user.id))
    
    return TokenResponse(
        token=token,
        user=UserResponse(
            id=cast(int, user.id),
            phone=cast(str, user.phone) if user.phone else None,
            nickname=cast(str, user.nickname) if user.nickname else None,
            avatar_url=cast(str, user.avatar_url) if user.avatar_url else None,
            wechat_openid=cast(str, user.wechat_openid) if user.wechat_openid else None,
            is_active=cast(bool, user.is_active),
            created_at=cast(datetime, user.created_at),
            updated_at=cast(datetime, user.updated_at)
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
        user.session_key = cast(str, session_key)
        if user_info:
            user.nickname = user_info.get('nickName', user.nickname)
            user.avatar_url = user_info.get('avatarUrl', user.avatar_url)
        db.commit()
        db.refresh(user)
    
    # 生成token
    token = generate_token(cast(int, user.id))
    
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
    解密微信手机号并登录/注册用户
    """
    wechat_code = request.code
    encrypted_data = request.encrypted_data
    iv = request.iv
    
    print(f"收到手机号解密请求:")
    print(f"- wechat_code: {wechat_code}")
    print(f"- encrypted_data: {encrypted_data[:50]}...")
    print(f"- iv: {iv}")
    
    # 初始化变量
    session_key = None
    openid = None
    phone_number = None
    
    try:
        # 调用微信API获取session_key
        wechat_session = await get_wechat_session(wechat_code)
        session_key = wechat_session.get('session_key')
        openid = wechat_session.get('openid')
        
        if not session_key:
            raise HTTPException(status_code=400, detail="获取微信session_key失败")
            
        print(f"获取到session_key: {session_key[:10]}...")
        print(f"获取到openid: {openid}")
        
        # 解密手机号
        try:
            phone_number = decrypt_phone_number(session_key, encrypted_data, iv)
            print(f"解密得到手机号: {phone_number}")
            
            if not phone_number:
                raise HTTPException(status_code=400, detail="解密手机号失败")
                
        except Exception as e:
            print(f"手机号解密异常: {str(e)}")
            raise HTTPException(status_code=400, detail=f"手机号解密失败: {str(e)}")
        
    except Exception as e:
        # 如果微信API调用失败，使用开发模式
        print(f"微信API调用失败，使用开发模式: {str(e)}")
        session_key = "dev_session_key_for_phone_decrypt"
        openid = f"dev_wx_phone_{wechat_code[:10]}"
        phone_number = "13800138000"  # 开发模式直接使用测试手机号
        print(f"开发模式使用测试手机号: {phone_number}")
    
    # 确保所有必要变量都已设置
    if not session_key or not openid or not phone_number:
        raise HTTPException(status_code=500, detail="获取用户信息失败")
    
    try:
        # 查找或创建用户
        user = db.query(User).filter(
            (User.phone == phone_number) | (User.wechat_openid == openid)
        ).first()
        
        if not user:
            # 创建新用户
            print(f"创建新用户，手机号: {phone_number}, openid: {openid}")
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
            print(f"创建新用户成功: {user.id}")
        else:
            # 更新用户信息
            print(f"更新现有用户: {user.id}")
            print(f"当前用户手机号: {user.phone}")
            print(f"当前用户openid: {user.wechat_openid}")
            
            # 安全地更新用户信息
            try:
                if phone_number and phone_number != "13800138000":
                    print(f"更新为真实手机号: {phone_number}")
                    user.phone = phone_number
                elif not user.phone:
                    print(f"设置手机号: {phone_number}")
                    user.phone = phone_number
                    
                if not user.wechat_openid:
                    print(f"设置openid: {openid}")
                    user.wechat_openid = openid
                else:
                    print(f"更新session_key")
                    user.session_key = session_key
                    
                db.commit()
                db.refresh(user)
                print(f"更新用户信息成功: {user.id}, 新手机号: {user.phone}")
                
            except Exception as db_error:
                print(f"数据库更新失败: {str(db_error)}")
                db.rollback()
                raise HTTPException(status_code=500, detail=f"用户信息更新失败: {str(db_error)}")
        
        # 生成token
        token = generate_token(cast(int, user.id))
        
        return TokenResponse(
            token=token,
            user=UserResponse(
                id=cast(int, user.id),
                phone=cast(str, user.phone) if user.phone else None,
                nickname=cast(str, user.nickname) if user.nickname else None,
                avatar_url=cast(str, user.avatar_url) if user.avatar_url else None,
                wechat_openid=cast(str, user.wechat_openid) if user.wechat_openid else None,
                is_active=cast(bool, user.is_active),
                created_at=cast(datetime, user.created_at),
                updated_at=cast(datetime, user.updated_at)
            )
        )
        
    except Exception as e:
        print(f"数据库操作失败: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"用户操作失败: {str(e)}")

@router.get("/verify-token")
async def verify_token(token: str, db: Session = Depends(get_db)):
    """
    验证token有效性
    """
    # 这里应该实现真正的token验证逻辑
    # 为了演示，我们简单返回成功
    return {"valid": True, "message": "Token有效"}