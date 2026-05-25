import numpy as np
import pandas as pd
import joblib

from app.ml.model import feature_columns

# Load explainer (if it exists, otherwise create a placeholder)
try:
    explainer = joblib.load("explainer.pkl")
except:
    explainer = None
    print("⚠️ Explainer not found - SHAP values will be empty")


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


def get_shap_explanation(feature_vector) -> dict:
    if explainer is None:
        return {}
    
    X = np.array([feature_vector])
    shap_values = explainer.shap_values(X)
    
    # Handle both binary and multi-class cases
    if isinstance(shap_values, list):
        values = shap_values[1][0] if len(shap_values) > 1 else shap_values[0][0]
    else:
        values = shap_values[0]
    
    values = [float(x) for x in np.array(values).flatten()]
    return dict(zip(feature_columns, values))


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