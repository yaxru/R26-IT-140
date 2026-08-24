import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
from pathlib import Path

DATA_PATH = Path("data/garments_worker_productivity.csv")
MODEL_PATH = Path("model/productivity_model.joblib")
MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(DATA_PATH)

# Feature engineering from date (optional but helpful)
df["date"] = pd.to_datetime(df["date"], errors="coerce")
df["month"] = df["date"].dt.month
df["day_of_month"] = df["date"].dt.day

TARGET = "actual_productivity"
df = df.dropna(subset=[TARGET]).copy()

feature_cols = [
    "department","day","team",
    "targeted_productivity","smv","wip",
    "over_time","incentive","idle_time","idle_men",
    "no_of_style_change","no_of_workers",
    "month","day_of_month"
]
feature_cols = [c for c in feature_cols if c in df.columns]

X = df[feature_cols]
y = df[TARGET]

cat_cols = [c for c in ["department", "day"] if c in X.columns]
num_cols = [c for c in X.columns if c not in cat_cols]

preprocess = ColumnTransformer(
    transformers=[
        ("num", Pipeline([("imp", SimpleImputer(strategy="median"))]), num_cols),
        ("cat", Pipeline([
            ("imp", SimpleImputer(strategy="most_frequent")),
            ("oh", OneHotEncoder(handle_unknown="ignore"))
        ]), cat_cols)
    ]
)

model = RandomForestRegressor(
    n_estimators=500,
    random_state=42,
    n_jobs=-1
)

pipe = Pipeline([("prep", preprocess), ("model", model)])

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

pipe.fit(X_train, y_train)

pred = pipe.predict(X_test)
print("MAE :", mean_absolute_error(y_test, pred))
rmse = mean_squared_error(y_test, pred) ** 0.5
print("RMSE:", rmse)
print("R2  :", r2_score(y_test, pred))

joblib.dump(pipe, MODEL_PATH)
print(f"Saved -> {MODEL_PATH}")