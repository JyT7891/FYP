# Application configuration (environment variables and constants)
import os
from dotenv import load_dotenv

load_dotenv()

# Centralized settings container for backend configuration
class Settings:
    # MongoDB connection string
    # MongoDB
    MONGO_URI = os.getenv("MONGO_URI")
    
    # Secret key used to sign JWT tokens
    # JWT
    JWT_SECRET = os.getenv("JWT_SECRET")
    # JWT token expiration in days
    JWT_EXPIRES_DAYS = int(os.getenv("JWT_EXPIRES_DAYS", 7))
    
    # API key for VirusTotal URL reputation service
    # VirusTotal
    VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY")
    
    # Allowed frontend origins for CORS policy
    # CORS
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    
    # SMTP server host for sending emails
    # Email
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    # SMTP server port
    SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
    # SMTP authentication username
    SMTP_USER = os.getenv("SMTP_USER")
    # SMTP authentication password
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
    # Frontend base URL used in email links
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    
    # TTL (seconds) for in-memory reputation cache
    # ML Constants
    CACHE_TTL = 60 * 60 * 24
    # Threshold for bypassing ML if reputation is high
    TRUST_REPUTATION_THRESHOLD = 0.05

settings = Settings()