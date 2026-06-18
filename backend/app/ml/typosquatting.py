# Typosquatting detection utilities using domain similarity comparison
import difflib
from urllib.parse import urlparse

# List of known legitimate top domains for comparison
TOP_DOMAINS = []

# Normalize and extract domain from URL
def extract_domain(url: str) -> str:
    if not url.startswith("http"):
        url = "http://" + url
    parsed = urlparse(url)
    return parsed.netloc.lower().replace("www.", "")


# Determine whether a domain is likely a typosquatted variant
def is_typosquatting(url: str) -> bool:
    global TOP_DOMAINS
    user_domain = extract_domain(url)
    if user_domain in TOP_DOMAINS:
        return False
    return any(
        0.8 <= difflib.SequenceMatcher(None, user_domain, top_domain).ratio() < 1.0
        for top_domain in TOP_DOMAINS
    )


# Update reference list of trusted top domains
def set_top_domains(domains: list):
    global TOP_DOMAINS
    TOP_DOMAINS = domains