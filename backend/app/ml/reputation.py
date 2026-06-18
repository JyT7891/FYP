# External URL reputation scoring using VirusTotal API with caching
import base64
import time
import requests

from app.config import settings

# Cache storage for reputation scores and timestamps
# In-Memory Cache
reputation_cache: dict = {}
cache_timestamp: dict = {}


# Retrieve or compute reputation score for a given URL
def get_reputation_score(url: str) -> float:
    # Return cached score if still valid within TTL window
    if url in reputation_cache and time.time() - cache_timestamp[url] < settings.CACHE_TTL:
        return reputation_cache[url]

    # Query VirusTotal API for URL analysis results
    try:
        # Encode URL into VirusTotal-compatible ID format
        url_id = base64.urlsafe_b64encode(url.encode()).decode().strip("=")
        response = requests.get(
            f"https://www.virustotal.com/api/v3/urls/{url_id}",
            headers={"x-apikey": settings.VIRUSTOTAL_API_KEY},
        )
        if response.status_code != 200:
            return 0.5

        # Extract malware analysis statistics from API response
        stats = (
            response.json()
            .get("data", {})
            .get("attributes", {})
            .get("last_analysis_stats", {})
        )
        # Retrieve malicious detection count
        malicious = stats.get("malicious", 0)
        # Retrieve harmless detection count
        harmless = stats.get("harmless", 0)
        total = malicious + harmless
        # Compute normalized reputation score (Bayesian smoothing applied)
        score = 0.5 if total == 0 else (malicious + 1) / (total + 2)

    # Fallback to neutral score if API request fails
    except Exception:
        score = 0.5

    # Store computed score in cache
    reputation_cache[url] = score
    cache_timestamp[url] = time.time()
    return score