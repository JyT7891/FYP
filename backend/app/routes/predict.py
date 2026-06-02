from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime
import uuid

from app.models import URLRequest
from app.database import scans_collection
from app.ml.model import rf, scaler
from app.ml.features import extract_url_features, prepare_input, get_shap_explanation, explain_features
from app.ml.reputation import get_reputation_score
from app.ml.typosquatting import is_typosquatting
from app.config import settings
from app.utils.security import decode_token

router = APIRouter()
security = HTTPBearer()


def get_or_create_session_id(request: Request) -> str:
    """Get or create session ID from cookies"""
    session_id = request.cookies.get("session_id")
    if not session_id:
        session_id = str(uuid.uuid4())
    return session_id


@router.post("/predict")
def predict(
    request: Request,
    data: URLRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Analyze a URL for phishing detection (supports optional auth)"""
    try:
        url = data.url
        reputation_score = get_reputation_score(url)
        typo_detected = is_typosquatting(url)
        
        # Try to get user_id from token if present
        user_id = None
        if credentials:
            try:
                token = credentials.credentials
                payload = decode_token(token)
                user_id = payload.get("sub")
                print(f"✅ Authenticated user: {user_id}")
            except Exception as e:
                print(f"⚠️ Auth failed: {e}")
        
        # If not logged in, use session ID
        if not user_id:
            user_id = get_or_create_session_id(request)
            print(f"🆔 Anonymous user with session: {user_id}")

        # High reputation domain check
        if reputation_score <= settings.TRUST_REPUTATION_THRESHOLD and not typo_detected:
            result = {
                "url": url,
                "prediction": "Legitimate",
                "risk_score": round(reputation_score * 100, 2),
                "shap_values": {},
                "reasons": ["High reputation domain (VirusTotal)"],
            }
            insert_result = scans_collection.insert_one({
                **result,
                "user_id": user_id,
                "scanned_at": datetime.utcnow(),
            })
            result["_id"] = str(insert_result.inserted_id)
            return result

        # ML Prediction
        features_dict = extract_url_features(url)
        input_df = prepare_input(url)
        input_scaled = scaler.transform(input_df)
        prob = rf.predict_proba(input_scaled)[0][1]

        # Combine ML + Reputation
        final_score = (0.6 * prob) + (0.4 * reputation_score)

        if final_score >= 0.5:
            prediction = "Phishing"
        elif final_score >= 0.35:
            prediction = "Suspicious"
        else:
            prediction = "Legitimate"

        reasons = explain_features(
            features_dict,
            prediction=1 if prediction != "Legitimate" else 0,
            prob=final_score,
            is_typo=typo_detected,
        )
        shap_values = get_shap_explanation(input_df.values[0])

        result = {
            "url": url,
            "prediction": prediction,
            "risk_score": round(final_score * 100, 2),
            "shap_values": {k: float(v) for k, v in shap_values.items()},
            "reasons": reasons,
        }

        # Save scan with user_id (either actual user ID or session ID)
        insert_result = scans_collection.insert_one({
            **result,
            "user_id": user_id,
            "scanned_at": datetime.utcnow(),
        })
        result["_id"] = str(insert_result.inserted_id)

        return result

    except Exception as e:
        print(f"❌ Prediction error: {e}")
        return {"error": str(e)}