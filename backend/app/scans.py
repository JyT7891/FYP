from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from bson import ObjectId

from app.database import scans_collection, reports_collection
from app.auth import get_current_user

router = APIRouter()


@router.get("/scans/recent")
def get_recent_scans(current_user: dict = Depends(get_current_user)):
    """Get recent 10 scans - includes user's own scans AND anonymous scans"""
    scans = list(
        scans_collection
        .find({
            "$or": [
                {"user_id": current_user["sub"]},  # User's own scans
                {"user_id": None}                  # Anonymous scans
            ]
        }, {"_id": 1, "shap_values": 0})
        .sort("scanned_at", -1)
        .limit(10)
    )
    for scan in scans:
        scan["_id"] = str(scan["_id"])
    return {"scans": scans}


@router.get("/scans/all")
def get_all_user_scans(current_user: dict = Depends(get_current_user)):
    """Get all scans - includes user's own scans AND anonymous scans with report status"""
    # First, get all reports for this user to check status
    reports = list(
        reports_collection.find({
            "reported_by": current_user["sub"]
        }, {"url": 1, "status": 1})
    )
    
    # Create a map of URL -> status for quick lookup
    report_status_map = {}
    for report in reports:
        # Normalize URL for consistent matching
        url = report.get("url", "").strip().lower()
        report_status_map[url] = report.get("status", "pending")
    
    # Get all scans
    scans = list(
        scans_collection
        .find({
            "$or": [
                {"user_id": current_user["sub"]},
                {"user_id": None}
            ]
        }, {"_id": 1, "shap_values": 0})
        .sort("scanned_at", -1)
    )
    
    # Add report status to each scan
    for scan in scans:
        scan["_id"] = str(scan["_id"])
        
        # Check if this URL has a report
        url = scan.get("url", "").strip().lower()
        if url in report_status_map:
            scan["report_status"] = report_status_map[url]
        else:
            scan["report_status"] = None  # Not reported
    
    return {"scans": scans}


@router.get("/stats")
def get_stats(current_user: dict = Depends(get_current_user)):
    """Get statistics - includes user's own scans AND anonymous scans"""
    scans = list(scans_collection.find({
        "$or": [
            {"user_id": current_user["sub"]},
            {"user_id": None}
        ]
    }))
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
    
    # Look for scan owned by user OR anonymous scan
    scan = scans_collection.find_one({
        "_id": obj_id,
        "$or": [
            {"user_id": current_user["sub"]},
            {"user_id": None}
        ]
    })
    
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    scan["_id"] = str(scan["_id"])
    return scan