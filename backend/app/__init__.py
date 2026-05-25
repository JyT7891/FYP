from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config import settings
from app.database import db, connect_to_mongo
from app.auth import router as auth_router
from app.users import router as users_router
from app.scans import router as scans_router
from app.routes import predict, reports, admin, utility

def create_app() -> FastAPI:
    app = FastAPI(
        title="AegisPhish API",
        description="Phishing Detection System",
        version="1.0.0"
    )
    
    # Initialize database connection
    connect_to_mongo()
    
    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Static files
    os.makedirs("static/avatars", exist_ok=True)
    app.mount("/static", StaticFiles(directory="static"), name="static")
    
    # Include routers
    app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
    app.include_router(users_router, prefix="/api/user", tags=["User Profile"])
    app.include_router(scans_router, prefix="", tags=["Scan History"])
    app.include_router(predict.router, prefix="", tags=["Prediction"])
    app.include_router(reports.router, prefix="", tags=["Reports"])
    app.include_router(admin.router, prefix="/admin", tags=["Admin"])
    app.include_router(utility.router, prefix="", tags=["Utility"])
    
    return app