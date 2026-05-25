import difflib
from urllib.parse import urlparse

TOP_DOMAINS = []


def extract_domain(url: str) -> str:
    if not url.startswith("http"):
        url = "http://" + url
    parsed = urlparse(url)
    return parsed.netloc.lower().replace("www.", "")


def is_typosquatting(url: str) -> bool:
    global TOP_DOMAINS
    user_domain = extract_domain(url)
    if user_domain in TOP_DOMAINS:
        return False
    return any(
        0.8 <= difflib.SequenceMatcher(None, user_domain, top_domain).ratio() < 1.0
        for top_domain in TOP_DOMAINS
    )


def set_top_domains(domains: list):
    global TOP_DOMAINS
    TOP_DOMAINS = domains