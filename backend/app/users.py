# User profile management module (profile updates, password changes, avatar handling, account deletion)
import os
import uuid
import shutil
import random
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from bson import ObjectId
from datetime import datetime, timedelta

from app.database import users_collection, scans_collection, reports_collection
from app.models import ProfileUpdateRequest, PasswordUpdateRequest
from app.auth import get_current_user
from app.utils.security import hash_password, verify_password
from app.utils.email import send_verification_code_email

# Initialize FastAPI router for user-related endpoints
router = APIRouter()

# Temporary in-memory store for email change verification codes
profile_verification_codes = {}


# Update user profile information (name/email)
@router.patch("/profile")
def update_profile(data: ProfileUpdateRequest, current_user: dict = Depends(get_current_user)):
    update = {}
    email_changed = False
    
    if data.name.strip():
        update["name"] = data.name.strip()
    
    if data.email.strip():
        # Check email not taken by another user
        existing = users_collection.find_one({"email": data.email})
        if existing and str(existing["_id"]) != current_user["sub"]:
            raise HTTPException(status_code=400, detail="Email already in use.")
        
        update["email"] = data.email.strip()
        update["email_verified"] = False
        email_changed = True
        
        # Generate 6-digit verification code
        verification_code = str(random.randint(100000, 999999))
        
        # Store in profile verification storage
        profile_verification_codes[current_user["sub"]] = {
            "email": data.email.strip(),
            "code": verification_code,
            "expires": datetime.utcnow() + timedelta(minutes=10),
            "name": data.name.strip() if data.name.strip() else current_user.get("name", "User")
        }
        
        # Send verification code email (6-digit code)
        send_verification_code_email(
            data.email.strip(), 
            verification_code, 
            data.name.strip() if data.name.strip() else current_user.get("name", "User")
        )
    
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    
    users_collection.update_one({"_id": ObjectId(current_user["sub"])}, {"$set": update})
    return {"message": "Profile updated.", "email_changed": email_changed}


# Verify email change using 6-digit code
@router.post("/verify-email-change")
def verify_email_change(data: dict, current_user: dict = Depends(get_current_user)):
    """Verify email change with 6-digit code"""
    from bson import ObjectId
    
    code = data.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Code is required")
    
    # Get the pending verification for this user
    pending = profile_verification_codes.get(current_user["sub"])
    if not pending:
        raise HTTPException(status_code=400, detail="No pending email verification. Please request a new code.")
    
    # Check if code expired
    if datetime.utcnow() > pending["expires"]:
        del profile_verification_codes[current_user["sub"]]
        raise HTTPException(status_code=400, detail="Verification code expired. Please request a new code.")
    
    # Check if code matches
    if pending["code"] != code:
        raise HTTPException(status_code=400, detail="Invalid verification code. Please try again.")
    
    # Update user's email_verified to True
    users_collection.update_one(
        {"_id": ObjectId(current_user["sub"])},
        {"$set": {"email_verified": True}}
    )
    
    # Clean up
    del profile_verification_codes[current_user["sub"]]
    
    return {"message": "Email verified successfully"}


# Resend verification code for email change
@router.post("/resend-profile-verification")
def resend_profile_verification(current_user: dict = Depends(get_current_user)):
    """Resend verification code for profile email change"""
    from bson import ObjectId
    
    # Get the pending verification for this user
    pending = profile_verification_codes.get(current_user["sub"])
    if not pending:
        raise HTTPException(status_code=400, detail="No pending email verification. Please change your email again.")
    
    # Generate new 6-digit verification code
    new_code = str(random.randint(100000, 999999))
    
    # Update the pending verification
    pending["code"] = new_code
    pending["expires"] = datetime.utcnow() + timedelta(minutes=10)
    profile_verification_codes[current_user["sub"]] = pending
    
    # Send new verification code email
    send_verification_code_email(
        pending["email"], 
        new_code, 
        pending.get("name", "User")
    )
    
    return {"message": "New verification code sent successfully"}


# Update user password
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


# Upload user avatar image
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


# Delete user avatar image
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


# Delete user account and all associated data
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