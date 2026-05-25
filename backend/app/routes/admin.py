from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId

from app.database import scans_collection, reports_collection
from app.auth import get_current_user
from app.ml.reputation import reputation_cache, cache_timestamp

router = APIRouter()


@router.get("/scans")
def get_all_scans(current_user: dict = Depends(get_current_user)):
    """Get all scans (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    scans = list(scans_collection.find({}, {"_id": 0, "shap_values": 0}).sort("scanned_at", -1))
    return {"scans": scans}


@router.get("/reports")
def get_reports(current_user: dict = Depends(get_current_user)):
    """Get pending reports (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    reports = list(reports_collection.find({"status": "pending"}).sort("reported_at", -1))
    for r in reports:
        r["_id"] = str(r["_id"])
    return {"reports": reports}


@router.post("/reports/{report_id}/resolve")
def resolve_report(report_id: str, current_user: dict = Depends(get_current_user)):
    """Resolve a report (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    reports_collection.update_one({"_id": ObjectId(report_id)}, {"$set": {"status": "resolved"}})
    return {"message": "Report resolved."}


@router.post("/reports/{report_id}/dismiss")
def dismiss_report(report_id: str, current_user: dict = Depends(get_current_user)):
    """Dismiss a report (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    reports_collection.update_one({"_id": ObjectId(report_id)}, {"$set": {"status": "dismissed"}})
    return {"message": "Report dismissed."}


@router.post("/cache/clear")
def clear_cache(current_user: dict = Depends(get_current_user)):
    """Clear reputation cache (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    reputation_cache.clear()
    cache_timestamp.clear()
    return {"message": "Cache cleared."}