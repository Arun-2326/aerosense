"""Validated one-hour PM2.5 inference for the trained AeroSense artifact."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import math

import joblib
import numpy as np
import pandas as pd

from train_model import FEATURES

ARTIFACT = Path(__file__).resolve().parent / "models" / "pm25_model.joblib"


class PredictionError(ValueError):
    pass


def load_artifact(path: Path = ARTIFACT):
    if not path.exists():
        raise FileNotFoundError("Trained PM2.5 model artifact is missing")
    return joblib.load(path)


def predict(payload: dict, artifact: dict | None = None) -> dict:
    artifact = artifact or load_artifact()
    metadata = artifact["metadata"]
    city = str(payload.get("city", "")).strip()
    supported = {name.casefold(): name for name in metadata["supported_cities"]}
    if city.casefold() not in supported:
        raise PredictionError(f"Unsupported city: {city or '(missing)'}")
    city = supported[city.casefold()]
    lat, lon = payload.get("latitude"), payload.get("longitude")
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)) or not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise PredictionError("Valid latitude and longitude are required")
    reference = metadata.get("city_coordinates", {}).get(city)
    if reference:
        # Avoid extrapolating this India-only city model to a remote coordinate.
        lat1, lat2 = math.radians(float(lat)), math.radians(reference["latitude"])
        dlat = lat2 - lat1
        dlon = math.radians(reference["longitude"] - float(lon))
        a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
        if 6371 * 2 * math.asin(min(1, math.sqrt(a))) > 150:
            raise PredictionError("Coordinates are outside the supported area for this city")
    history = payload.get("history")
    if not isinstance(history, list) or len(history) < 7:
        raise PredictionError("At least seven hourly PM2.5 observations are required")
    frame = pd.DataFrame(history)
    if not {"time", "pm25"}.issubset(frame.columns):
        raise PredictionError("History must include time and pm25")
    frame["time"] = pd.to_datetime(frame["time"], utc=True, errors="coerce")
    frame["pm25"] = pd.to_numeric(frame["pm25"], errors="coerce")
    frame = frame.dropna(subset=["time", "pm25"]).sort_values("time").drop_duplicates("time").tail(7)
    if len(frame) < 7 or not np.isfinite(frame.pm25.to_numpy()).all() or (frame.pm25 < 0).any():
        raise PredictionError("Seven valid, non-negative hourly PM2.5 observations are required")
    hours = frame.time.diff().dropna().dt.total_seconds().to_numpy() / 3600
    if not np.allclose(hours, 1, atol=0.03):
        raise PredictionError("Input observations must be consecutive hourly values")
    vals = frame.pm25.to_numpy(dtype=float)
    now = frame.time.iloc[-1]
    local_time = now.tz_convert("Asia/Kolkata")
    row = {
        "pm25_t": vals[-1], "pm25_lag1": vals[-2], "pm25_lag2": vals[-3],
        "pm25_lag3": vals[-4], "pm25_lag6": vals[-7],
        "pm25_mean3": float(np.mean(vals[-4:-1])), "pm25_mean6": float(np.mean(vals[:-1])),
        "pm25_median6": float(np.median(vals[:-1])), "pm25_std6": float(np.std(vals[:-1], ddof=1)),
        "hour": local_time.hour, "day_of_week": local_time.dayofweek, "month": local_time.month,
        "latitude": float(lat), "longitude": float(lon),
    }
    value = float(artifact["pipeline"].predict(pd.DataFrame([row], columns=FEATURES))[0])
    if not math.isfinite(value):
        raise PredictionError("Model returned an invalid prediction")
    value = max(0.0, value)
    return {
        "status": "available", "city": city, "pollutant": "PM2.5", "value": round(value, 2),
        "units": "µg/m³", "horizon_hours": 1, "valid_time": (now + pd.Timedelta(hours=1)).isoformat(),
        "model_name": metadata["model_name"], "model_version": metadata["model_version"],
        "generated_at": datetime.now(timezone.utc).isoformat(), "dataset": metadata["dataset"],
        "dataset_url": metadata["dataset_url"], "evaluation": {"test_ml": metadata["test_ml"], "test_persistence": metadata["test_persistence"], "beats_persistence_test_mae": metadata["beats_persistence_test_mae"]},
        "input_source": payload.get("input_source", "Open-Meteo historical air-quality model series"),
        "input_note": "Inference uses provider hourly PM2.5 as recent input; training target uses CPCB station-city medians. Source-domain differences apply.",
    }
