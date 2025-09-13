# pyright: reportAttributeAccessIssue=false
# pyright: reportArgumentType=false
# pyright: reportPossiblyUnboundVariable=false
# pyright: reportMissingImports=false
# pyright: reportGeneralTypeIssues=false
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import random
import string
import requests
import os
import base64
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, cast
from jose import jwt, JWTError

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
from ..utils import create_access_token, create_refresh_token, verify_token

router = APIRouter(tags=["认证"])

# 微信小程序配置

WECHAT_APPID = os.getenv("WECHAT_APPID")
WECHAT_SECRET = os.getenv("WECHAT_SECRET")
# JWT配置
SECRET_KEY =  os.getenv("JWT_SECRET_KEY")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

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
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse

class RefreshTokenRequest(BaseModel):
    refresh_token: str

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

def generate_tokens(user_id: int) -> tuple[str, str]:
    """生成访问令牌和刷新令牌"""
    access_token_expires = timedelta(minutes=30)
    refresh_token_expires = timedelta(minutes=1440)  # 24小时
    
    access_token = create_access_token(
        data={"user_id": user_id, "type": "access"}, 
        expires_delta=access_token_expires
    )
    
    refresh_token = create_refresh_token(
        data={"user_id": user_id, "type": "refresh"}, 
        expires_delta=refresh_token_expires
    )
    
    return access_token, refresh_token


# 可选：配置日志（推荐）
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def get_wechat_session(code: str) -> dict:
    """
    通过微信API获取session_key和openid
    """
    url = "https://api.weixin.qq.com/sns/jscode2session"  # 确保没有空格！
    params = {
        "appid": WECHAT_APPID,
        "secret": WECHAT_SECRET,
        "js_code": code,
        "grant_type": "authorization_code"
    }

    logger.info(f"→ 请求微信API: {url}")
    logger.info(f"→ 参数: {params}")

    try:
        response = requests.get(url, params=params, timeout=10)
        logger.info(f"← 微信原始响应状态码: {response.status_code}")
        logger.info(f"← 微信原始响应内容: {response.text}")  # 👈 关键！打印原始 text

        # 尝试解析 JSON
        data = response.json()

        # 微信业务错误
        if data.get("errcode", 0) != 0:
            errmsg = data.get("errmsg", "未知错误")
            logger.error(f"× 微信业务错误: [errcode={data.get('errcode')}] {errmsg}")
            raise HTTPException(
                status_code=400,
                detail=f"微信API错误: [errcode={data.get('errcode')}] {errmsg}"
            )

        logger.info(f"✓ 微信返回成功: {data}")
        return data

    except requests.exceptions.Timeout:
        logger.error("× 请求微信API超时")
        raise HTTPException(status_code=500, detail="请求微信API超时，请稍后重试")

    except requests.exceptions.ConnectionError as e:
        logger.error(f"× 网络连接错误: {str(e)}")
        raise HTTPException(status_code=500, detail=f"网络连接失败: {str(e)}")

    except requests.exceptions.RequestException as e:
        logger.error(f"× 请求异常: {str(e)}")
        raise HTTPException(status_code=500, detail=f"请求微信API失败: {str(e)}")

    except ValueError as e:
        # response.json() 解析失败（比如微信返回了非 JSON）
        logger.error(f"× JSON解析失败，原始内容: {response.text}")
        raise HTTPException(status_code=500, detail="微信返回数据格式错误")

    except Exception as e:
        logger.error(f"× 未知异常: {str(e)}")
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")

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
    access_token, refresh_token = generate_tokens(cast(int, user.id))
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
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
    access_token, refresh_token = generate_tokens(cast(int, user.id))
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
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
    print(f"  code: {wechat_code}")
    print(f"  encrypted_data长度: {len(encrypted_data)}")
    print(f"  iv长度: {len(iv)}")
    
    # 调用微信API获取session_key
    try:
        wechat_session = await get_wechat_session(wechat_code)
        session_key = wechat_session.get('session_key')
        openid = wechat_session.get('openid')
        
        if not session_key or not openid:
            raise HTTPException(status_code=400, detail="获取微信会话信息失败")
            
    except Exception as e:
        print(f"微信API调用失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取微信会话信息失败: {str(e)}")
    
    # 解密手机号
    try:
        phone_number = decrypt_phone_number(session_key, encrypted_data, iv)
        print(f"解密得到手机号: {phone_number}")
    except Exception as e:
        print(f"手机号解密失败: {str(e)}")
        raise HTTPException(status_code=400, detail=f"手机号解密失败: {str(e)}")
    
    # 查找或创建用户
    user = db.query(User).filter(User.phone == phone_number).first()
    
    if not user:
        # 查找是否已有微信用户
        wx_user = db.query(User).filter(User.wechat_openid == openid).first()
        if wx_user:
            # 更新现有微信用户
            user = wx_user
            user.phone = phone_number
            user.session_key = session_key
        else:
            # 创建新用户
            user = User(
                phone=phone_number,
                wechat_openid=openid,
                session_key=session_key,
                nickname=f"用户{phone_number[-4:]}",  # 使用手机号后4位作为默认昵称
                is_active=True
            )
        db.add(user)
    else:
        # 更新用户信息
        user.wechat_openid = openid
        user.session_key = session_key
    
    try:
        db.commit()
        db.refresh(user)
    except Exception as e:
        db.rollback()
        print(f"数据库操作失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"用户信息保存失败: {str(e)}")
    
    # 生成token
    access_token, refresh_token = generate_tokens(cast(int, user.id))
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
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

@router.post("/refresh-token", response_model=TokenResponse)
async def refresh_access_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    刷新访问令牌
    """
    try:
        # 验证刷新令牌
        payload = jwt.decode(request.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        token_type = payload.get("type")
        
        if user_id is None or token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的刷新令牌",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 查找用户
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户不存在",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户已被禁用",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 生成新的访问令牌（刷新令牌保持不变）
        access_token_expires = timedelta(minutes=30)
        new_access_token = create_access_token(
            data={"user_id": user_id, "type": "access"}, 
            expires_delta=access_token_expires
        )
        
        # 生成新的刷新令牌
        refresh_token_expires = timedelta(minutes=1440)  # 24小时
        new_refresh_token = create_refresh_token(
            data={"user_id": user_id, "type": "refresh"}, 
            expires_delta=refresh_token_expires
        )
        
        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
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
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的刷新令牌",
            headers={"WWW-Authenticate": "Bearer"},
        )