from fastapi import APIRouter, Depends
from datetime import datetime

from app.models import ReportRequest
from app.database import reports_collection
from app.auth import get_current_user

router = APIRouter()


@router.post("/report")
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