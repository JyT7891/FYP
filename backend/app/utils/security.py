from datetime import datetime, timedelta
import bcrypt
import jwt
from fastapi import HTTPException

from app.config import settings

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=settings.JWT_EXPIRES_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

# Decode and verify JWT access token
def decode_token(token: str) -> dict:
        # Attempt to decode token and validate signature/expiration
    try:
            # Return decoded token payload if valid
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        # Handle expired token error
    except jwt.ExpiredSignatureError:
        # Handle expired token error
        raise HTTPException(status_code=401, detail="Token expired.")
        # Handle invalid or malformed token
    except jwt.InvalidTokenError:
        # Handle invalid or malformed token
        raise HTTPException(status_code=401, detail="Invalid token.")