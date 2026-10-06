# AeroSense

## Real-Time Air Quality Monitoring & Prediction

**Understand your air. Before it affects you.**

AeroSense is an environmental-intelligence web application for exploring air-quality conditions across selected Indian cities. It brings current pollutant and weather context together with historical trends, a near-term outlook, statistical anomaly detection, and practical outdoor-activity guidance.

The application is built with a vanilla HTML/CSS/JavaScript frontend and an optional Python/FastAPI inference backend. Open-Meteo supplies atmospheric-model air-quality and weather data on the live path. A scikit-learn Random Forest provides an independent one-hour PM2.5 estimate when the backend and eligible live input are available. Clearly labelled deterministic fixtures keep the main experience usable in Demo Mode.

## 1. Problem Statement

Air quality changes across regions and over time, while people often lack a simple way to understand current conditions, recent trends, possible contextual contributors, what may happen next, and practical ways to reduce exposure.

The recruitment task also calls for publicly available environmental and compliance information. AeroSense does not currently integrate verified incident, inspection, regulatory, or compliance records; its Environmental History content is illustrative demo content, as described below.

## 2. Recruitment Task → Implementation

| Recruitment Requirement | AeroSense Implementation |
| --- | --- |
| Location/region selection | Select among Chennai, Bengaluru, Hyderabad, Delhi, and Mumbai; the map shows city reference locations. |
| Open-source/current air-quality information | Open-Meteo air-quality and weather endpoints provide atmospheric-model output when available. The app also supports deterministic demo fixtures. |
| Time-window analysis | View hourly 24-hour history and 7-day or 30-day history. The latter ranges are summarized as daily averages. |
| Historical/current trend analysis | Pollutant history is charted; forecast trend direction is calculated from available forecast values. |
| ML prediction | Optional FastAPI service returns a one-hour-ahead Random Forest PM2.5 estimate from recent provider PM2.5 values. |
| Environmental/compliance information | Dedicated verified incident/inspection/regulatory/compliance data is NOT currently integrated. The current Environmental History content is deterministic illustrative/demo content and is explicitly marked as unverified. A verified external environmental/compliance data source is a planned extension. |
| Recommendations/best practices | Rule-based general recommendations and a forecast-window Activity Advisor provide informational guidance, not medical advice. |

## 3. Core Product Flow

**LOCATION → CURRENT CONDITIONS → WHY → TREND → PREDICTION → BEST TIME → RECOMMENDATION**

- **Location:** choose a supported city and see its reference marker.
- **Current conditions:** review AQI, pollutants, weather, timestamp, and data provenance.
- **Why:** see contextual explanations derived from available pollution and weather signals. These describe associations, not confirmed causes.
- **Trend:** inspect hourly and daily historical pollutant values and statistical anomalies.
- **Prediction:** compare the provider's atmospheric-model forecast with the separate one-hour AeroSense ML estimate when available.
- **Best time:** compare forecast hours for a selected activity profile using a heuristic score.
- **Recommendation:** read general environmental guidance based on current conditions.

## 4. Key Features

### Interactive Map

Leaflet renders an OpenStreetMap tile map with five supported city reference locations. Markers show the selected data state and AQI when available. City markers are references, not monitoring stations. The map and its tiles require network access.

### Current Air Quality

The dashboard shows AQI and PM2.5, PM10, NO2, SO2, and O3 where the selected data source provides values. Weather context includes temperature, humidity, wind, and precipitation where available. Values include source and status information; missing values remain unavailable rather than being filled with fabricated observations.

### Pollutant Analysis and Historical Trends

The timeline supports PM2.5, PM10, NO2, SO2, and O3. The 24-hour view uses hourly values, while the 7-day and 30-day views use daily average pollutant concentrations. Historical model output is not ground-station measurement data; no AQI is calculated from these pollutant concentrations.

### Why Is Air Changing?

Contextual explanations can use recent pollutant patterns, weather values, provider forecasts, and anomaly status. Wind, humidity, temperature, rainfall, and pollutant trends are presented as context or association. They do not identify a pollution source or establish causation.

### Future Prediction

- **AeroSense ML:** optional FastAPI inference returns a Random Forest estimate for PM2.5 one hour ahead. It requires seven valid consecutive hourly provider PM2.5 values, a supported city, and the local backend. Demo Mode does not call the trained model.
- **Provider forecast:** Open-Meteo future hourly pollutant values can supply additional outlook hours, up to six in the dashboard. These are provider atmospheric-model values, not AeroSense ML outputs.

The two outputs are labelled separately. If ML input or the backend is unavailable, the provider forecast can still be displayed.

### Anomaly Detection

The timeline's statistical detector compares each reading with a preceding-only rolling baseline. It uses a rolling median and median absolute deviation (MAD), with a standard-deviation fallback when MAD is zero but the baseline varies. Anomaly markers indicate unusual statistical behavior; they do not establish a cause or health risk.

### Activity Advisor

The Advisor supports **General public, Walking, Running, Cycling,** and **Sensitive groups** profiles. It ranks available future forecast hours using a heuristic score based on forecast PM2.5 and available AQI, PM10, and wind context. It identifies best/worst windows only when there is a meaningful difference in the forecast values. **This is informational guidance, not medical advice.**

### Location Comparison

The comparison card can display up to three locations and summarize their AQI fixture values. Its current city AQI values are deterministic fixture values and should not be interpreted as live Open-Meteo measurements.

### Demo Mode

Deterministic fixtures provide repeatable readings, forecast series, history, and recommendations for Chennai, Bengaluru, Hyderabad, Delhi, and Mumbai. Demo Mode can be selected in the dashboard. If live provider requests fail before a valid cached response is available, the app falls back to labelled demo data; a later provider failure may instead retain cached values marked stale.

## 5. Data Sources & Provenance

### Open-Meteo

The live/automatic service path requests air-quality data from the Open-Meteo Air Quality API and weather data from the Open-Meteo Weather API. Open-Meteo air-quality values are atmospheric-model output, not direct ground-monitor measurements. The UI exposes model timestamps and data status where available. Network or provider failures may result in demo or stale data.

### OpenStreetMap + Leaflet

Leaflet 1.9.4 renders OpenStreetMap tiles. The map needs a network connection and includes OpenStreetMap attribution.

### CPCB/XKDR Training Dataset

The Random Forest was trained using the 2024 India Air Quality Database published by XKDR Forum, filtered to CPCB CAAQM station observations and joined to station metadata. US Embassy/AirNow observations were excluded from the model training dataset. The dataset publisher documents CC BY 4.0. Raw parquet files are not committed.

These sources have different roles: CPCB/XKDR observations are the model's training and evaluation data; Open-Meteo supplies current/provider input and forecast values at runtime; deterministic fixtures are demonstration data.

## 6. Data Status Labels

- **LIVE / LIVE MODEL DATA:** a successful current Open-Meteo atmospheric-model response. “Live” describes a current provider response; it does not mean a ground-monitor observation.
- **PARTIAL:** air-quality data is available but some weather or expected fields are unavailable.
- **STALE:** a previously cached provider result is being shown after a refresh failure, with its original timestamp where available.
- **DEMO:** deterministic fixture data. It is not live data.
- **PREDICTED:** a future value from either Open-Meteo's provider forecast or the separate AeroSense Random Forest; the source is labelled so these are distinguishable. Predicted values are not observations.
- **DERIVED:** a calculated trend, heuristic score, risk label, or contextual explanation. Derived results are not direct measurements, and explanations do not establish causation.

## 7. Architecture

```text
Browser
  └─ Vanilla HTML / CSS / JavaScript
       └─ Frontend service and normalization layer
            ├─ Open-Meteo air-quality and weather endpoints
            ├─ Deterministic demo fixtures and in-memory caches
            └─ Optional FastAPI inference API (HTTP)
                 └─ scikit-learn Random Forest artifact
```

The frontend owns rendering, interaction, provider normalization, fallback, and in-memory caching. The FastAPI service loads the committed model artifact and validates inference requests. The dashboard can run in Demo Mode without the ML backend; live Open-Meteo access and map tiles require network access.

## 8. Technology Stack

| Area | Technologies used |
| --- | --- |
| Frontend | HTML, CSS, JavaScript |
| Map | Leaflet, OpenStreetMap |
| Backend | Python, FastAPI, Uvicorn |
| ML/data | scikit-learn Random Forest, pandas, NumPy, joblib, DuckDB |
| Tests | Node.js built-in test runner, Python `unittest` |

There is no React, TypeScript, Vite, Tailwind, React Router, Recharts, PostgreSQL, or OpenAQ integration in the current implementation.

## 9. Machine Learning

- **Target:** city-hour median PM2.5 concentration one hour ahead, in µg/m³.
- **Model:** scikit-learn `RandomForestRegressor`, version **1.0.0**, with median imputation.
- **Training data:** 2024 India Air Quality Database (XKDR Forum), using CPCB CAAQM station observations only.
- **Features:** current PM2.5, exact-hour lags (1, 2, 3, and 6 hours), trailing summaries, local hour/day/month, and coordinates. Missing hours are not interpolated; lags refer to exact timestamps.
- **Evaluation:** chronological split. Training data precedes September 2024; validation covers September–October; held-out test covers November–December 2024. Candidate selection uses validation MAE. The final fit samples up to 40,000 training rows and up to 20,000 validation rows; the test period is held out for evaluation.

### Held-out test metrics

| Model | MAE (µg/m³) | RMSE (µg/m³) | R² |
| --- | ---: | ---: | ---: |
| Random Forest | 8.68 | 18.60 | 0.870 |
| Persistence baseline (next value = current value) | 9.28 | 19.54 | 0.857 |

These are offline evaluation results on the documented dataset and split, not a guarantee of live prediction accuracy. The runtime input uses recent Open-Meteo hourly PM2.5 model values, while training targets are CPCB station-city medians. This source/domain difference means the offline metrics do not establish operational accuracy for provider inputs or individual cities. The model card is [`backend/models/model_card.json`](backend/models/model_card.json); the serialized artifact is [`backend/models/pm25_model.joblib`](backend/models/pm25_model.joblib).

## 10. Anomaly Detection

`anomaly.js` uses preceding-only rolling windows: up to 12 prior hourly observations for 24 hours, 6 prior daily observations for 7 days, and 14 prior daily observations for 30 days. It requires at least 6 valid, uniquely timestamped prior readings. Null readings and invalid timestamps are excluded; for duplicate timestamps, the last valid sample is retained. Missing values are not converted to zero or interpolated.

The primary robust score is `0.6745 × (current − baseline median) / MAD`. Absolute scores of 2.5 or more are elevated; scores of 3.5 or more are anomalous and receive chart markers. When MAD is zero but the baseline varies, a median-centered standard-deviation fallback is used. With a constant baseline, a different current value is marked anomalous by exact deviation without inventing a score. Insufficient history produces no score or marker. An anomaly identifies unusual statistical behavior; it does not establish causation.

## 11. API Endpoints

The optional FastAPI service runs on port 8002 by default:

| Method and route | Purpose |
| --- | --- |
| `GET /health` | Reports service status and whether the model artifact exists. |
| `GET /api/model-card` | Returns model metadata and evaluation information. |
| `POST /api/prediction` | Validates recent observations and returns a one-hour-ahead PM2.5 estimate. |

The prediction request includes a supported city, coordinates, and at least seven valid consecutive hourly PM2.5 observations. The frontend calls the prediction endpoint only when its live-input requirements are met.

## 12. Project Structure

```text
.
├── index.html                 # Landing page and dashboard markup
├── styles.css                 # Main responsive styling
├── history.css                # Historical chart styling
├── map.css                    # Map styling
├── app.js                     # Dashboard rendering and interactions
├── services.js                # Open-Meteo, fixtures, caching, fallback, ML API client
├── data.js                    # Deterministic city/demo fixtures
├── prediction.js              # Forecast normalization and trend calculation
├── intelligence.js            # Contextual explanations and Activity Advisor
├── anomaly.js                 # Rolling statistical anomaly detection
├── map.js                     # Leaflet map presentation
├── serve.cjs                  # Local static frontend server (port 8001)
├── tests/
│   ├── anomaly.test.cjs
│   ├── intelligence.test.cjs
│   └── prediction.test.cjs
└── backend/
    ├── app.py                 # FastAPI application and routes
    ├── inference.py           # Input validation and model inference
    ├── train_model.py         # Dataset processing and model training
    ├── download_dataset.py    # XKDR dataset download helper
    ├── requirements.txt
    ├── test_ml.py
    └── models/
        ├── model_card.json
        └── pm25_model.joblib
```

Raw downloaded data and virtual environments are local and excluded from Git.

## 13. Installation

Commands below are for Windows PowerShell, run from the project directory.

### Frontend

Install Node.js if needed, then serve the static app:

```powershell
node serve.cjs
```

The server listens on `http://localhost:8001`. Open that address in a browser. Demo fixtures work without provider API keys. Open-Meteo requests and map tiles require network access.

### Optional ML backend

Use Python 3.14 and a project-local virtual environment:

```powershell
python --version
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
```

If PowerShell blocks activation, use the environment's interpreter directly:

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Start the API in one PowerShell window:

```powershell
cd backend
python -m uvicorn app:app --host 127.0.0.1 --port 8002
```

Keep the frontend server running in another window. The browser uses `http://127.0.0.1:8002` by default for ML inference. The backend CORS allowlist defaults to the local frontend origins on ports 8000 and 8001.

## 14. Environment Configuration

### Runtime variables consumed by code

- `AEROSENSE_CORS_ORIGINS` — optional comma-separated allowed origins read by `backend/app.py`; defaults include localhost and 127.0.0.1 on ports 8000 and 8001.
- `AEROSENSE_DATA_API_KEY` — read by `backend/download_dataset.py` when downloading XKDR training data. It is not needed to run the app or use the committed model artifact.

The static browser page does not read `.env` files. Optional browser endpoint overrides must be set on `window.AEROSENSE_CONFIG` before `services.js` loads. Supported fields include `openMeteoAirBaseUrl`, `openMeteoWeatherBaseUrl`, `osmTileUrl`, and `mlApiBaseUrl`.

### `.env.example` placeholders

`.env.example` contains deployment/future-integration examples. `OPENAQ_API_KEY`, `OPENAQ_BASE_URL`, `AEROSENSE_API_BASE_URL`, and `DATABASE_URL` are not used by the current application. Open-Meteo and OSM URL values there are examples; the current static frontend uses its JavaScript defaults or `window.AEROSENSE_CONFIG`, not automatic `.env` loading. No API key is required for the current Demo/Open-Meteo workflow.

## 15. Testing

From the project directory:

```powershell
node --test tests/*.cjs
python backend/test_ml.py
```

The verified results for this submission are **33 frontend tests passed** and **10 backend tests passed**. The backend suite loads the committed model and includes a real-dataset loading test. Raw XKDR parquet files are excluded from Git, so obtain the dataset before running that dataset-dependent test. The downloader reads `AEROSENSE_DATA_API_KEY` from the environment; dataset/API access is not needed for the other backend checks.

## 16. Demo Mode

Demo Mode uses deterministic fixtures for **Chennai, Bengaluru, Hyderabad, Delhi,** and **Mumbai**. Repeated selections use stable city-specific current values and forecast/history fixtures so the product flow can be demonstrated consistently. Demo values carry explicit labels and are not live measurements. If a live-provider request fails and there is no valid cached response, the service returns demo fixtures; an existing cached provider response may be retained and labelled stale.

## 17. 2-Minute Evaluator Demo

1. Open `http://localhost:8001` and click **Explore Air Quality**.
2. Select **Chennai** and show the AQI, pollutant breakdown, and source/status labels.
3. Point out the map marker and explain that it is a city reference, not a monitoring station.
4. Review **Why is the air changing?** and describe the factors as contextual associations, not causal findings.
5. Open the historical timeline, switch between 24h, 7d, and 30d, and inspect any anomaly marker if one is present for the selected range/data.
6. Open **What happens next?** and distinguish the one-hour AeroSense Random Forest estimate from the additional Open-Meteo provider forecast.
7. Open the **Activity Advisor**, change the profile, and explain that its forecast ranking is heuristic informational guidance.
8. Show **Compare locations** and note that its city AQI values are deterministic fixtures, not live provider measurements.
9. Switch to Demo Mode if needed to demonstrate repeatable data without relying on the provider. Finish by explaining LIVE/PARTIAL/STALE/DEMO and PREDICTED/DERIVED labels.

## 18. Limitations

- Open-Meteo air-quality values are atmospheric-model output, not direct ground-monitor observations.
- Training targets are CPCB city-hour medians, while runtime input is Open-Meteo model PM2.5; this source/domain shift limits interpretation of offline model metrics.
- Reported ML metrics are offline held-out results, not a guarantee of live accuracy or city-specific performance.
- The Random Forest predicts one hour ahead for PM2.5 only and requires seven valid consecutive hourly inputs. It provides no confidence interval.
- Pollutant and weather fields may be missing; unavailable values are not inferred or filled with zeros.
- The location comparison uses deterministic AQI fixtures.
- Environmental History is illustrative demo content, not a verified incident or compliance feed.
- AeroSense does not integrate verified environmental/compliance records and does not perform causal inference.
- Activity guidance is informational and is not medical advice.
- Live provider data and map tiles require network access; provider outages may cause stale or demo states.

## 19. Future Improvements

- Integrate a verified source for environmental incidents, inspections, regulatory actions, and compliance data.
- Add additional monitoring-station sources and clearly reconcile their coverage and provenance.
- Explore multi-hour ML forecasting and evaluate each horizon independently.
- Improve region-specific training data and evaluate model performance by city and source.
- Add PostgreSQL persistence if the product requires stored user or environmental records.
- Provide richer historical-event provenance and broader geographic coverage.

These are future directions, not current features.

## 20. Data Honesty

AeroSense distinguishes provider output, deterministic fixtures, predictions, derived interpretations, and cached stale results. It does not intentionally label synthetic demo information as live. Provider model values are not ground-monitor observations; predicted values are not observations; derived explanations and scores are not direct measurements or causal conclusions.

## 21. Security

- Do not place private API secrets in frontend source or browser configuration.
- Backend configuration and the optional XKDR download key are read from environment variables where applicable.
- `.gitignore` excludes local virtual environments and downloaded raw/processed datasets from Git.
- The current static frontend and Open-Meteo workflow do not require a private API key.

## 22. Submission Notes

AeroSense is a Web Development recruitment project for the **NEXUS Club, VIT Chennai**. This repository documents the implementation as it exists today and calls out unimplemented environmental/compliance data integration explicitly.
