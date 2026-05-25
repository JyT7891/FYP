import joblib

# Load ML Models
try:
    rf = joblib.load("rf_model.pkl")
    print("✅ Random Forest model loaded")
except Exception as e:
    print(f"❌ Error loading RF model: {e}")
    rf = None

try:
    scaler = joblib.load("scaler.pkl")
    print("✅ Scaler loaded")
except Exception as e:
    print(f"❌ Error loading scaler: {e}")
    scaler = None

try:
    feature_columns = joblib.load("feature_columns.pkl")
    print("✅ Feature columns loaded")
except Exception as e:
    print(f"❌ Error loading feature columns: {e}")
    feature_columns = []