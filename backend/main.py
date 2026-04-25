import base64
import difflib
import time
from urllib.parse import urlparse

import joblib
import numpy as np
import pandas as pd
import requests
import shap
from fastapi import FastAPI
from pydantic import BaseModel
from tranco import Tranco

# --- Model & Feature Loading ---
rf = joblib.load("rf_model.pkl")
scaler = joblib.load("scaler.pkl")
feature_columns = joblib.load("feature_columns.pkl")
explainer = shap.TreeExplainer(rf)

# --- Constants ---
CACHE_TTL = 60 * 60 * 24  # 24 hours
VIRUSTOTAL_API_KEY = "4f8b7b5e6627b79011830ba413181e136e294c00e2d17d23fd71b028de9efcb8"
TRUST_REPUTATION_THRESHOLD = 0.05

# --- In-Memory Cache ---
reputation_cache: dict = {}
cache_timestamp: dict = {}
TOP_DOMAINS: list = []

app = FastAPI()


# --- Startup ---

@app.on_event("startup")
async def startup_event():
    global TOP_DOMAINS
    try:
        t = Tranco(cache=True)
        TOP_DOMAINS = t.list().top(1000)
        print("Tranco Top 1000 loaded.")
    except Exception as e:
        print(f"Tranco error: {e}")
        TOP_DOMAINS = ["google.com", "apple.com", "facebook.com"]


# --- Request Schema ---

class URLRequest(BaseModel):
    url: str


# --- Feature Extraction ---

def extract_url_features(url: str) -> dict:
    url_lower = url.lower()
    return {
        "url_length": len(url),
        "num_dots": url.count("."),
        "num_hyphens": url.count("-"),
        "num_underscores": url.count("_"),
        "num_digits": sum(c.isdigit() for c in url),
        "num_slashes": url.count("/"),
        "has_https": int("https" in url),
        "has_http": int("http://" in url),
        "has_at": int("@" in url),
        "has_ip": int(any(part.isdigit() for part in url.split("/")[0].split("."))),
        "has_login": int("login" in url_lower),
        "has_secure": int("secure" in url_lower),
        "has_verify": int("verify" in url_lower),
        "has_update": int("update" in url_lower),
        "has_account": int("account" in url_lower),
        "subdomain_count": url.count(".") - 1 if url.count(".") > 0 else 0,
        "tld_length": len(url.split(".")[-1]) if "." in url else 0,
    }


def build_features(url: str) -> dict:
    url_lower = url.lower()
    domain = url.split("//")[-1].split("/")[0] if "//" in url else url
    return {
        "length_url": len(url),
        "length_hostname": len(domain),
        "nb_dots": url.count("."),
        "nb_hyphens": url.count("-"),
        "nb_at": url.count("@"),
        "nb_qm": url.count("?"),
        "nb_and": url.count("&"),
        "nb_eq": url.count("="),
        "nb_slash": url.count("/"),
        "nb_www": int("www" in url_lower),
        "http_in_path": int("http" in url_lower),
        "https_token": int("https" in url_lower),
        "ratio_digits_url": sum(c.isdigit() for c in url) / max(len(url), 1),
        "ratio_digits_host": sum(c.isdigit() for c in domain) / max(len(domain), 1),
        "shortening_service": int(any(x in url_lower for x in ["bit.ly", "tinyurl", "t.co"])),
        "ip": int(any(part.isdigit() for part in domain.split("."))),
        # Dataset-only features — not derivable from URL alone
        "web_traffic": 0,
        "page_rank": 0,
        "dns_record": 1,
        "google_index": 1,
        "domain_age": 0,
    }


def prepare_input(url: str) -> pd.DataFrame:
    feats = build_features(url)
    return pd.DataFrame(
        [[feats.get(col, 0) for col in feature_columns]],
        columns=feature_columns,
    )


# --- SHAP Explanation ---

def get_shap_explanation(feature_vector) -> dict:
    X = np.array([feature_vector])
    shap_values = explainer.shap_values(X)
    values = shap_values[1][0] if isinstance(shap_values, list) else shap_values[0]
    values = [float(x) for x in np.array(values).flatten()]
    return dict(zip(feature_columns, values))


# --- Human-Readable Reasons ---

def explain_features(features: dict, prediction: int, prob: float, is_typo: bool = False) -> list[str]:
    reasons = []

    if is_typo:
        reasons.append("Possible typosquatting/brand impersonation detected (matches top 1000 domain patterns)")

    if prediction == 1 or prob > 0.4:
        if features.get("has_ip") == 1:
            reasons.append("Uses IP address instead of domain")
        if features.get("has_at") == 1:
            reasons.append("Contains '@' symbol")
        if features.get("num_hyphens", 0) > 3:
            reasons.append("Excessive hyphens in domain")
        if features.get("num_digits", 0) > 5:
            reasons.append("High number of digits in URL")
        if features.get("has_https") == 0:
            reasons.append("No HTTPS security indicator")

    if not reasons:
        reasons.append("URL appears structurally normal")

    return reasons


# --- Domain Utilities ---

def extract_domain(url: str) -> str:
    if not url.startswith("http"):
        url = "http://" + url
    parsed = urlparse(url)
    return parsed.netloc.lower().replace("www.", "")


def is_typosquatting(url: str) -> bool:
    user_domain = extract_domain(url)
    if user_domain in TOP_DOMAINS:
        return False
    return any(
        0.8 <= difflib.SequenceMatcher(None, user_domain, top_domain).ratio() < 1.0
        for top_domain in TOP_DOMAINS
    )


# --- VirusTotal Reputation ---

def get_reputation_score(url: str) -> float:
    if url in reputation_cache and time.time() - cache_timestamp[url] < CACHE_TTL:
        return reputation_cache[url]

    try:
        url_id = base64.urlsafe_b64encode(url.encode()).decode().strip("=")
        response = requests.get(
            f"https://www.virustotal.com/api/v3/urls/{url_id}",
            headers={"x-apikey": VIRUSTOTAL_API_KEY},
        )
        if response.status_code != 200:
            return 0.5

        stats = (
            response.json()
            .get("data", {})
            .get("attributes", {})
            .get("last_analysis_stats", {})
        )
        malicious = stats.get("malicious", 0)
        harmless = stats.get("harmless", 0)
        total = malicious + harmless
        score = 0.5 if total == 0 else (malicious + 1) / (total + 2)

    except Exception:
        score = 0.5

    reputation_cache[url] = score
    cache_timestamp[url] = time.time()
    return score


# --- Routes ---

@app.get("/")
def home():
    return {"message": "Phishing Detection API running"}


@app.get("/cache")
def view_cache():
    return {"reputation_cache": reputation_cache, "cache_timestamp": cache_timestamp}


@app.post("/predict")
def predict(data: URLRequest):
    try:
        url = data.url
        reputation_score = get_reputation_score(url)
        typo_detected = is_typosquatting(url)

        # Fast-path: high-reputation, non-typosquatting domain
        if reputation_score <= TRUST_REPUTATION_THRESHOLD and not typo_detected:
            return {
                "url": url,
                "prediction": "Legitimate",
                "risk_score": round(reputation_score * 100, 2),
                "shap_values": {},
                "reasons": ["High reputation domain (VirusTotal)"],
            }

        # ML inference
        features_dict = extract_url_features(url)
        input_df = prepare_input(url)
        input_scaled = scaler.transform(input_df)
        prob = rf.predict_proba(input_scaled)[0][1]

        # Blend ML probability with reputation signal
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

        return {
            "url": url,
            "prediction": prediction,
            "risk_score": round(final_score * 100, 2),
            "shap_values": {k: float(v) for k, v in shap_values.items()},
            "reasons": reasons,
        }

    except Exception as e:
        return {"error": str(e)}