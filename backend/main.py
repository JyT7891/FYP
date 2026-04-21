from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd
import joblib
import shap
import numpy as np
import time
from urllib.parse import urlparse
import requests
import base64


rf = joblib.load("rf_model.pkl")
scaler = joblib.load("scaler.pkl")

explainer = shap.TreeExplainer(rf)
feature_columns = joblib.load("feature_columns.pkl")

reputation_cache = {}
cache_timestamp = {}

CACHE_TTL = 60 * 60 * 24
VIRUSTOTAL_API_KEY = "4f8b7b5e6627b79011830ba413181e136e294c00e2d17d23fd71b028de9efcb8"
TRUST_REPUTATION_THRESHOLD = 0.05

def get_reputation_score(url):
    try:
        if url in reputation_cache:
            if time.time() - cache_timestamp[url] < CACHE_TTL:
                return reputation_cache[url]

        url_id = base64.urlsafe_b64encode(url.encode()).decode().strip("=")

        headers = {
            "x-apikey": VIRUSTOTAL_API_KEY
        }

        vt_url = f"https://www.virustotal.com/api/v3/urls/{url_id}"

        response = requests.get(vt_url, headers=headers)

        if response.status_code != 200:
            return 0.5

        data = response.json()

        stats = (
            data.get("data", {})
                .get("attributes", {})
                .get("last_analysis_stats", {})
        )

        malicious = stats.get("malicious", 0)
        harmless = stats.get("harmless", 0)

        total = malicious + harmless

        if total == 0:
            score = 0.5
        else:
            score = (malicious + 1) / (total + 2)

        reputation_cache[url] = score
        cache_timestamp[url] = time.time()

        return score

    except:
        return 0.5

app = FastAPI()

class URLRequest(BaseModel):
    url: str

def extract_url_features(url):
    url_lower = url.lower()

    return {
        "url_length": len(url),
        "num_dots": url.count('.'),
        "num_hyphens": url.count('-'),
        "num_underscores": url.count('_'),
        "num_digits": sum(c.isdigit() for c in url),
        "num_slashes": url.count('/'),

        "has_https": int("https" in url),
        "has_http": int("http://" in url),
        "has_at": int("@" in url),
        "has_ip": int(any(part.isdigit() for part in url.split('/')[0].split('.'))),

        "has_login": int("login" in url_lower),
        "has_secure": int("secure" in url_lower),
        "has_verify": int("verify" in url_lower),
        "has_update": int("update" in url_lower),
        "has_account": int("account" in url_lower),

        "subdomain_count": url.count('.') - 1 if url.count('.') > 0 else 0,
        "tld_length": len(url.split('.')[-1]) if '.' in url else 0
    }

def build_features(url):
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

        # dataset-only features (not available from URL → default 0)
        "web_traffic": 0,
        "page_rank": 0,
        "dns_record": 1,
        "google_index": 1,
        "domain_age": 0
    }

def prepare_input(url):
    feats = build_features(url)
    return pd.DataFrame([[feats.get(col, 0) for col in feature_columns]],
                        columns=feature_columns)

def build_feature_vector(url):
    features = extract_url_features(url)
    return [features[col] for col in feature_columns]

def get_shap_explanation(feature_vector):
    X = np.array([feature_vector])

    shap_values = explainer.shap_values(X)

    if isinstance(shap_values, list):
        values = shap_values[1][0]
    else:
        values = shap_values[0]

    values = np.array(values).flatten()

    values = [float(x) for x in values]

    return dict(zip(feature_columns, values))

def explain_features(features, prediction, prob):
    reasons = []

    if prediction == 1:

        if features["has_ip"] == 1:
            reasons.append("Uses IP address instead of domain")

        if features["has_at"] == 1:
            reasons.append("Contains '@' symbol")

        if features["num_hyphens"] > 3:
            reasons.append("Excessive hyphens in domain")

        if features["num_digits"] > 5:
            reasons.append("High number of digits in URL")

        if features["has_https"] == 0:
            reasons.append("No HTTPS security indicator")

        if features["url_length"] > 75:
            reasons.append("Unusually long URL")

        if not reasons:
            if prob > 0.6:
                reasons.append("Model detected phishing pattern based on feature combination")
            else:
                reasons.append("Low-confidence phishing detection (borderline case)")

    else:
        reasons.append("URL appears structurally normal")

    return reasons

def extract_domain(url):
    if not url.startswith("http"):
        url = "http://" + url

    parsed = urlparse(url)
    domain = parsed.netloc.lower().replace("www.", "")
    return domain

@app.post("/predict")
def predict_input(data: URLRequest):
    try:
        url = data.url

        reputation_score = get_reputation_score(url)

        if reputation_score <= TRUST_REPUTATION_THRESHOLD:
            return {
                "url": url,
                "prediction": "Legitimate",
                "risk_score": 0,
                "shap_values": {},
                "reasons": ["High reputation domain (VirusTotal)"]
            }

        features_dict = extract_url_features(url)
        input_df = prepare_input(url)

        input_scaled = scaler.transform(input_df)

        prob = rf.predict_proba(input_scaled)[0][1]

        final_score = (0.6 * prob) + (0.4 * reputation_score)

        pred = 1 if final_score >= 0.5 else 0

        print("VirusTotal called:", url)

        shap_values = get_shap_explanation(input_df.values[0])

        return {
            "url": url,
            "prediction": "Phishing" if pred == 1 else "Legitimate",
            "risk_score": round(final_score * 100, 2),
            "shap_values": {k: float(v) for k, v in shap_values.items()},
            "reasons": explain_features(features_dict, pred, final_score)
        }

    except Exception as e:
        return {
            "error": str(e)
        }

@app.get("/cache")
def view_cache():
    return {
        "reputation_cache": reputation_cache,
        "cache_timestamp": cache_timestamp
    }

@app.get("/")
def home():
    return {"message": "Phishing Detection API running"}
