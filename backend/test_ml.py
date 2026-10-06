"""Focused tests for data/features, temporal validation, inference and API behavior."""
import unittest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient

from app import app
from inference import PredictionError, load_artifact, predict
from train_model import FEATURES, build_features, load_city_hour_data


class ModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.artifact = load_artifact()
        cls.client = TestClient(app)

    def sample(self, city="Chennai"):
        now = datetime(2024, 12, 15, 10, tzinfo=timezone.utc)
        return {"city": city, "latitude": 13.08, "longitude": 80.27,
                "history": [{"time": (now-timedelta(hours=i)).isoformat(), "pm25": 30+i} for i in reversed(range(7))]}

    def test_real_dataset_loading(self):
        rows = load_city_hour_data()
        self.assertGreater(len(rows), 100_000)
        self.assertIn("Chennai", set(rows.city))

    def test_feature_construction_lags_and_no_future_leakage(self):
        import pandas as pd
        times = pd.date_range("2024-01-01", periods=12, freq="h")
        frame = pd.DataFrame({"city":"A", "state":"S", "time":times,"pm25":range(10,22),"latitude":1.,"longitude":2.})
        features = build_features(frame).set_index("time")
        self.assertEqual(features.loc[times[6], "pm25_lag6"], 10)
        original = features.loc[times[4], "pm25_mean6"]
        frame.loc[11,"pm25"] = 9999
        rebuilt = build_features(frame).set_index("time")
        self.assertEqual(rebuilt.loc[times[4], "pm25_mean6"], original)

    def test_missing_observation_does_not_become_adjacent_lag(self):
        import pandas as pd
        times = list(pd.date_range("2024-01-01", periods=8, freq="h")); times.pop(3)
        frame = pd.DataFrame({"city":"A", "state":"S", "time":times,"pm25":range(10,17),"latitude":1.,"longitude":2.})
        features = build_features(frame)
        row = features.loc[features.time == pd.Timestamp("2024-01-01 04:00:00")].iloc[0]
        self.assertTrue(pd.isna(row.pm25_lag1))

    def test_artifact_has_chronological_splits_and_baseline_metrics(self):
        metadata = self.artifact["metadata"]
        self.assertIn("test", metadata["splits"])
        self.assertEqual(set(metadata["test_ml"]), {"mae", "rmse", "r2"})
        self.assertEqual(set(metadata["test_persistence"]), {"mae", "rmse", "r2"})
        self.assertGreater(metadata["row_counts"]["test"], 0)

    def test_serialization_loading_and_feature_order(self):
        self.assertEqual(self.artifact["features"], FEATURES)
        self.assertTrue(all(feature in FEATURES for feature in self.artifact["features"]))

    def test_inference_returns_finite_one_hour_prediction_with_provenance(self):
        result = predict(self.sample(), self.artifact)
        self.assertGreaterEqual(result["value"], 0)
        self.assertEqual(result["horizon_hours"], 1)
        self.assertEqual(result["pollutant"], "PM2.5")
        self.assertEqual(result["model_name"], "Random Forest")
        self.assertIn("dataset", result)
        self.assertNotIn("confidence", result)

    def test_five_dashboard_locations_are_supported_and_remote_coordinates_are_rejected(self):
        locations = {"Chennai":(13.08,80.27), "Bengaluru":(12.97,77.59),
                     "Hyderabad":(17.39,78.49), "Delhi":(28.61,77.21), "Mumbai":(19.08,72.88)}
        for city,(lat,lon) in locations.items():
            payload=self.sample(city);payload.update(latitude=lat,longitude=lon)
            self.assertGreaterEqual(predict(payload,self.artifact)["value"],0)
        bad=self.sample();bad.update(latitude=40.71,longitude=-74.0)
        with self.assertRaises(PredictionError):predict(bad,self.artifact)

    def test_unsupported_city_and_invalid_input(self):
        with self.assertRaises(PredictionError): predict(self.sample("Atlantis"), self.artifact)
        bad = self.sample(); bad["history"] = bad["history"][:3]
        with self.assertRaises(PredictionError): predict(bad, self.artifact)

    def test_api_health_model_card_valid_and_unsupported(self):
        self.assertEqual(self.client.get("/health").status_code, 200)
        self.assertEqual(self.client.get("/api/model-card").status_code, 200)
        self.assertEqual(self.client.post("/api/prediction", json=self.sample()).status_code, 200)
        bad = self.sample("Atlantis")
        self.assertEqual(self.client.post("/api/prediction", json=bad).status_code, 422)

    def test_local_frontend_cors_preflight_and_prediction_response(self):
        for origin in ("http://localhost:8001", "http://127.0.0.1:8001"):
            preflight = self.client.options("/api/prediction", headers={
                "Origin": origin, "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            })
            self.assertEqual(preflight.status_code, 200)
            self.assertEqual(preflight.headers.get("access-control-allow-origin"), origin)
            self.assertIn("POST", preflight.headers.get("access-control-allow-methods", ""))
            self.assertIn("content-type", preflight.headers.get("access-control-allow-headers", "").lower())
            response = self.client.post("/api/prediction", json=self.sample(), headers={"Origin": origin})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers.get("access-control-allow-origin"), origin)


if __name__ == "__main__":
    unittest.main()
