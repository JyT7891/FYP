from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from bson import ObjectId

from app.database import scans_collection
from app.auth import get_current_user

router = APIRouter()


@router.get("/scans/recent")
def get_recent_scans(current_user: dict = Depends(get_current_user)):
    """Get recent 10 scans for current user"""
    scans = list(
        scans_collection
        .find({"user_id": current_user["sub"]}, {"_id": 1, "shap_values": 0})
        .sort("scanned_at", -1)
        .limit(10)
    )
    for scan in scans:
        scan["_id"] = str(scan["_id"])
    return {"scans": scans}


@router.get("/scans/all")
def get_all_user_scans(current_user: dict = Depends(get_current_user)):
    """Get all scans for current user"""
    scans = list(
        scans_collection
        .find({"user_id": current_user["sub"]}, {"_id": 1, "shap_values": 0})
        .sort("scanned_at", -1)
    )
    for scan in scans:
        scan["_id"] = str(scan["_id"])
    return {"scans": scans}


@router.get("/stats")
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


@router.get("/scans/{scan_id}")
def get_scan_by_id(scan_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific scan by ID"""
    try:
        obj_id = ObjectId(scan_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid scan ID format")
    
    scan = scans_collection.find_one({"_id": obj_id, "user_id": current_user["sub"]})
    
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    scan["_id"] = str(scan["_id"])
    return scan