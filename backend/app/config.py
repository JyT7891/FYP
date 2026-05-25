import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # MongoDB
    MONGO_URI = os.getenv("MONGO_URI")
    
    # JWT
    JWT_SECRET = os.getenv("JWT_SECRET")
    JWT_EXPIRES_DAYS = int(os.getenv("JWT_EXPIRES_DAYS", 7))
    
    # VirusTotal
    VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY")
    
    # CORS
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    
    # Email
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
    SMTP_USER = os.getenv("SMTP_USER")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    
    # ML Constants
    CACHE_TTL = 60 * 60 * 24
    TRUST_REPUTATION_THRESHOLD = 0.05

settings = Settings()