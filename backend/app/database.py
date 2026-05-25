from pymongo import MongoClient
import certifi

from app.config import settings

# MongoDB Connection
mongo_client = MongoClient(settings.MONGO_URI, tlsCAFile=certifi.where())
db = mongo_client["aegisphish"]

# Collections
users_collection = db["users"]
scans_collection = db["scans"]
reports_collection = db["reports"]

# Create indexes for better performance
def create_indexes():
    users_collection.create_index("email", unique=True)
    scans_collection.create_index([("user_id", 1), ("scanned_at", -1)])
    reports_collection.create_index("status")

# Call this function when needed
create_indexes()

# Connection function for the app factory
def connect_to_mongo():
    """Return the database connection (for compatibility with app factory)"""
    return db