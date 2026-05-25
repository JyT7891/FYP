import os
import uuid
import shutil
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from bson import ObjectId
import pyotp

from app.database import users_collection, scans_collection, reports_collection
from app.models import ProfileUpdateRequest, PasswordUpdateRequest, TwoFactorVerifyRequest
from app.auth import get_current_user
from app.utils.security import hash_password, verify_password
from app.utils.email import send_verification_email
from app.config import settings
import qrcode
from io import BytesIO
import base64 as b64
from datetime import datetime, timedelta

router = APIRouter()


@router.patch("/profile")
def update_profile(data: ProfileUpdateRequest, current_user: dict = Depends(get_current_user)):
    update = {}
    if data.name.strip():
        update["name"] = data.name.strip()
    if data.email.strip():
        existing = users_collection.find_one({"email": data.email})
        if existing and str(existing["_id"]) != current_user["sub"]:
            raise HTTPException(status_code=400, detail="Email already in use.")
        update["email"] = data.email.strip()
        update["email_verified"] = False
        update["verification_token"] = str(uuid.uuid4())
        update["token_expires"] = datetime.utcnow() + timedelta(hours=24)
        send_verification_email(data.email.strip(), update["verification_token"], data.name.strip() if data.name.strip() else current_user.get("name", "User"))
    
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    
    users_collection.update_one({"_id": ObjectId(current_user["sub"])}, {"$set": update})
    return {"message": "Profile updated."}


@router.patch("/password")
def update_password(data: PasswordUpdateRequest, current_user: dict = Depends(get_current_user)):
    user = users_collection.find_one({"_id": ObjectId(current_user["sub"])})
    if not verify_password(data.current_password, user["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters.")
    users_collection.update_one(
        {"_id": ObjectId(current_user["sub"])},
        {"$set": {"password": hash_password(data.new_password)}}
    )
    return {"message": "Password updated."}


@router.post("/avatar")
async def upload_avatar(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPG, PNG, or WebP allowed.")
    
    if file.size and file.size > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File must be under 2MB.")
    
    user = users_collection.find_one({"_id": ObjectId(current_user["sub"])})
    old_avatar = user.get("avatar", "") if user else ""
    
    if old_avatar and old_avatar.startswith("/static/avatars/"):
        old_file_path = old_avatar.lstrip("/")
        if os.path.exists(old_file_path):
            try:
                os.remove(old_file_path)
            except Exception as e:
                print(f"Error deleting old avatar: {e}")
    
    ext = file.filename.split(".")[-1].lower()
    filename = f"{uuid.uuid4()}.{ext}"
    save_path = f"static/avatars/{filename}"
    
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    avatar_url = f"/static/avatars/{filename}"
    users_collection.update_one({"_id": ObjectId(current_user["sub"])}, {"$set": {"avatar": avatar_url}})
    
    return {"avatar": avatar_url}


@router.delete("/avatar")
def delete_avatar(current_user: dict = Depends(get_current_user)):
    user = users_collection.find_one({"_id": ObjectId(current_user["sub"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_avatar = user.get("avatar", "")
    if current_avatar and current_avatar.startswith("/static/avatars/"):
        file_path = current_avatar.lstrip("/")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Error deleting avatar file: {e}")
    
    users_collection.update_one({"_id": ObjectId(current_user["sub"])}, {"$set": {"avatar": ""}})
    return {"message": "Avatar removed successfully."}


@router.post("/2fa/enable")
def enable_2fa(current_user: dict = Depends(get_current_user)):
    secret = pyotp.random_base32()
    user = users_collection.find_one({"_id": ObjectId(current_user["sub"])})
    
    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=user["email"], issuer_name="AegisPhish")
    
    qr = qrcode.QRCode(box_size=10, border=4)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    qr_base64 = b64.b64encode(buffered.getvalue()).decode()
    
    users_collection.update_one({"_id": ObjectId(current_user["sub"])}, {"$set": {"pending_2fa_secret": secret}})
    
    return {"secret": secret, "qr_code": qr_base64, "uri": uri}


@router.post("/2fa/verify")
def verify_2fa(data: TwoFactorVerifyRequest, current_user: dict = Depends(get_current_user)):
    user = users_collection.find_one({"_id": ObjectId(current_user["sub"])})
    secret = user.get("pending_2fa_secret")
    
    if not secret:
        raise HTTPException(status_code=400, detail="No pending 2FA setup")
    
    totp = pyotp.TOTP(secret)
    if not totp.verify(data.code):
        raise HTTPException(status_code=400, detail="Invalid code")
    
    users_collection.update_one(
        {"_id": ObjectId(current_user["sub"])},
        {"$set": {"two_factor_enabled": True, "two_factor_secret": secret}, "$unset": {"pending_2fa_secret": ""}}
    )
    
    return {"message": "2FA enabled successfully"}


@router.post("/2fa/disable")
def disable_2fa(data: TwoFactorVerifyRequest, current_user: dict = Depends(get_current_user)):
    user = users_collection.find_one({"_id": ObjectId(current_user["sub"])})
    secret = user.get("two_factor_secret")
    
    if secret:
        totp = pyotp.TOTP(secret)
        if not totp.verify(data.code):
            raise HTTPException(status_code=400, detail="Invalid code")
    
    users_collection.update_one(
        {"_id": ObjectId(current_user["sub"])},
        {"$set": {"two_factor_enabled": False, "two_factor_secret": None}}
    )
    
    return {"message": "2FA disabled successfully"}


@router.delete("/delete")
def delete_account(current_user: dict = Depends(get_current_user)):
    user = users_collection.find_one({"_id": ObjectId(current_user["sub"])})
    current_avatar = user.get("avatar", "")
    
    if current_avatar and current_avatar.startswith("/static/avatars/"):
        file_path = current_avatar.lstrip("/")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Error deleting avatar file: {e}")
    
    users_collection.delete_one({"_id": ObjectId(current_user["sub"])})
    scans_collection.delete_many({"user_id": current_user["sub"]})
    reports_collection.delete_many({"reported_by": current_user["sub"]})
    
    return {"message": "Account deleted successfully."}