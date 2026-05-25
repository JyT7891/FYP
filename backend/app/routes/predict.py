from fastapi import APIRouter, Depends
from datetime import datetime

from app.models import URLRequest
from app.database import scans_collection
from app.auth import get_current_user
from app.ml.model import rf, scaler
from app.ml.features import extract_url_features, prepare_input, get_shap_explanation, explain_features
from app.ml.reputation import get_reputation_score
from app.ml.typosquatting import is_typosquatting
from app.config import settings

router = APIRouter()


@router.post("/predict")
def predict(data: URLRequest, current_user: dict = Depends(get_current_user)):
    """Analyze a URL for phishing detection"""
    try:
        url = data.url
        reputation_score = get_reputation_score(url)
        typo_detected = is_typosquatting(url)

        # High reputation domain check
        if reputation_score <= settings.TRUST_REPUTATION_THRESHOLD and not typo_detected:
            result = {
                "url": url,
                "prediction": "Legitimate",
                "risk_score": round(reputation_score * 100, 2),
                "shap_values": {},
                "reasons": ["High reputation domain (VirusTotal)"],
            }
            scans_collection.insert_one({
                **result,
                "user_id": current_user["sub"],
                "scanned_at": datetime.utcnow(),
            })
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

        scans_collection.insert_one({
            **result,
            "user_id": current_user["sub"],
            "scanned_at": datetime.utcnow(),
        })

        return result

    except Exception as e:
        return {"error": str(e)}