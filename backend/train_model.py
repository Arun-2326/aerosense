"""Train and chronologically evaluate AeroSense's one-hour PM2.5 model."""
from __future__ import annotations

import glob
import json
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "data" / "raw" / "xkdr" / "2024"
MODELS = ROOT / "models"
FEATURES = ["pm25_t", "pm25_lag1", "pm25_lag2", "pm25_lag3", "pm25_lag6",
            "pm25_mean3", "pm25_mean6", "pm25_median6", "pm25_std6",
            "hour", "day_of_week", "month", "latitude", "longitude"]


def load_city_hour_data(raw_dir: Path = RAW) -> pd.DataFrame:
    files = glob.glob(str(raw_dir / "year=2024" / "month=*" / "data.parquet"))
    station_file = raw_dir / "stations.parquet"
    if len(files) < 12 or not station_file.exists():
        raise FileNotFoundError("Expected all 12 XKDR 2024 month files and stations.parquet; run download_dataset.py")
    con = duckdb.connect()
    paths = "[" + ",".join("'" + f.replace("'", "''") + "'" for f in files) + "]"
    stations = "'" + str(station_file).replace("'", "''") + "'"
    query = f"""
    WITH obs AS (
      SELECT s.city_name AS city, s.state_name AS state, s.latitude, s.longitude,
             date_trunc('hour', m.collected_at) AS time,
             m.parameter_name AS pollutant, m.value
      FROM read_parquet({paths}, union_by_name=true) m
      JOIN read_parquet({stations}) s USING (station_id)
      WHERE m.source='cpcb_caaqm' AND m.parameter_name IN ('PM2.5','PM10','NO2','SO2','Ozone')
        AND m.value IS NOT NULL AND m.value >= 0 AND s.city_name IS NOT NULL
    )
    SELECT city, state, time,
      median(latitude) latitude, median(longitude) longitude,
      median(value) FILTER (WHERE pollutant='PM2.5') pm25
    FROM obs GROUP BY city,state,time
    HAVING count(*) FILTER (WHERE pollutant='PM2.5') > 0
    ORDER BY city,time
    """
    frame = con.execute(query).df()
    frame["time"] = pd.to_datetime(frame["time"])
    return frame


def build_features(frame: pd.DataFrame) -> pd.DataFrame:
    """Build causal features; shift by timestamp so missing hours are never treated as adjacent."""
    rows = []
    for (city, state), group in frame.groupby(["city", "state"], sort=False):
        group = group.sort_values("time").drop_duplicates("time").set_index("time")
        hourly = group[["pm25", "latitude", "longitude"]].resample("1h").median()
        # Do not interpolate observations. Lags refer to exact prior hours.
        pm = hourly["pm25"]
        feat = pd.DataFrame(index=hourly.index)
        feat["pm25_t"] = pm
        for lag in (1, 2, 3, 6):
            feat[f"pm25_lag{lag}"] = pm.shift(lag)
        feat["pm25_mean3"] = pm.shift(1).rolling(3, min_periods=2).mean()
        feat["pm25_mean6"] = pm.shift(1).rolling(6, min_periods=3).mean()
        feat["pm25_median6"] = pm.shift(1).rolling(6, min_periods=3).median()
        feat["pm25_std6"] = pm.shift(1).rolling(6, min_periods=3).std()
        feat["hour"] = feat.index.hour
        feat["day_of_week"] = feat.index.dayofweek
        feat["month"] = feat.index.month
        feat["latitude"] = hourly["latitude"].ffill().bfill()
        feat["longitude"] = hourly["longitude"].ffill().bfill()
        feat["target"] = pm.shift(-1)
        feat["city"] = city
        feat["state"] = state
        feat["time"] = feat.index
        rows.append(feat.reset_index(drop=True))
    return pd.concat(rows, ignore_index=True) if rows else pd.DataFrame()


def metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    return {"mae": float(mean_absolute_error(y_true, y_pred)),
            "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
            "r2": float(r2_score(y_true, y_pred))}


def train() -> dict:
    print("Loading XKDR city-hour observations…", flush=True)
    raw = load_city_hour_data()
    print(f"Loaded {len(raw):,} rows across {raw.city.nunique()} cities", flush=True)
    data = build_features(raw).dropna(subset=["target", "pm25_t"]).copy()
    print(f"Built causal features for {len(data):,} rows", flush=True)
    data["time"] = pd.to_datetime(data["time"])
    train_set = data[data.time < "2024-09-01"]
    valid_set = data[(data.time >= "2024-09-01") & (data.time < "2024-11-01")]
    test_set = data[data.time >= "2024-11-01"]
    if min(len(train_set), len(valid_set), len(test_set)) < 100:
        raise ValueError(f"Insufficient chronological split sizes: {len(train_set)}, {len(valid_set)}, {len(test_set)}")
    # Compare a small predetermined model to persistence using validation MAE only.
    candidates = [
        RandomForestRegressor(n_estimators=60, min_samples_leaf=4, max_features=0.85,
                              random_state=27, n_jobs=4),
        RandomForestRegressor(n_estimators=60, min_samples_leaf=10, max_features=0.65,
                              random_state=27, n_jobs=4),
    ]
    baseline_val = metrics(valid_set.target.to_numpy(), valid_set.pm25_t.to_numpy())
    best = None
    fit_train = train_set.sample(n=min(len(train_set), 40_000), random_state=27).sort_values("time")
    for model in candidates:
        pipe = Pipeline([("imputer", SimpleImputer(strategy="median", add_indicator=True)), ("model", model)])
        pipe.fit(fit_train[FEATURES], fit_train.target)
        score = metrics(valid_set.target.to_numpy(), pipe.predict(valid_set[FEATURES]))
        if best is None or score["mae"] < best[0]:
            best = (score["mae"], pipe, score)
    # Refit selected configuration on train+validation; test is touched exactly once below.
    selected = best[1]
    final = Pipeline([("imputer", SimpleImputer(strategy="median", add_indicator=True)),
                      ("model", selected.named_steps["model"])])
    fit_data = pd.concat([fit_train, valid_set.sample(n=min(len(valid_set), 20_000), random_state=28)])
    final.fit(fit_data[FEATURES], fit_data.target)
    print("Evaluating held-out Nov–Dec test period…", flush=True)
    ml = metrics(test_set.target.to_numpy(), final.predict(test_set[FEATURES]))
    persistence = metrics(test_set.target.to_numpy(), test_set.pm25_t.to_numpy())
    supported = sorted(raw.city.dropna().astype(str).unique().tolist())
    city_coordinates = {str(city): {"latitude": float(group.latitude.median()), "longitude": float(group.longitude.median())}
                        for city, group in raw.groupby("city") if group.latitude.notna().any() and group.longitude.notna().any()}
    metadata = {
        "model_name": "Random Forest", "model_version": "1.0.0",
        "trained_at": datetime.now(timezone.utc).isoformat(), "pollutant": "PM2.5",
        "software_versions": {"python": ".".join(map(str, __import__("sys").version_info[:3])), "scikit_learn": sklearn.__version__, "numpy": np.__version__, "pandas": pd.__version__},
        "target": "city-hour CPCB median PM2.5 at t+1 hour", "horizon_hours": 1,
        "units": "dataset-reported concentration (µg/m³ for CPCB PM2.5)",
        "dataset": "India Air Quality Database, XKDR Forum (CPCB CAAQM only)",
        "dataset_url": "https://airquality.xkdr.org/", "license": "CC BY 4.0",
        "time_range": "2024-01-01 through 2024-12-31", "geography": "CPCB station cities represented in 2024 extract",
        "features": FEATURES, "feature_method": "exact-hour lags and trailing-only rolling summaries; no interpolation; local timestamps as published",
        "splits": {"train": "before 2024-09-01", "validation": "2024-09-01 to 2024-10-31", "test": "2024-11-01 to 2024-12-31"},
        "validation_ml": best[2], "validation_persistence": baseline_val,
        "test_ml": ml, "test_persistence": persistence,
        "beats_persistence_test_mae": ml["mae"] < persistence["mae"],
        "row_counts": {"train": len(train_set), "validation": len(valid_set), "test": len(test_set)},
        "fit_row_counts": {"train_sample": len(fit_train), "validation_sample": min(len(valid_set), 20_000)},
        "supported_cities": supported,
        "city_coordinates": city_coordinates,
        "limitations": ["One-hour horizon only", "2024 CPCB city-level data; provider/model and station observations have different provenance", "CPCB values are preliminary and may contain gaps or outliers", "No weather features are included"]
    }
    MODELS.mkdir(exist_ok=True)
    joblib.dump({"pipeline": final, "features": FEATURES, "metadata": metadata}, MODELS / "pm25_model.joblib")
    (MODELS / "model_card.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


if __name__ == "__main__":
    print(json.dumps(train(), indent=2))
