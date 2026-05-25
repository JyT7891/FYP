import base64
import time
import requests

from app.config import settings

# In-Memory Cache
reputation_cache: dict = {}
cache_timestamp: dict = {}


def get_reputation_score(url: str) -> float:
    if url in reputation_cache and time.time() - cache_timestamp[url] < settings.CACHE_TTL:
        return reputation_cache[url]

    try:
        url_id = base64.urlsafe_b64encode(url.encode()).decode().strip("=")
        response = requests.get(
            f"https://www.virustotal.com/api/v3/urls/{url_id}",
            headers={"x-apikey": settings.VIRUSTOTAL_API_KEY},
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