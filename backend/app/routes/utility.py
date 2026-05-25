from fastapi import APIRouter
from datetime import datetime

from app.ml.reputation import reputation_cache, cache_timestamp

router = APIRouter()


@router.get("/")
def home():
    return {
        "message": "AegisPhish Phishing Detection API",
        "version": "1.0.0",
        "status": "running"
    }


@router.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@router.get("/cache")
def view_cache():
    return {"reputation_cache": reputation_cache, "cache_timestamp": cache_timestamp}