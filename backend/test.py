import joblib

feature_columns = joblib.load("feature_columns.pkl")
print(f"Total features: {len(feature_columns)}")
print(f"Features: {feature_columns}")