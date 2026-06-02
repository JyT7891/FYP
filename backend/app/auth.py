from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
import jwt
import uuid
import secrets
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import settings
from app.database import users_collection
from app.models import RegisterRequest, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest
from app.utils.security import create_token, decode_token, verify_password, hash_password
from app.utils.email import send_verification_email  # Use your existing email function

router = APIRouter()
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    return decode_token(credentials.credentials)


def send_password_reset_email(email: str, token: str, name: str):
    """Send password reset email to user"""
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #0a192f, #020c1b); padding: 20px; text-align: center; }}
            .header h1 {{ color: #2dd4bf; }}
            .button {{ display: inline-block; padding: 12px 24px; background: #2dd4bf; color: white; text-decoration: none; border-radius: 6px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header"><h1>🛡️ AegisPhish</h1></div>
            <div class="content">
                <h2>Hello, {name}!</h2>
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                <div style="text-align: center;">
                    <a href="{reset_url}" class="button">Reset Password</a>
                </div>
                <p>Or copy this link: <a href="{reset_url}">{reset_url}</a></p>
                <p>This link expires in <strong>1 hour</strong>.</p>
                <p>If you didn't request this, please ignore this email.</p>
                <hr>
                <p style="font-size: 12px; color: #666;">AegisPhish - Protecting you from phishing attacks</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    msg = MIMEMultipart()
    msg["Subject"] = "Reset Your AegisPhish Password"
    msg["From"] = settings.SMTP_USER
    msg["To"] = email
    msg.attach(MIMEText(html, "html"))
    
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        print(f"✅ Password reset email sent to {email}")
        return True
    except Exception as e:
        print(f"❌ Email error: {e}")
        return False


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
    }


@router.post("/login")
def login(data: LoginRequest):
    user = users_collection.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    token = create_token(str(user["_id"]), user["role"])
    return {
        "token": token,
        "role": user["role"],
        "name": user["name"],
        "avatar": user.get("avatar", ""),
        "email_verified": user.get("email_verified", False),
    }


@router.get("/verify-email")
def verify_email(token: str):
    """Verify user email with token"""
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


@router.post("/resend-verification")
def resend_verification(current_user: dict = Depends(get_current_user)):
    """Resend verification email to user"""
    from bson import ObjectId
    
    user = users_collection.find_one({"_id": ObjectId(current_user["sub"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("email_verified", False):
        raise HTTPException(status_code=400, detail="Email already verified")
    
    verification_token = str(uuid.uuid4())
    users_collection.update_one(
        {"_id": ObjectId(current_user["sub"])},
        {"$set": {
            "verification_token": verification_token,
            "token_expires": datetime.utcnow() + timedelta(hours=24)
        }}
    )
    
    send_verification_email(user["email"], verification_token, user["name"])
    
    return {"message": "Verification email sent successfully"}


@router.get("/check-email")
def check_email_exists(email: str):
    """Check if email is already registered"""
    user = users_collection.find_one({"email": email})
    return {"exists": user is not None}


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest):
    """Send password reset email"""
    user = users_collection.find_one({"email": data.email})
    
    if not user:
        return {"message": "If your email is registered, you will receive a reset link."}
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "reset_token": reset_token,
            "reset_token_expires": datetime.utcnow() + timedelta(hours=1)
        }}
    )
    
    send_password_reset_email(data.email, reset_token, user["name"])
    
    return {"message": "If your email is registered, you will receive a reset link."}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest):
    """Reset password using token"""
    from bson import ObjectId
    
    user = users_collection.find_one({
        "reset_token": data.token,
        "reset_token_expires": {"$gt": datetime.utcnow()}
    })
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password": hash_password(data.new_password)},
            "$unset": {"reset_token": "", "reset_token_expires": ""}
        }
    )
    
    return {"message": "Password reset successfully"}


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
        "created_at": user.get("created_at"),
    }