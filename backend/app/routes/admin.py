from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime  # Add this import

from app.database import scans_collection, reports_collection, users_collection
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
    try:
        result = reports_collection.update_one(
            {"_id": ObjectId(report_id), "status": "pending"},
            {"$set": {
                "status": "resolved",
                "resolved_at": datetime.utcnow(),
                "resolved_by": current_user["sub"]
            }}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Report not found or already resolved")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid report ID: {str(e)}")
    return {"message": "Report resolved successfully"}


@router.post("/reports/{report_id}/dismiss")
def dismiss_report(report_id: str, current_user: dict = Depends(get_current_user)):
    """Dismiss a report (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    try:
        result = reports_collection.update_one(
            {"_id": ObjectId(report_id), "status": "pending"},
            {"$set": {
                "status": "dismissed",
                "dismissed_at": datetime.utcnow(),
                "dismissed_by": current_user["sub"]
            }}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Report not found or already dismissed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid report ID: {str(e)}")
    return {"message": "Report dismissed successfully"}


@router.get("/stats")
def get_admin_stats(current_user: dict = Depends(get_current_user)):
    """Get system statistics (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    
    total_users = users_collection.count_documents({})
    total_scans = scans_collection.count_documents({})
    total_reports = reports_collection.count_documents({})
    pending_reports = reports_collection.count_documents({"status": "pending"})
    
    # Get scans by prediction type
    phishing_count = scans_collection.count_documents({"prediction": "Phishing"})
    suspicious_count = scans_collection.count_documents({"prediction": "Suspicious"})
    legitimate_count = scans_collection.count_documents({"prediction": "Legitimate"})
    
    return {
        "total_users": total_users,
        "total_scans": total_scans,
        "total_reports": total_reports,
        "pending_reports": pending_reports,
        "phishing_detected": phishing_count,
        "suspicious_detected": suspicious_count,
        "legitimate_scans": legitimate_count,
    }


@router.get("/users")
def get_all_users(current_user: dict = Depends(get_current_user)):
    """Get all users (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    users = list(users_collection.find({}, {"password": 0}))  # Exclude passwords
    for user in users:
        user["_id"] = str(user["_id"])
    return {"users": users}


@router.post("/cache/clear")
def clear_cache(current_user: dict = Depends(get_current_user)):
    """Clear reputation cache (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    reputation_cache.clear()
    cache_timestamp.clear()
    return {"message": "Cache cleared."}