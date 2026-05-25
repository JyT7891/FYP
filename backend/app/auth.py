from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
import jwt
import uuid

from app.config import settings
from app.database import users_collection
from app.models import RegisterRequest, LoginRequest, TwoFactorLoginRequest, TwoFactorVerifyRequest
from app.utils.email import send_verification_email
from app.utils.security import create_token, create_temp_token, decode_token, verify_password, hash_password
import pyotp

router = APIRouter()
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    return decode_token(credentials.credentials)


@router.post("/register")
def register(data: RegisterRequest):
    if users_collection.find_one({"email": data.email}):
        raise HTTPException(status_code=400, detail="Email already in use.")
    
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    
    verification_token = str(uuid.uuid4())
    hashed = hash_password(data.password)
    
    result = users_collection.insert_one({
        "name": data.name,
        "email": data.email,
        "password": hashed,
        "role": data.role,
        "avatar": "",
        "email_verified": False,
        "verification_token": verification_token,
        "token_expires": datetime.utcnow() + timedelta(hours=24),
        "two_factor_enabled": False,
        "two_factor_secret": None,
        "created_at": datetime.utcnow(),
    })
    
    send_verification_email(data.email, verification_token, data.name)
    token = create_token(str(result.inserted_id), data.role)
    
    return {
        "token": token,
        "role": data.role,
        "name": data.name,
        "avatar": "",
        "email_verified": False,
        "two_factor_enabled": False
    }


@router.post("/login")
def login(data: LoginRequest):
    user = users_collection.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    if user.get("two_factor_enabled", False):
        temp_token = create_temp_token(str(user["_id"]), user["role"])
        return {"requires_2fa": True, "temp_token": temp_token, "user_id": str(user["_id"])}
    
    token = create_token(str(user["_id"]), user["role"])
    return {
        "token": token,
        "role": user["role"],
        "name": user["name"],
        "avatar": user.get("avatar", ""),
        "email_verified": user.get("email_verified", False),
        "two_factor_enabled": user.get("two_factor_enabled", False),
    }


@router.post("/login/2fa")
def login_2fa(data: TwoFactorLoginRequest):
    from bson import ObjectId
    
    try:
        payload = jwt.decode(data.temp_token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id = payload["sub"]
    except:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    secret = user.get("two_factor_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="2FA not enabled")
    
    totp = pyotp.TOTP(secret)
    if not totp.verify(data.code):
        raise HTTPException(status_code=401, detail="Invalid 2FA code")
    
    token = create_token(str(user["_id"]), user["role"])
    return {
        "token": token,
        "role": user["role"],
        "name": user["name"],
        "avatar": user.get("avatar", ""),
        "email_verified": user.get("email_verified", False),
        "two_factor_enabled": True,
    }


@router.get("/verify-email")
def verify_email(token: str):
    from bson import ObjectId
    
    user = users_collection.find_one({
        "verification_token": token,
        "token_expires": {"$gt": datetime.utcnow()}
    })
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"email_verified": True}, "$unset": {"verification_token": "", "token_expires": ""}}
    )
    
    return {"message": "Email verified successfully"}


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    from bson import ObjectId
    
    user = users_collection.find_one({"_id": ObjectId(current_user["sub"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": current_user["sub"],
        "role": current_user["role"],
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "avatar": user.get("avatar", ""),
        "email_verified": user.get("email_verified", False),
        "two_factor_enabled": user.get("two_factor_enabled", False),
        "created_at": user.get("created_at"),
    }