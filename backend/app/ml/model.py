# Machine learning model loader for phishing detection system
import joblib

 # Load trained Random Forest classification model
try:
    rf = joblib.load("rf_model.pkl")
    print("✅ Random Forest model loaded")
except Exception as e:
    print(f"❌ Error loading RF model: {e}")
    rf = None

# Load feature scaler used for input normalization
try:
    scaler = joblib.load("scaler.pkl")
    print("✅ Scaler loaded")
except Exception as e:
    print(f"❌ Error loading scaler: {e}")
    scaler = None

# Load feature column schema used for model input alignment
try:
    feature_columns = joblib.load("feature_columns.pkl")
    print("✅ Feature columns loaded")
except Exception as e:
    print(f"❌ Error loading feature columns: {e}")
    feature_columns = []