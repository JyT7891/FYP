# Core phishing prediction endpoint combining ML model, reputation scoring, and typosquatting detection
from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime
import uuid

from app.models import URLRequest
from app.database import scans_collection
from app.auth import get_current_user
from app.ml.model import rf, scaler
from app.ml.features import extract_url_features, prepare_input, get_shap_explanation, explain_features
from app.ml.reputation import get_reputation_score
from app.ml.typosquatting import is_typosquatting
from app.config import settings
from app.utils.security import decode_token

router = APIRouter()
security = HTTPBearer()


# Retrieve or generate user session ID for tracking requests
def get_or_create_session_id(request: Request) -> str:
    """Get or create session ID from cookies"""
    session_id = request.cookies.get("session_id")
    if not session_id:
        session_id = str(uuid.uuid4())
    return session_id


# Main URL phishing detection API endpoint
@router.post("/predict")
def predict(
    data: URLRequest,
    current_user: dict = Depends(get_current_user)
):
    """Analyze a URL for phishing detection (authentication required)"""
    try:
        # Extract URL from request payload
        url = data.url
        user_id = current_user.get("sub")
        
        # Get VirusTotal reputation score
        reputation_score = get_reputation_score(url)
        # Check for typosquatting patterns
        typo_detected = is_typosquatting(url)

        # Fast-path: trust high-reputation domains without ML inference
        if reputation_score <= settings.TRUST_REPUTATION_THRESHOLD and not typo_detected:
            result = {
                "url": url,
                "prediction": "Legitimate",
                "risk_score": round(reputation_score * 100, 2),
                "shap_values": {},
                "reasons": ["High reputation domain (VirusTotal)"],
            }
            # Save prediction result to database
            insert_result = scans_collection.insert_one({
                **result,
                "user_id": user_id,
                "scanned_at": datetime.utcnow(),
            })
            result["_id"] = str(insert_result.inserted_id)
            return result

        # Extract lexical features from URL for ML model
        features_dict = extract_url_features(url)
        # Convert URL features into model input format
        input_df = prepare_input(url)
        # Normalize features using trained scaler
        input_scaled = scaler.transform(input_df)
        # Get phishing probability from Random Forest model
        prob = rf.predict_proba(input_scaled)[0][1]

        # Combine ML prediction and reputation score into final risk score
        final_score = (0.6 * prob) + (0.4 * reputation_score)

        # Determine final classification based on risk score thresholds
        if final_score >= 0.5:
            prediction = "Phishing"
        elif final_score >= 0.35:
            prediction = "Suspicious"
        else:
            prediction = "Legitimate"

        # Generate human-readable explanation for prediction
        reasons = explain_features(
            features_dict,
            prediction=1 if prediction != "Legitimate" else 0,
            prob=final_score,
            is_typo=typo_detected,
        )
        # Compute SHAP feature attributions for explainability
        shap_values = get_shap_explanation(input_df.values[0])

        result = {
            "url": url,
            "prediction": prediction,
            "risk_score": round(final_score * 100, 2),
            "shap_values": {k: float(v) for k, v in shap_values.items()},
            "reasons": reasons,
        }

        # Save scan with authenticated user ID
        # Save prediction result to database
        insert_result = scans_collection.insert_one({
            **result,
            "user_id": user_id,
            "scanned_at": datetime.utcnow(),
        })
        result["_id"] = str(insert_result.inserted_id)

        return result

    # Handle unexpected runtime errors
    except Exception as e:
        return {"error": str(e)}

    # Fallback error handler (duplicate safety catch)
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        return {"error": str(e)}