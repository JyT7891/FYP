# MongoDB database connection setup and collection initialization

# Import MongoDB client for database connection
from pymongo import MongoClient
# SSL certificate handling for secure MongoDB connection
import certifi

# Load application configuration settings
from app.config import settings

# Initialize MongoDB client with TLS security
mongo_client = MongoClient(settings.MONGO_URI, tlsCAFile=certifi.where())
# Select application database
db = mongo_client["aegisphish"]

# Database collections used in the application
# Collections
# Users collection for authentication and profiles
users_collection = db["users"]
# Scans collection for URL analysis history
scans_collection = db["scans"]
# Reports collection for user-submitted suspicious URLs
reports_collection = db["reports"]

# Create database indexes for query optimization
def create_indexes():
    # Ensure email uniqueness for users
    users_collection.create_index("email", unique=True)
    # Optimize scan history queries by user and date
    scans_collection.create_index([("user_id", 1), ("scanned_at", -1)])
    # Index report status for fast filtering
    reports_collection.create_index("status")

# Initialize indexes at startup
create_indexes()

# Provide database connection for application factory pattern
def connect_to_mongo():
    # Return shared database instance
    """Return the database connection (for compatibility with app factory)"""
    return db