# Utility routes for API health checks and system status endpoints
from fastapi import APIRouter
from datetime import datetime

from app.ml.reputation import reputation_cache, cache_timestamp

# Initialize FastAPI router for utility endpoints
router = APIRouter()


# Root endpoint returning API metadata
@router.get("/")
def home():
    return {
        "message": "AegisPhish Phishing Detection API",
        "version": "1.0.0",
        "status": "running"
    }


# Health check endpoint for service monitoring
@router.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


# View in-memory reputation cache contents (debug endpoint)
@router.get("/cache")
def view_cache():
    return {"reputation_cache": reputation_cache, "cache_timestamp": cache_timestamp}