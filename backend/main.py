import base64
import difflib
import os
import shutil
import time
import uuid
from datetime import datetime, timedelta
from urllib.parse import urlparse

import joblib
import numpy as np
import pandas as pd
import requests
import shap
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from tranco import Tranco
from pymongo import MongoClient
from dotenv import load_dotenv
import bcrypt
import jwt
import certifi

# ============================================================
# 1. INITIALIZATION & CONFIGURATION
# ============================================================

# Load Environment Variables
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_EXPIRES_DAYS = int(os.getenv("JWT_EXPIRES_DAYS", 7))
VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

# Create static directories for avatars
os.makedirs("static/avatars", exist_ok=True)

# MongoDB Connection
mongo_client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
db = mongo_client["aegisphish"]
users_collection = db["users"]
scans_collection = db["scans"]
reports_collection = db["reports"]

# Create indexes for better performance
users_collection.create_index("email", unique=True)
scans_collection.create_index([("user_id", 1), ("scanned_at", -1)])
reports_collection.create_index("status")

# Load ML Models
rf = joblib.load("rf_model.pkl")
scaler = joblib.load("scaler.pkl")
feature_columns = joblib.load("feature_columns.pkl")
explainer = shap.TreeExplainer(rf)

# Constants
CACHE_TTL = 60 * 60 * 24  # 24 hours
TRUST_REPUTATION_THRESHOLD = 0.05

# In-Memory Cache
reputation_cache: dict = {}
cache_timestamp: dict = {}
TOP_DOMAINS: list = []

# Initialize FastAPI
app = FastAPI(title="AegisPhish API", description="Phishing Detection System", version="1.0.0")

# Mount static files for avatars
app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


# ============================================================
# 2. STARTUP EVENT
# ============================================================

@app.on_event("startup")
async def startup_event():
    global TOP_DOMAINS
    try:
        t = Tranco(cache=True)
        TOP_DOMAINS = t.list().top(1000)
        print("✅ Tranco Top 1000 loaded.")
    except Exception as e:
        print(f"⚠️ Tranco error: {e}")
        TOP_DOMAINS = ["google.com", "apple.com", "facebook.com"]
    print("🚀 AegisPhish API is running!")


# ============================================================
# 3. PYDANTIC SCHEMAS
# ============================================================

class URLRequest(BaseModel):
    url: str

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "user"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ReportRequest(BaseModel):
    url: str
    note: str = ""

class ProfileUpdateRequest(BaseModel):
    name: str = ""
    email: str = ""

class PasswordUpdateRequest(BaseModel):
    current_password: str
    new_password: str


# ============================================================
# 4. AUTHENTICATION HELPERS
# ============================================================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRES_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    return decode_token(credentials.credentials)


# ============================================================
# 5. AUTHENTICATION ROUTES
# ============================================================

@app.post("/api/auth/register", tags=["Authentication"])
def register(data: RegisterRequest):
    """Register a new user"""
    if users_collection.find_one({"email": data.email}):
        raise HTTPException(status_code=400, detail="Email already in use.")

    if data.role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role.")

    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    hashed = hash_password(data.password)
    result = users_collection.insert_one({
        "name": data.name,
        "email": data.email,
        "password": hashed,
        "role": data.role,
        "avatar": "",
        "created_at": datetime.utcnow(),
    })

    token = create_token(str(result.inserted_id), data.role)
    return {"token": token, "role": data.role, "name": data.name, "avatar": ""}


@app.post("/api/auth/login", tags=["Authentication"])
def login(data: LoginRequest):
    """Login with email and password"""
    user = users_collection.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_token(str(user["_id"]), user["role"])
    return {
        "token": token,
        "role": user["role"],
        "name": user["name"],
        "avatar": user.get("avatar", ""),
    }


@app.get("/api/auth/me", tags=["Authentication"])
def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info with full details"""
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
        "created_at": user.get("created_at"),
    }


# ============================================================
# 6. USER PROFILE ROUTES
# ============================================================

@app.patch("/api/user/profile", tags=["User Profile"])
def update_profile(data: ProfileUpdateRequest, current_user: dict = Depends(get_current_user)):
    """Update user profile information"""
    from bson import ObjectId
    update = {}
    if data.name.strip():
        update["name"] = data.name.strip()
    if data.email.strip():
        existing = users_collection.find_one({"email": data.email})
        if existing and str(existing["_id"]) != current_user["sub"]:
            raise HTTPException(status_code=400, detail="Email already in use.")
        update["email"] = data.email.strip()
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    users_collection.update_one({"_id": ObjectId(current_user["sub"])}, {"$set": update})
    return {"message": "Profile updated."}


@app.patch("/api/user/password", tags=["User Profile"])
def update_password(data: PasswordUpdateRequest, current_user: dict = Depends(get_current_user)):
    """Update user password"""
    from bson import ObjectId
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


@app.post("/api/user/avatar", tags=["User Profile"])
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload user avatar image - automatically deletes old avatar"""
    from bson import ObjectId
    
    # Validate file type
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPG, PNG, or WebP allowed.")

    # Validate file size (max 2MB)
    if file.size and file.size > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File must be under 2MB.")

    # Get current user to check for existing avatar
    user = users_collection.find_one({"_id": ObjectId(current_user["sub"])})
    old_avatar = user.get("avatar", "") if user else ""
    
    # Delete old avatar file if it exists
    if old_avatar and old_avatar.startswith("/static/avatars/"):
        old_file_path = old_avatar.lstrip("/")
        if os.path.exists(old_file_path):
            try:
                os.remove(old_file_path)
                print(f"✅ Deleted old avatar: {old_file_path}")
            except Exception as e:
                print(f"⚠️ Error deleting old avatar: {e}")
    
    # Generate unique filename
    ext = file.filename.split(".")[-1].lower()
    filename = f"{uuid.uuid4()}.{ext}"
    save_path = f"static/avatars/{filename}"

    # Save new file
    try:
        with open(save_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        print(f"✅ Saved new avatar: {save_path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    avatar_url = f"/static/avatars/{filename}"

    # Update database with new avatar URL
    users_collection.update_one(
        {"_id": ObjectId(current_user["sub"])},
        {"$set": {"avatar": avatar_url}}
    )

    return {"avatar": avatar_url}


@app.delete("/api/user/avatar", tags=["User Profile"])
def delete_avatar(current_user: dict = Depends(get_current_user)):
    """Remove user avatar and revert to default"""
    from bson import ObjectId
    
    # Get current user
    user = users_collection.find_one({"_id": ObjectId(current_user["sub"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_avatar = user.get("avatar", "")
    
    # Delete the file if it exists
    if current_avatar and current_avatar.startswith("/static/avatars/"):
        file_path = current_avatar.lstrip("/")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                print(f"✅ Deleted avatar file: {file_path}")
            except Exception as e:
                print(f"⚠️ Error deleting avatar file: {e}")
                # Don't raise exception - we still want to clear the database reference
        else:
            print(f"⚠️ Avatar file not found: {file_path}")
    
    # Update database to remove avatar reference
    result = users_collection.update_one(
        {"_id": ObjectId(current_user["sub"])},
        {"$set": {"avatar": ""}}
    )
    
    if result.modified_count == 0:
        print(f"⚠️ No database update needed for user {current_user['sub']}")
    
    return {"message": "Avatar removed successfully. Default avatar restored."}


@app.delete("/api/user/delete", tags=["User Profile"])
def delete_account(current_user: dict = Depends(get_current_user)):
    """Delete user account and all associated data"""
    from bson import ObjectId
    
    # Delete avatar file if exists
    user = users_collection.find_one({"_id": ObjectId(current_user["sub"])})
    current_avatar = user.get("avatar", "")
    if current_avatar and current_avatar.startswith("/static/avatars/"):
        file_path = current_avatar.lstrip("/")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Error deleting avatar file: {e}")
    
    # Delete user data
    users_collection.delete_one({"_id": ObjectId(current_user["sub"])})
    scans_collection.delete_many({"user_id": current_user["sub"]})
    reports_collection.delete_many({"reported_by": current_user["sub"]})
    
    return {"message": "Account deleted successfully."}


# ============================================================
# 7. FEATURE EXTRACTION (ML HELPERS)
# ============================================================

def extract_url_features(url: str) -> dict:
    url_lower = url.lower()
    return {
        "url_length": len(url),
        "num_dots": url.count("."),
        "num_hyphens": url.count("-"),
        "num_underscores": url.count("_"),
        "num_digits": sum(c.isdigit() for c in url),
        "num_slashes": url.count("/"),
        "has_https": int("https" in url),
        "has_http": int("http://" in url),
        "has_at": int("@" in url),
        "has_ip": int(any(part.isdigit() for part in url.split("/")[0].split("."))),
        "has_login": int("login" in url_lower),
        "has_secure": int("secure" in url_lower),
        "has_verify": int("verify" in url_lower),
        "has_update": int("update" in url_lower),
        "has_account": int("account" in url_lower),
        "subdomain_count": url.count(".") - 1 if url.count(".") > 0 else 0,
        "tld_length": len(url.split(".")[-1]) if "." in url else 0,
    }


def build_features(url: str) -> dict:
    url_lower = url.lower()
    domain = url.split("//")[-1].split("/")[0] if "//" in url else url
    return {
        "length_url": len(url),
        "length_hostname": len(domain),
        "nb_dots": url.count("."),
        "nb_hyphens": url.count("-"),
        "nb_at": url.count("@"),
        "nb_qm": url.count("?"),
        "nb_and": url.count("&"),
        "nb_eq": url.count("="),
        "nb_slash": url.count("/"),
        "nb_www": int("www" in url_lower),
        "http_in_path": int("http" in url_lower),
        "https_token": int("https" in url_lower),
        "ratio_digits_url": sum(c.isdigit() for c in url) / max(len(url), 1),
        "ratio_digits_host": sum(c.isdigit() for c in domain) / max(len(domain), 1),
        "shortening_service": int(any(x in url_lower for x in ["bit.ly", "tinyurl", "t.co"])),
        "ip": int(any(part.isdigit() for part in domain.split("."))),
        "web_traffic": 0,
        "page_rank": 0,
        "dns_record": 1,
        "google_index": 1,
        "domain_age": 0,
    }


def prepare_input(url: str) -> pd.DataFrame:
    feats = build_features(url)
    return pd.DataFrame(
        [[feats.get(col, 0) for col in feature_columns]],
        columns=feature_columns,
    )


def get_shap_explanation(feature_vector) -> dict:
    X = np.array([feature_vector])
    shap_values = explainer.shap_values(X)
    values = shap_values[1][0] if isinstance(shap_values, list) else shap_values[0]
    values = [float(x) for x in np.array(values).flatten()]
    return dict(zip(feature_columns, values))


def explain_features(features: dict, prediction: int, prob: float, is_typo: bool = False) -> list[str]:
    reasons = []

    if is_typo:
        reasons.append("Possible typosquatting/brand impersonation detected (matches top 1000 domain patterns)")

    if prediction == 1 or prob > 0.4:
        if features.get("has_ip") == 1:
            reasons.append("Uses IP address instead of domain")
        if features.get("has_at") == 1:
            reasons.append("Contains '@' symbol")
        if features.get("num_hyphens", 0) > 3:
            reasons.append("Excessive hyphens in domain")
        if features.get("num_digits", 0) > 5:
            reasons.append("High number of digits in URL")
        if features.get("has_https") == 0:
            reasons.append("No HTTPS security indicator")

    if not reasons:
        reasons.append("URL appears structurally normal")

    return reasons


def extract_domain(url: str) -> str:
    if not url.startswith("http"):
        url = "http://" + url
    parsed = urlparse(url)
    return parsed.netloc.lower().replace("www.", "")


def is_typosquatting(url: str) -> bool:
    user_domain = extract_domain(url)
    if user_domain in TOP_DOMAINS:
        return False
    return any(
        0.8 <= difflib.SequenceMatcher(None, user_domain, top_domain).ratio() < 1.0
        for top_domain in TOP_DOMAINS
    )


# ============================================================
# 8. VIRUSTOTAL REPUTATION
# ============================================================

def get_reputation_score(url: str) -> float:
    if url in reputation_cache and time.time() - cache_timestamp[url] < CACHE_TTL:
        return reputation_cache[url]

    try:
        url_id = base64.urlsafe_b64encode(url.encode()).decode().strip("=")
        response = requests.get(
            f"https://www.virustotal.com/api/v3/urls/{url_id}",
            headers={"x-apikey": VIRUSTOTAL_API_KEY},
        )
        if response.status_code != 200:
            return 0.5

        stats = (
            response.json()
            .get("data", {})
            .get("attributes", {})
            .get("last_analysis_stats", {})
        )
        malicious = stats.get("malicious", 0)
        harmless = stats.get("harmless", 0)
        total = malicious + harmless
        score = 0.5 if total == 0 else (malicious + 1) / (total + 2)

    except Exception:
        score = 0.5

    reputation_cache[url] = score
    cache_timestamp[url] = time.time()
    return score


# ============================================================
# 9. CORE PREDICTION ROUTE
# ============================================================

@app.post("/predict", tags=["Prediction"])
def predict(data: URLRequest, current_user: dict = Depends(get_current_user)):
    """Analyze a URL for phishing detection"""
    try:
        url = data.url
        reputation_score = get_reputation_score(url)
        typo_detected = is_typosquatting(url)

        # High reputation domain check
        if reputation_score <= TRUST_REPUTATION_THRESHOLD and not typo_detected:
            result = {
                "url": url,
                "prediction": "Legitimate",
                "risk_score": round(reputation_score * 100, 2),
                "shap_values": {},
                "reasons": ["High reputation domain (VirusTotal)"],
            }
            scans_collection.insert_one({
                **result,
                "user_id": current_user["sub"],
                "scanned_at": datetime.utcnow(),
            })
            return result

        # ML Prediction
        features_dict = extract_url_features(url)
        input_df = prepare_input(url)
        input_scaled = scaler.transform(input_df)
        prob = rf.predict_proba(input_scaled)[0][1]

        # Combine ML + Reputation
        final_score = (0.6 * prob) + (0.4 * reputation_score)

        if final_score >= 0.5:
            prediction = "Phishing"
        elif final_score >= 0.35:
            prediction = "Suspicious"
        else:
            prediction = "Legitimate"

        reasons = explain_features(
            features_dict,
            prediction=1 if prediction != "Legitimate" else 0,
            prob=final_score,
            is_typo=typo_detected,
        )
        shap_values = get_shap_explanation(input_df.values[0])

        result = {
            "url": url,
            "prediction": prediction,
            "risk_score": round(final_score * 100, 2),
            "shap_values": {k: float(v) for k, v in shap_values.items()},
            "reasons": reasons,
        }

        scans_collection.insert_one({
            **result,
            "user_id": current_user["sub"],
            "scanned_at": datetime.utcnow(),
        })

        return result

    except Exception as e:
        return {"error": str(e)}


# ============================================================
# 10. SCAN HISTORY ROUTES
# ============================================================

@app.get("/scans/recent", tags=["Scan History"])
def get_recent_scans(current_user: dict = Depends(get_current_user)):
    """Get recent 10 scans for current user"""
    scans = list(
        scans_collection
        .find({"user_id": current_user["sub"]}, {"_id": 0, "shap_values": 0})
        .sort("scanned_at", -1)
        .limit(10)
    )
    return {"scans": scans}


@app.get("/scans/all", tags=["Scan History"])
def get_all_user_scans(current_user: dict = Depends(get_current_user)):
    """Get all scans for current user"""
    scans = list(
        scans_collection
        .find({"user_id": current_user["sub"]}, {"_id": 0, "shap_values": 0})
        .sort("scanned_at", -1)
    )
    return {"scans": scans}


@app.get("/stats", tags=["Scan History"])
def get_stats(current_user: dict = Depends(get_current_user)):
    """Get statistics for current user"""
    scans = list(scans_collection.find({"user_id": current_user["sub"]}))
    total = len(scans)
    phishing = len([s for s in scans if s["prediction"] == "Phishing"])
    suspicious = len([s for s in scans if s["prediction"] == "Suspicious"])
    detection_rate = round(((phishing + suspicious) / total * 100), 1) if total > 0 else 0
    return {
        "total_scans": total,
        "phishing_caught": phishing,
        "detection_rate": f"{detection_rate}%",
        "avg_scan_time": "1.2s",
    }


# ============================================================
# 11. REPORT ROUTES
# ============================================================

@app.post("/report", tags=["Reports"])
def report_url(data: ReportRequest, current_user: dict = Depends(get_current_user)):
    """Report a suspicious URL"""
    reports_collection.insert_one({
        "url": data.url,
        "note": data.note,
        "reported_by": current_user["sub"],
        "reported_at": datetime.utcnow(),
        "status": "pending",
    })
    return {"message": "Report submitted."}


# ============================================================
# 12. ADMIN ROUTES
# ============================================================

@app.get("/admin/scans", tags=["Admin"])
def get_all_scans(current_user: dict = Depends(get_current_user)):
    """Get all scans (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    scans = list(scans_collection.find({}, {"_id": 0, "shap_values": 0}).sort("scanned_at", -1))
    return {"scans": scans}


@app.get("/admin/reports", tags=["Admin"])
def get_reports(current_user: dict = Depends(get_current_user)):
    """Get pending reports (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    reports = list(reports_collection.find({"status": "pending"}).sort("reported_at", -1))
    for r in reports:
        r["_id"] = str(r["_id"])
    return {"reports": reports}


@app.post("/admin/reports/{report_id}/resolve", tags=["Admin"])
def resolve_report(report_id: str, current_user: dict = Depends(get_current_user)):
    """Resolve a report (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    from bson import ObjectId
    reports_collection.update_one({"_id": ObjectId(report_id)}, {"$set": {"status": "resolved"}})
    return {"message": "Report resolved."}


@app.post("/admin/reports/{report_id}/dismiss", tags=["Admin"])
def dismiss_report(report_id: str, current_user: dict = Depends(get_current_user)):
    """Dismiss a report (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    from bson import ObjectId
    reports_collection.update_one({"_id": ObjectId(report_id)}, {"$set": {"status": "dismissed"}})
    return {"message": "Report dismissed."}


@app.post("/admin/cache/clear", tags=["Admin"])
def clear_cache(current_user: dict = Depends(get_current_user)):
    """Clear reputation cache (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    reputation_cache.clear()
    cache_timestamp.clear()
    return {"message": "Cache cleared."}


# ============================================================
# 13. UTILITY ROUTES
# ============================================================

@app.get("/", tags=["Utility"])
def home():
    return {
        "message": "AegisPhish Phishing Detection API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health", tags=["Utility"])
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.get("/cache", tags=["Utility"])
def view_cache():
    return {"reputation_cache": reputation_cache, "cache_timestamp": cache_timestamp}