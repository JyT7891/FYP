# ML feature extraction utilities for phishing URL detection
import numpy as np
import pandas as pd
import joblib

from app.ml.model import feature_columns

try:
    explainer = joblib.load("explainer.pkl")
    feature_columns = joblib.load("feature_columns.pkl") 
except:
    explainer = None

# Extract basic lexical features from URL string
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


# Construct ML feature vector from URL for model input
def build_features(url: str) -> dict:
    url_lower = url.lower()
    domain = url.split("//")[-1].split("/")[0] if "//" in url else url
    
    # Return the dictionary directly with all 87 features
    return {
        # Basic URL structure
        "length_url": len(url),
        "length_hostname": len(domain),
        "ip": int(any(part.isdigit() for part in domain.split("."))),
        
        # Character counts
        "nb_dots": url.count("."),
        "nb_hyphens": url.count("-"),
        "nb_at": url.count("@"),
        "nb_qm": url.count("?"),
        "nb_and": url.count("&"),
        "nb_or": url.count("|"),
        "nb_eq": url.count("="),
        "nb_underscore": url.count("_"),
        "nb_tilde": url.count("~"),
        "nb_percent": url.count("%"),
        "nb_slash": url.count("/"),
        "nb_star": url.count("*"),
        "nb_colon": url.count(":"),
        "nb_comma": url.count(","),
        "nb_semicolumn": url.count(";"),
        "nb_dollar": url.count("$"),
        "nb_space": url.count(" "),
        "nb_www": int("www" in url_lower),
        "nb_com": int(".com" in url_lower),
        "nb_dslash": url.count("//"),
        
        # Protocol indicators
        "http_in_path": int("http" in url_lower),
        "https_token": int("https" in url_lower),
        
        # Ratios
        "ratio_digits_url": sum(c.isdigit() for c in url) / max(len(url), 1),
        "ratio_digits_host": sum(c.isdigit() for c in domain) / max(len(domain), 1),
        
        # Suspicious patterns
        "punycode": int("xn--" in url_lower),
        "port": 0,
        "tld_in_path": 0,
        "tld_in_subdomain": 0,
        "abnormal_subdomain": 0,
        "nb_subdomains": domain.count(".") if domain else 0,
        "prefix_suffix": 0,
        "random_domain": 0,
        "shortening_service": int(any(x in url_lower for x in ["bit.ly", "tinyurl", "t.co", "goo.gl", "ow.ly"])),
        "path_extension": 0,
        
        # Redirects
        "nb_redirection": 0,
        "nb_external_redirection": 0,
        
        # Word analysis
        "length_words_raw": len(url),
        "char_repeat": 0,
        "shortest_words_raw": 0,
        "shortest_word_host": 0,
        "shortest_word_path": 0,
        "longest_words_raw": 0,
        "longest_word_host": 0,
        "longest_word_path": 0,
        "avg_words_raw": 0,
        "avg_word_host": 0,
        "avg_word_path": 0,
        
        # Brand/domain
        "phish_hints": int(any(x in url_lower for x in ["login", "verify", "secure", "account", "update", "confirm"])),
        "domain_in_brand": 0,
        "brand_in_subdomain": 0,
        "brand_in_path": 0,
        "suspecious_tld": int(any(url_lower.endswith(x) for x in [".tk", ".ml", ".ga", ".cf", ".xyz", ".top", ".club", ".online", ".site"])),
        "statistical_report": 0,
        
        # Hyperlink features
        "nb_hyperlinks": 0,
        "ratio_inthyperlinks": 0,
        "ratio_exthyperlinks": 0,
        "ratio_nullhyperlinks": 0,
        "nb_extcss": 0,
        "ratio_intredirection": 0,
        "ratio_extredirection": 0,
        "ratio_interrors": 0,
        "ratio_exterrors": 0,
        "login_form": int("login" in url_lower or "signin" in url_lower),
        "external_favicon": 0,
        "links_in_tags": 0,
        "submit_email": int("mailto:" in url_lower),
        "ratio_intmedia": 0,
        "ratio_extmedia": 0,
        "sfh": 0,
        "iframe": 0,
        "popup_window": 0,
        
        # Mouse/UI
        "safe_anchor": 0,
        "onmouseover": 0,
        "right_clic": 0,
        "empty_title": 0,
        
        # Domain registration
        "domain_in_title": 0,
        "domain_with_copyright": 0,
        "whois_registered_domain": 1,
        "domain_registration_length": 0,
        "domain_age": 0,
        
        # External reputation
        "web_traffic": 0,
        "dns_record": 1,
        "google_index": 1,
        "page_rank": 0,
    }


# Convert URL into model-ready pandas DataFrame using feature columns
def prepare_input(url: str) -> pd.DataFrame:
    feats = build_features(url)
    return pd.DataFrame(
        [[feats.get(col, 0) for col in feature_columns]],
        columns=feature_columns,
    )


# Generate SHAP-based feature importance explanation for prediction
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


# Generate human-readable reasoning for phishing detection output
def explain_features(features: dict, prediction: int, prob: float, is_typo: bool = False) -> list[str]:
    reasons = []

    if is_typo:
        reasons.append("Domain appears to be typosquatting (similar to popular legitimate domain)")

    url_length = features.get("url_length", 0)
    if url_length > 150:
        reasons.append(f"Unusually long URL ({url_length} characters) - legitimate URLs are typically shorter")
    elif url_length > 100:
        reasons.append(f"Very long URL ({url_length} characters) - often used to hide malicious intent")
    
    num_dots = features.get("num_dots", 0)
    if num_dots > 5:
        reasons.append(f"Excessive dots in URL ({num_dots} dots) - unusual for legitimate websites")
    elif num_dots > 3:
        reasons.append(f"Multiple subdomains detected ({num_dots} dots) - may indicate deception")
    
    num_hyphens = features.get("num_hyphens", 0)
    if num_hyphens > 3:
        reasons.append(f"Excessive hyphens ({num_hyphens} hyphens) - phishing URLs often use hyphens to mimic legitimate domains")
    
    num_underscores = features.get("num_underscores", 0)
    if num_underscores > 2:
        reasons.append(f"Multiple underscores ({num_underscores} underscores) - uncommon in legitimate URLs")
    
    num_slashes = features.get("num_slashes", 0)
    if num_slashes > 5:
        reasons.append(f"Excessive slashes ({num_slashes} slashes) - unusually deep directory structure")
    
    num_digits = features.get("num_digits", 0)
    if num_digits > 10:
        reasons.append(f"High number of digits ({num_digits} digits) - phishing URLs often use random numbers")
    elif num_digits > 5:
        reasons.append(f"Multiple digits detected ({num_digits} digits) - may indicate randomly generated URL")

    if features.get("has_at", 0) == 1:
        reasons.append("@ Symbol detected in URL - can be used to trick browsers")
    
    if features.get("has_ip", 0) == 1:
        reasons.append("Uses IP address instead of domain name - legitimate services rarely use IP addresses directly")

    if features.get("has_https", 0) == 0:
        reasons.append("No HTTPS security indicator - connection may not be encrypted")
    
    if features.get("has_http", 0) == 1:
        reasons.append("HTTP protocol found within URL path - suspicious redirection pattern")

    keyword_reasons = []
    
    if features.get("has_login", 0) == 1:
        keyword_reasons.append("'login'")
    if features.get("has_secure", 0) == 1:
        keyword_reasons.append("'secure'")
    if features.get("has_verify", 0) == 1:
        keyword_reasons.append("'verify'")
    if features.get("has_update", 0) == 1:
        keyword_reasons.append("'update'")
    if features.get("has_account", 0) == 1:
        keyword_reasons.append("'account'")
    
    if keyword_reasons:
        keywords = ", ".join(keyword_reasons)
        reasons.append(f"Contains urgency/social engineering keywords ({keywords}) - commonly used in phishing attacks")

    subdomain_count = features.get("subdomain_count", 0)
    if subdomain_count > 2:
        reasons.append(f"Multiple subdomains ({subdomain_count}) - may be trying to impersonate a legitimate site")
    
    tld_length = features.get("tld_length", 0)
    if tld_length > 4:
        reasons.append(f"Unusual top-level domain length ({tld_length} characters) - suspicious TLD detected")

    if features.get("shortening_service", 0) == 1:
        reasons.append("URL shortener detected - destination may be hidden")

    if prediction == 1 or prob > 0.6:
        if features.get("has_https") == 0 and features.get("has_login") == 1:
            reasons.append("CRITICAL: Login page without HTTPS - credentials could be intercepted!")
        
        if features.get("has_ip") == 1 and features.get("has_login") == 1:
            reasons.append("CRITICAL: Login form on IP address - highly suspicious!")

    if not reasons:
        if prediction == 0 and prob < 0.3:
            reasons.append("URL appears structurally normal and secure")
        else:
            reasons.append("URL appears structurally normal")

    return reasons