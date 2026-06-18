from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime
import os

from app.database import scans_collection, reports_collection, users_collection
from app.auth import get_current_user
from app.ml.reputation import reputation_cache, cache_timestamp

router = APIRouter()


# Get all scans (admin-only endpoint)
@router.get("/scans")
def get_all_scans(current_user: dict = Depends(get_current_user)):
    """Get all scans (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    
    # Get all scans with _id included
    scans = list(scans_collection.find({}, {"shap_values": 0}).sort("scanned_at", -1))
    
    # Convert ObjectId to string and add user email
    for scan in scans:
        scan["_id"] = str(scan["_id"])
        
        # Look up user email if user_id exists
        if scan.get("user_id") and scan["user_id"]:
            try:
                # Check if user_id is a valid ObjectId
                if ObjectId.is_valid(scan["user_id"]):
                    user = users_collection.find_one({"_id": ObjectId(scan["user_id"])}, {"email": 1})
                    if user:
                        scan["user_email"] = user.get("email", "Unknown")
                    else:
                        scan["user_email"] = "Unknown User"
                else:
                    # For session-based anonymous users
                    scan["user_email"] = "Anonymous"
            except:
                scan["user_email"] = "Anonymous"
        else:
            scan["user_email"] = "Anonymous"
    
    return {"scans": scans}


# Get pending reports (admin-only endpoint)
@router.get("/reports")
def get_reports(current_user: dict = Depends(get_current_user)):
    """Get pending reports (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    reports = list(reports_collection.find({"status": "pending"}).sort("reported_at", -1))
    for r in reports:
        r["_id"] = str(r["_id"])
    return {"reports": reports}


# Resolve a user report
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


# Dismiss a user report
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


# Retrieve admin dashboard statistics
@router.get("/stats")
def get_admin_stats(current_user: dict = Depends(get_current_user)):
    """Get system statistics (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    
    total_users = users_collection.count_documents({})
    total_scans = scans_collection.count_documents({})
    total_reports = reports_collection.count_documents({})
    pending_reports = reports_collection.count_documents({"status": "pending"})
    
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


# Get all registered users (admin-only endpoint)
@router.get("/users")
def get_all_users(current_user: dict = Depends(get_current_user)):
    """Get all users (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    users = list(users_collection.find({}, {"password": 0}))
    for user in users:
        user["_id"] = str(user["_id"])
    return {"users": users}


# Update user role (user/admin)
@router.patch("/users/{user_id}/role")
def update_user_role(user_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    """Update a user's role (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    
    new_role = request.get("role")
    if new_role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'user' or 'admin'")
    
    # Prevent admin from changing their own role
    if user_id == current_user["sub"]:
        raise HTTPException(status_code=400, detail="You cannot change your own role")
    
    try:
        result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"role": new_role}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {"message": f"User role updated to {new_role}"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error updating user role: {str(e)}")


# Delete user and associated data
@router.delete("/users/{user_id}")
def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a user (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    
    if user_id == current_user["sub"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if user.get("avatar"):
            avatar_path = user["avatar"].lstrip("/")
            if os.path.exists(avatar_path):
                try:
                    os.remove(avatar_path)
                except Exception as e:
                    print(f"Error deleting avatar: {e}")
        
        users_collection.delete_one({"_id": ObjectId(user_id)})
        scans_collection.delete_many({"user_id": user_id})
        reports_collection.delete_many({"reported_by": user_id})
        
        return {"message": "User deleted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error deleting user: {str(e)}")
    
# Bulk delete selected scan records
@router.post("/scans/bulk-delete")
def bulk_delete_scans(data: dict, current_user: dict = Depends(get_current_user)):
    """Delete multiple scans (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    
    scan_ids = data.get("scan_ids", [])
    if not scan_ids:
        raise HTTPException(status_code=400, detail="No scan IDs provided")
    
    print(f"📋 Received delete request for {len(scan_ids)} scans")
    
    deleted_count = 0
    failed_ids = []
    
    for scan_id in scan_ids:
        try:
            # Convert string ID to ObjectId
            obj_id = ObjectId(scan_id)
            result = scans_collection.delete_one({"_id": obj_id})
            if result.deleted_count > 0:
                deleted_count += 1
                print(f"✅ Deleted scan: {scan_id}")
            else:
                print(f"⚠️ Scan not found: {scan_id}")
                failed_ids.append(scan_id)
        except Exception as e:
            print(f"❌ Error deleting scan {scan_id}: {e}")
            failed_ids.append(scan_id)
    
    return {
        "message": f"Deleted {deleted_count} scans",
        "deleted_count": deleted_count,
        "failed_ids": failed_ids
    }


# Clear ML reputation cache
@router.post("/cache/clear")
def clear_cache(current_user: dict = Depends(get_current_user)):
    """Clear reputation cache (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    reputation_cache.clear()
    cache_timestamp.clear()
    return {"message": "Cache cleared."}