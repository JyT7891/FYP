# User report submission endpoint for suspicious URLs
from fastapi import APIRouter, Depends
from datetime import datetime

from app.models import ReportRequest
from app.database import reports_collection
from app.auth import get_current_user

# Initialize FastAPI router for report-related routes
router = APIRouter()


# Submit a new suspicious URL report
@router.post("/report")
def report_url(data: ReportRequest, current_user: dict = Depends(get_current_user)):
    """Report a suspicious URL"""
    reports_collection.insert_one({
        # Reported URL
        "url": data.url,
        # Optional user note describing suspicion
        "note": data.note,
        # ID of user submitting the report
        "reported_by": current_user["sub"],
        # Timestamp of report submission
        "reported_at": datetime.utcnow(),
        # Initial report status set to pending review
        "status": "pending",
    })
    return {"message": "Report submitted."}